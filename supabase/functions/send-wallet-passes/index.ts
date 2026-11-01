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
// POST { eventId, applicationIds?, resend?, limit? }  ->  { sent, failed: [{ code, email, error }], remaining }
//   applicationIds  only these people (at most 40 per request). Every id must be an
//                   application at the event, or nothing is sent. Chosen people who
//                   aren't on the check-in roster come back in failed. Leave it out
//                   to send to everyone accepted who has no pass yet.
//   resend          include people who already have emailed_at set
//   limit           most to send in this request (default and max 40); call again while remaining > 0
//
// GET  ->  { applicationIds: true }. The console asks before sending to chosen
// people, so a console that ships ahead of this function gets a 405 from the
// old one and stops, instead of the old one emailing everyone without a pass.
//
// Secrets: WALLETWALLET_API_KEY, GMAIL_ADDRESS, GMAIL_APP_PASSWORD, SEND_DELAY_SECONDS (optional).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Deploy: supabase functions deploy send-wallet-passes

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";
import { MAX_PER_REQUEST, outsideEvent, parseApplicationIds } from "./selection.ts";
import {
  buildEmail, oneLine, passLinkSeconds, passPayload, type CreatedPass, type PassAttendee, type PassEvent,
} from "./passDesign.ts";

const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret ${name}`);
  return value;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Attendee = PassAttendee & { id: string; email: string };

/** Makes the pass on WalletWallet; the design per role is in passDesign.ts. */
async function createPass(event: PassEvent, a: Attendee): Promise<CreatedPass> {
  const response = await fetch("https://api.walletwallet.dev/api/passes", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env("WALLETWALLET_API_KEY")}` },
    body: JSON.stringify(passPayload(event, a)),
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return json({ applicationIds: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let input: { eventId?: unknown; applicationIds?: unknown; resend?: unknown; limit?: unknown };
  try {
    input = await req.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }
  const { eventId } = input;
  if (typeof eventId !== "string") return json({ error: "Send eventId." }, 400);
  const selection = parseApplicationIds(input.applicationIds);
  if (!selection.ok) return json({ error: selection.error }, 400);
  const chosen = selection.ids;
  const resend = input.resend === true;
  const limit = Math.min(MAX_PER_REQUEST, Math.max(1, Number(input.limit) || MAX_PER_REQUEST));

  // Organizers of this event only.
  const caller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: isStaff, error: staffError } = await caller.rpc("is_event_staff", { eid: eventId });
  if (staffError) return json({ error: staffError.message }, 401);
  if (isStaff !== true) return json({ error: "Only organizers of this event can send passes." }, 403);

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: event, error: eventError } = await admin.from("events").select("id, name, starts_at, ends_at").eq("id", eventId).single();
  if (eventError || !event) return json({ error: eventError?.message ?? "No such event." }, 404);

  const failed: { code: string; email: string; error: string }[] = [];

  // Chosen people: every id has to be an application at this event.
  if (chosen) {
    if (chosen.length === 0) return json({ sent: 0, failed, remaining: 0 });
    const { data: apps, error: appsError } = await admin
      .from("applications")
      .select("id, email")
      .eq("event_id", eventId)
      .in("id", chosen);
    if (appsError) return json({ error: appsError.message }, 500);
    const outside = outsideEvent(chosen, (apps ?? []).map(a => a.id as string));
    if (outside.length > 0) {
      return json({ error: `${outside.length} of the chosen applications aren't at this event, so nothing was sent.`, ids: outside }, 400);
    }
    const { data: roster, error: rosterError } = await admin
      .from("attendees")
      .select("application_id")
      .eq("event_id", eventId)
      .not("code", "is", null)
      .in("application_id", chosen);
    if (rosterError) return json({ error: rosterError.message }, 500);
    const onRoster = new Set((roster ?? []).map(r => String(r.application_id).toLowerCase()));
    for (const app of apps ?? []) {
      if (!onRoster.has(String(app.id).toLowerCase())) {
        failed.push({ code: "", email: app.email ?? "", error: "Not on the check-in roster, so no code yet (only released acceptances get one)." });
      }
    }
  }

  let query = admin
    .from("attendees")
    .select("id, code, name, email, roles, team, emailed_at")
    .eq("event_id", eventId)
    .not("code", "is", null)
    .order("code");
  if (chosen) query = query.in("application_id", chosen);
  if (!resend) query = query.is("emailed_at", null);
  const { data: rows, error: rowsError } = await query;
  if (rowsError) return json({ error: rowsError.message }, 500);

  const queue: Attendee[] = [];
  for (const r of rows ?? []) {
    const email = (r.email ?? "").trim();
    if (!email) failed.push({ code: r.code, email: "", error: "No email address on the roster." });
    else if (!isPlainEmail(email)) failed.push({ code: r.code, email: "", error: "The roster email isn't a single plain address." });
    else queue.push({ id: r.id, code: String(r.code).toUpperCase(), name: oneLine(r.name ?? "") || email, email, roles: r.roles ?? [], team: r.team ? oneLine(r.team) : null });
  }
  const batch = queue.slice(0, limit);

  const from = env("GMAIL_ADDRESS");
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: from, pass: env("GMAIL_APP_PASSWORD").replace(/\s+/g, "") },
  });
  const delayMs = Math.max(0, Number(Deno.env.get("SEND_DELAY_SECONDS") ?? "1")) * 1000;

  let sent = 0;
  for (const [i, a] of batch.entries()) {
    if (i > 0 && delayMs) await sleep(delayMs);
    try {
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
      const { error } = await admin.from("attendees").update({ emailed_at: new Date().toISOString() }).eq("id", a.id);
      if (error) console.error(`Sent ${a.code} but could not set emailed_at:`, error.message);
      sent++;
    } catch (error) {
      failed.push({ code: a.code, email: a.email, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return json({ sent, failed, remaining: queue.length - batch.length });
});
