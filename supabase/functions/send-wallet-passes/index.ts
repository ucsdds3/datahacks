// Emails each accepted attendee their check-in pass, from the organizer console.
//
// The same job as send_emails.py in the check-in repo (DS3-DataHacks-Check-in),
// moved server-side so nobody has to run it from a laptop: it reads the roster
// from public.attendees, makes a WalletWallet pass per person (barcode =
// attendees.code, which the check-in desk scans; a colour and title per role,
// see passDesign.ts), emails it, and sets attendees.emailed_at. Either one
// skips people the other has done.
//
// Each email has Add to Apple Wallet / Add to Google Wallet buttons and the
// .pkpass attached (iPhone Mail adds it with one tap). There's no QR image in
// the email: people show the wallet pass, and the desk can type the code.
//
// Add to Apple Wallet: the .pkpass is uploaded to the private `wallet-passes`
// bucket at <event_id>/<random uuid>.pkpass with Content-Type
// application/vnd.apple.pkpass, and the button is a signed link to it, valid
// until 30 days after events.ends_at (120 days if there's no end date). Storage
// serves a signed object with its stored Content-Type and no
// Content-Disposition (no `download` option), so Safari on an iPhone opens the
// native Add to Apple Wallet sheet directly. If the upload or signing fails, the
// button falls back to WalletWallet's shareUrl page so the email still works.
// Add to Google Wallet is WalletWallet's pay.google.com save link.
//
// POST { eventId, applicationIds?, resend?, limit? }
//   ->  { sent, failed: [{ code, email, error }], remaining, remainingIds, skipped, stopped, quota }
//   applicationIds  only these people (at most 40 per request). Every id must be an
//                   application at the event, or nothing is sent. Chosen people who
//                   aren't on the check-in roster come back in failed. Leave it out
//                   to send to everyone accepted who has no pass yet.
//   resend          include people who already have emailed_at set
//   limit           most to send in this request (default and max 40); call again while remaining > 0
//
// Like send-email, each pass email is claimed in public.email_log and
// attendees.emailed_at is set the moment Gmail accepts it, so a retry or two
// organizers sending at once never send a second pass. A request stops
// starting new passes after SEND_BUDGET_SECONDS (default 75: WalletWallet,
// storage and SMTP per person, inside Supabase's 150 s limit); remainingIds
// are the chosen applications it didn't get to, for the console's next request.
// The daily email limit applies here too (stopped: "daily_limit").
// Errors are { error, code }; database details are only logged.
//
// GET  ->  { applicationIds: true, remainingIds: true }. The console asks before sending to chosen
// people, so a console that ships ahead of this function gets a 405 from the
// old one and stops, instead of the old one emailing everyone without a pass.
//
// Secrets: WALLETWALLET_API_KEY, GMAIL_ADDRESS, GMAIL_APP_PASSWORD, SEND_DELAY_SECONDS (optional).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Deploy: supabase functions deploy send-wallet-passes

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";
import { MAX_PER_REQUEST, outsideEvent, parseApplicationIds } from "./selection.ts";
import { emailKeys, isUuid, runSendLoop, shortError, type ClaimResult } from "../_shared/sendLoop.ts";
import {
  buildEmail, oneLine, passLinkSeconds, passPayload, type CreatedPass, type PassAttendee, type PassEvent,
} from "./passDesign.ts";

class ConfigError extends Error {}

const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new ConfigError(`Wallet passes aren't configured on the server yet (missing the ${name} secret). Nothing was sent.`);
  return value;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const fail = (status: number, code: string, error: string, extra: Record<string, unknown> = {}) => json({ error, code, ...extra }, status);

/** Logs a database error and returns the generic answer for the console. */
const dbFailure = (what: string, error: { message?: string; code?: string }) => {
  console.error(`${what}:`, error.code ?? "", error.message ?? "");
  return fail(500, "db_error", `Couldn't ${what} from the database, so nothing was sent. Try again in a minute.`);
};

async function quota(admin: SupabaseClient) {
  const [used, limit] = await Promise.all([admin.rpc("email_sends_last_day"), admin.rpc("email_daily_limit")]);
  if (used.error || limit.error) return null;
  return { used: used.data as number, limit: limit.data as number, remaining: Math.max(0, (limit.data as number) - (used.data as number)) };
}

type Attendee = PassAttendee & { id: string; email: string; applicationId: string; emailedAt: string | null };

/** Makes the pass on WalletWallet; the design per role is in passDesign.ts. */
async function createPass(event: PassEvent, a: Attendee): Promise<CreatedPass> {
  const response = await fetch("https://api.walletwallet.dev/api/passes", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env("WALLETWALLET_API_KEY")}` },
    body: JSON.stringify(passPayload(event, a)),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`WalletWallet ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return await response.json() as CreatedPass;
}

const PASS_BUCKET = "wallet-passes";
const PKPASS = "application/vnd.apple.pkpass";

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

/**
 * Puts the .pkpass in the private wallet-passes bucket and returns a signed
 * link to it for the Add to Apple Wallet button, or undefined if anything fails
 * (the email then links WalletWallet's page instead).
 */
async function applePassLink(
  admin: SupabaseClient,
  eventId: string,
  endsAt: string | null | undefined,
  pass: CreatedPass,
  code: string,
): Promise<string | undefined> {
  try {
    if (!pass.applePass) return undefined;
    const path = `${eventId}/${crypto.randomUUID()}.pkpass`;
    const bucket = admin.storage.from(PASS_BUCKET);
    const { error: uploadError } = await bucket.upload(path, fromBase64(pass.applePass), { contentType: PKPASS, upsert: false });
    if (uploadError) throw uploadError;
    const { data, error: signError } = await bucket.createSignedUrl(path, passLinkSeconds(endsAt));
    if (signError || !data?.signedUrl) throw signError ?? new Error("No signed URL");
    return data.signedUrl;
  } catch (error) {
    console.error(`Could not store the pass for ${code}, linking WalletWallet's page instead:`, error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

/** One plain address (the database enforces the same), so a value can't add recipients. */
const isPlainEmail = (email: string) => email.length <= 254 && /^[A-Za-z0-9._+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(email);

async function handle(req: Request): Promise<Response> {
  const startedAt = Date.now();
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return json({ applicationIds: true, remainingIds: true });
  if (req.method !== "POST") return fail(405, "method", "Method not allowed");

  let input: { eventId?: unknown; applicationIds?: unknown; resend?: unknown; limit?: unknown };
  try {
    input = await req.json();
  } catch {
    return fail(400, "bad_request", "Expected a JSON body.");
  }
  const { eventId } = input;
  if (!isUuid(eventId)) return fail(400, "bad_request", "Send eventId.");
  const selection = parseApplicationIds(input.applicationIds);
  if (!selection.ok) return fail(400, "bad_request", selection.error);
  const chosen = selection.ids;
  const resend = input.resend === true;
  const limit = Math.min(MAX_PER_REQUEST, Math.max(1, Number(input.limit) || MAX_PER_REQUEST));

  // Organizers of this event only.
  const caller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: isStaff, error: staffError } = await caller.rpc("is_event_staff", { eid: eventId });
  if (staffError) {
    console.error("is_event_staff:", staffError.code, staffError.message);
    return fail(401, "auth", "Your sign-in couldn't be checked. Sign in again and retry. Nothing was sent.");
  }
  if (isStaff !== true) return fail(403, "forbidden", "Only organizers of this event can send passes.");
  const { data: who } = await caller.auth.getUser();

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: event, error: eventError } = await admin.from("events").select("id, name, starts_at, ends_at").eq("id", eventId).maybeSingle();
  if (eventError) return dbFailure("load the event", eventError);
  if (!event) return fail(404, "not_found", "No such event.");

  const failed: { code: string; email: string; error: string }[] = [];

  // Chosen people: every id has to be an application at this event.
  if (chosen) {
    if (chosen.length === 0) return json({ sent: 0, failed, remaining: 0, remainingIds: [], skipped: 0, stopped: null, quota: await quota(admin) });
    const { data: apps, error: appsError } = await admin
      .from("applications")
      .select("id, email")
      .eq("event_id", eventId)
      .in("id", chosen);
    if (appsError) return dbFailure("load the chosen applications", appsError);
    const outside = outsideEvent(chosen, (apps ?? []).map(a => a.id as string));
    if (outside.length > 0) {
      return fail(400, "outside_event", `${outside.length} of the chosen applications aren't at this event, so nothing was sent.`, { ids: outside });
    }
    const { data: roster, error: rosterError } = await admin
      .from("attendees")
      .select("application_id")
      .eq("event_id", eventId)
      .not("code", "is", null)
      .in("application_id", chosen);
    if (rosterError) return dbFailure("load the check-in roster", rosterError);
    const onRoster = new Set((roster ?? []).map(r => String(r.application_id).toLowerCase()));
    for (const app of apps ?? []) {
      if (!onRoster.has(String(app.id).toLowerCase())) {
        failed.push({ code: "", email: app.email ?? "", error: "Not on the check-in roster, so no code yet (only released acceptances get one)." });
      }
    }
  }

  let query = admin
    .from("attendees")
    .select("id, application_id, code, name, email, roles, team, emailed_at")
    .eq("event_id", eventId)
    .not("code", "is", null)
    .order("code");
  if (chosen) query = query.in("application_id", chosen);
  if (!resend) query = query.is("emailed_at", null);
  const { data: rows, error: rowsError } = await query;
  if (rowsError) return dbFailure("load the check-in roster", rowsError);

  const queue: Attendee[] = [];
  for (const r of rows ?? []) {
    const email = (r.email ?? "").trim();
    if (!email) failed.push({ code: r.code, email: "", error: "No email address on the roster." });
    else if (!isPlainEmail(email)) failed.push({ code: r.code, email: "", error: "The roster email isn't a single plain address." });
    else {
      queue.push({
        id: r.id, applicationId: String(r.application_id), emailedAt: r.emailed_at ?? null,
        code: String(r.code).toUpperCase(), name: oneLine(r.name ?? "") || email, email, roles: r.roles ?? [], team: r.team ? oneLine(r.team) : null,
      });
    }
  }
  const batch = queue.slice(0, limit);

  const from = env("GMAIL_ADDRESS");
  const password = env("GMAIL_APP_PASSWORD").replace(/\s+/g, "");
  env("WALLETWALLET_API_KEY");
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    auth: { user: from, pass: password },
  });
  const delayMs = Math.max(0, Number(Deno.env.get("SEND_DELAY_SECONDS") ?? "1")) * 1000;
  const budgetMs = Math.max(10, Number(Deno.env.get("SEND_BUDGET_SECONDS") ?? "75")) * 1000;
  const keyOf = (a: Attendee) => emailKeys.pass(a.id, a.emailedAt, a.email);

  let loop;
  try {
    loop = await runSendLoop(batch, {
      claim: async a => {
        const { data, error } = await admin.rpc("claim_email", {
          p_event_id: eventId, p_kind: "pass", p_key: keyOf(a), p_application_id: a.applicationId, p_by: who?.user?.id ?? null,
        });
        if (error) throw new Error(`claim_email: ${error.code ?? ""} ${error.message}`);
        return data as ClaimResult;
      },
      deliver: async a => {
        const pass = await createPass(event, a);
        const appleLink = await applePassLink(admin, eventId, event.ends_at, pass, a.code);
        const { subject, text, html } = buildEmail(event, a, pass, appleLink);
        await transport.sendMail({
          from: `DataHacks Team <${from}>`,
          to: a.email,
          subject,
          text,
          html,
          attachments: [
            { filename: `${a.code}.pkpass`, content: pass.applePass, encoding: "base64", contentType: PKPASS },
          ],
        });
      },
      // Sets attendees.emailed_at in the same call.
      finish: async (a, ok, error) => {
        const { error: dbError } = await admin.rpc("finish_email", { p_key: keyOf(a), p_ok: ok, p_error: error ?? null });
        if (dbError) throw new Error(`finish_email: ${dbError.code ?? ""} ${dbError.message}`);
      },
    }, { startedAt, budgetMs, delayMs });
  } finally {
    transport.close();
  }

  const byId = new Map(batch.map(a => [a.id, a]));
  for (const f of loop.failed) {
    const a = byId.get(f.id)!;
    failed.push({ code: a.code, email: a.email, error: f.error });
  }
  const notTried = new Set(loop.remaining);
  // Chosen people this request didn't get to (out of time, or past `limit`), for the next request.
  const remainingIds = chosen
    ? [...batch.filter(a => notTried.has(a.id)), ...queue.slice(limit)].map(a => a.applicationId)
    : [];

  return json({
    sent: loop.sent.length,
    failed,
    remaining: queue.length - batch.length + loop.remaining.length,
    remainingIds,
    skipped: loop.skipped.length,
    stopped: loop.stopped,
    quota: await quota(admin),
  });
}

Deno.serve(async req => {
  try {
    return await handle(req);
  } catch (error) {
    if (error instanceof ConfigError) return fail(503, "not_configured", error.message);
    console.error("send-wallet-passes crashed:", shortError(error));
    return fail(500, "internal", "The passes function hit an unexpected error. Anyone already sent a pass is recorded, so sending again only reaches the rest.");
  }
});
