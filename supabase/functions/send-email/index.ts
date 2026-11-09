// Sends email from the organizer console through the DataHacks Gmail account.
//
// POST { eventId, applicationIds, subject, body, kind, expectStatus? }
//   ->  { sent, skipped: [{ id, reason }], failed: [{ id, error }], remaining: [id],
//         stopped, unrecorded: [id], quota: { used, limit, remaining } }
//
// Only organizers of the event can call it, and it only writes to applications
// in that event: the browser picks who, by application id, but the addresses
// come from the database. So the Gmail password never reaches the browser, and
// the console can't be used to email arbitrary people.
//
// kind
//   decision  a released decision; expectStatus (accepted, waitlisted or
//             rejected) skips anyone whose released status is different, so a
//             template can't reach the wrong group. Marks decision_emailed_at.
//   offer     an event-day spot offer (a decision too); also marks
//             waitlist_offer_emailed_at.
//   blast     anything else. Never to unsubmitted drafts. The same subject and
//             body reach a person once: sending it again skips them.
//
// Every email is claimed in public.email_log first and marked sent right after
// Gmail accepts it (see supabase/functions/_shared/sendLoop.ts and migration
// *_email_log.sql), so a retry never emails anyone twice. A request stops
// starting new emails after SEND_BUDGET_SECONDS (default 90, well inside
// Supabase's 150 s limit) and returns the ids it didn't get to in `remaining`;
// the console sends those in its next request. Claims stop at the daily limit
// (public.email_daily_limit(), under Gmail's 2,000 a day): `stopped` is then
// "daily_limit" and `remaining` waits for tomorrow.
//
// subject and body may use {{first_name}}, {{last_name}}, {{status}}, {{type}}
// and {{code}} (the check-in code, once accepted). {{qr}} in the body becomes
// that code as a QR image inside the email; people without a code are skipped
// and reported.
//
// Errors come back as { error, code } with a message meant for organizers;
// database details are only logged.
//
// Secrets (supabase secrets set ...):
//   GMAIL_ADDRESS        the sending account, e.g. info@ds3.club
//   GMAIL_APP_PASSWORD   a Google app password for that account (spaces are fine)
//   SEND_DELAY_SECONDS   pause between emails, to stay under Gmail's limits (default 1)
//   SEND_BUDGET_SECONDS  stop starting new emails after this long (default 90)
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Deploy:
//   supabase functions deploy send-email
//   supabase secrets set GMAIL_ADDRESS=info@ds3.club GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
//
// SMTP goes over port 465 (TLS): Supabase Edge Functions block outgoing 25 and 587.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";
import QRCode from "npm:qrcode@1.5.4";
import { emailKeys, isUuid, runSendLoop, sha256Hex, shortError, type ClaimResult } from "../_shared/sendLoop.ts";

class ConfigError extends Error {}

const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new ConfigError(`Email isn't configured on the server yet (missing the ${name} secret). Nothing was sent.`);
  return value;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const fail = (status: number, code: string, error: string) => json({ error, code }, status);

/** Most recipients one request takes; the console sends 40 at a time. */
const MAX_RECIPIENTS = 50;

const KINDS = ["decision", "offer", "blast"] as const;
type Kind = (typeof KINDS)[number];
const DECISIONS = ["accepted", "waitlisted", "rejected"];

type Recipient = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  applicant_type: string;
  status: string;
  released_at: string | null;
  code: string | null;
};

const TYPE_LABEL: Record<string, string> = { hacker: "hacker", mentor: "mentor", judge: "judge", hybrid: "mentor and judge" };

/** Where {{qr}} was: replaced by an image in the HTML and by the code in plain text. */
const QR_MARK = "\u0000qr\u0000";
const usesQr = (text: string) => /\{\{\s*qr\s*\}\}/.test(text);

/**
 * Applicant-typed text is untrusted (docs/untrusted-input.md): a name could hold
 * a line break meant to add email headers, or a QR_MARK to plant an image.
 * Control characters become spaces; the HTML is escaped separately below.
 */
// deno-lint-ignore no-control-regex
const oneLine = (text: string | null | undefined) => (text ?? "").replace(/[\x00-\x1f\x7f]+/g, " ").trim();

/** One plain address (the database enforces the same), so a value can't add recipients. */
const isPlainEmail = (email: string) => email.length <= 254 && /^[A-Za-z0-9._+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(email);

const fill = (template: string, r: Recipient) =>
  template.replace(/\{\{\s*(first_name|last_name|status|type|code|qr)\s*\}\}/g, (_, key: string) => {
    switch (key) {
      case "first_name": return oneLine(r.first_name) || "there";
      case "last_name": return oneLine(r.last_name);
      case "status": return r.status;
      case "type": return TYPE_LABEL[r.applicant_type] ?? r.applicant_type;
      case "code": return r.code ?? "";
      case "qr": return QR_MARK;
      default: return "";
    }
  });

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

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

async function handle(req: Request): Promise<Response> {
  const startedAt = Date.now();
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail(405, "method", "Method not allowed");

  let input: { eventId?: unknown; applicationIds?: unknown; subject?: unknown; body?: unknown; kind?: unknown; expectStatus?: unknown };
  try {
    input = await req.json();
  } catch {
    return fail(400, "bad_request", "Expected a JSON body.");
  }

  const { eventId, applicationIds, subject, body } = input;
  const kind: Kind = KINDS.includes(input.kind as Kind) ? input.kind as Kind : "blast";
  const expectStatus = typeof input.expectStatus === "string" ? input.expectStatus : null;
  if (!isUuid(eventId) || typeof subject !== "string" || typeof body !== "string" || !Array.isArray(applicationIds)) {
    return fail(400, "bad_request", "Send eventId, applicationIds, subject and body.");
  }
  if (!applicationIds.every(isUuid)) return fail(400, "bad_request", "applicationIds must be a list of application ids.");
  if (expectStatus !== null && !DECISIONS.includes(expectStatus)) return fail(400, "bad_request", "expectStatus must be accepted, waitlisted or rejected.");
  if (!subject.trim() || !body.trim()) return fail(400, "bad_request", "The subject and message can't be empty.");
  const ids = [...new Set((applicationIds as string[]).map(id => id.toLowerCase()))];
  if (ids.length > MAX_RECIPIENTS) return fail(400, "too_many", `At most ${MAX_RECIPIENTS} recipients per request.`);

  // Who is asking: the organizer's Supabase session, checked against the event.
  const caller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: isStaff, error: staffError } = await caller.rpc("is_event_staff", { eid: eventId });
  if (staffError) {
    console.error("is_event_staff:", staffError.code, staffError.message);
    return fail(401, "auth", "Your sign-in couldn't be checked. Sign in again and retry. Nothing was sent.");
  }
  if (isStaff !== true) return fail(403, "forbidden", "Only organizers of this event can send email.");
  const { data: who } = await caller.auth.getUser();

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  if (ids.length === 0) return json({ sent: 0, skipped: [], failed: [], remaining: [], stopped: null, unrecorded: [], quota: await quota(admin) });

  // Recipients come from the database, limited to this event.
  const { data: rows, error: rowsError } = await admin
    .from("applications")
    .select("id, first_name, last_name, email, applicant_type, status, user_id, decision_released_at")
    .eq("event_id", eventId)
    .in("id", ids);
  if (rowsError) return dbFailure("load the recipients", rowsError);

  const userIds = rows.map(r => r.user_id).filter(Boolean);
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, email").in("id", userIds)
    : { data: [] };
  const { data: attendees } = await admin
    .from("attendees")
    .select("application_id, code")
    .in("application_id", rows.map(r => r.id));

  const profileEmail = new Map((profiles ?? []).map(p => [p.id, p.email as string]));
  const codeFor = new Map((attendees ?? []).map(a => [a.application_id, a.code as string]));
  const byId = new Map(rows.map(r => [String(r.id).toLowerCase(), r]));

  const failed: { id: string; error: string }[] = [];
  const recipients: Recipient[] = [];
  const withQr = usesQr(body);
  for (const id of ids) {
    const r = byId.get(id);
    if (!r) { failed.push({ id, error: "Not an application in this event." }); continue; }
    const recipient: Recipient = {
      id: r.id,
      email: r.email?.trim() || (r.user_id ? profileEmail.get(r.user_id) : null) || null,
      first_name: r.first_name,
      last_name: r.last_name,
      applicant_type: r.applicant_type,
      status: r.status,
      released_at: r.decision_released_at,
      code: codeFor.get(r.id) ?? null,
    };
    if (!recipient.email) failed.push({ id, error: "No email address on file." });
    else if (!isPlainEmail(recipient.email)) failed.push({ id, error: "The email address on file isn't a single plain address." });
    else if (withQr && !recipient.code) failed.push({ id, error: "No check-in code yet (only accepted people get one)." });
    else if (kind === "blast" && recipient.status === "draft") failed.push({ id, error: "Hasn't submitted their application, so blasts skip them." });
    else if (kind !== "blast" && (!DECISIONS.includes(recipient.status) || !recipient.released_at)) failed.push({ id, error: "No released decision to email yet." });
    else if (expectStatus && recipient.status !== expectStatus) failed.push({ id, error: `Their decision is now "${recipient.status}", not "${expectStatus}", so this email wasn't sent. Reload and send again.` });
    else recipients.push(recipient);
  }

  const from = env("GMAIL_ADDRESS");
  const password = env("GMAIL_APP_PASSWORD").replace(/\s+/g, "");
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    // One connection reused for the whole request, with timeouts so a stuck send can't run past the platform's limit.
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    auth: { user: from, pass: password },
  });
  const delayMs = Math.max(0, Number(Deno.env.get("SEND_DELAY_SECONDS") ?? "1")) * 1000;
  const budgetMs = Math.max(10, Number(Deno.env.get("SEND_BUDGET_SECONDS") ?? "90")) * 1000;
  const textHash = kind === "blast" ? await sha256Hex(`${eventId}\u0000${subject}\u0000${body}`) : "";
  const keyOf = (r: Recipient) => (kind === "blast" ? emailKeys.blast(textHash, r.id) : emailKeys.decision(r.id, r.released_at));

  let loop;
  try {
    loop = await runSendLoop(recipients, {
      claim: async r => {
        const { data, error } = await admin.rpc("claim_email", {
          p_event_id: eventId, p_kind: kind, p_key: keyOf(r), p_application_id: r.id, p_by: who?.user?.id ?? null,
        });
        if (error) throw new Error(`claim_email: ${error.code ?? ""} ${error.message}`);
        return data as ClaimResult;
      },
      deliver: async r => {
        const filled = fill(body, r);
        const text = filled.split(QR_MARK).join(`Check-in code: ${r.code ?? ""}`);
        const img = `<img src="cid:checkin-qr" alt="Check-in QR code ${escapeHtml(r.code ?? "")}" width="240" height="240" style="display:block">`;
        const html = escapeHtml(filled).replace(/\r?\n/g, "<br>").split(QR_MARK).join(img);
        await transport.sendMail({
          from: `DataHacks Team <${from}>`,
          to: r.email!,
          // One line: no CR/LF from a name (or the template) can start a new header.
          subject: oneLine(fill(subject, r).split(QR_MARK).join("")),
          text,
          html: `<div style="font-family: sans-serif; line-height: 1.5">${html}</div>`,
          attachments: withQr
            ? [{ filename: `datahacks-checkin-${r.code}.png`, content: await QRCode.toBuffer(r.code!, { width: 480, margin: 2 }), cid: "checkin-qr" }]
            : [],
        });
      },
      finish: async (r, ok, error) => {
        const { error: dbError } = await admin.rpc("finish_email", { p_key: keyOf(r), p_ok: ok, p_error: error ?? null });
        if (dbError) throw new Error(`finish_email: ${dbError.code ?? ""} ${dbError.message}`);
      },
    }, { startedAt, budgetMs, delayMs });
  } finally {
    transport.close();
  }

  return json({
    sent: loop.sent.length,
    skipped: loop.skipped,
    failed: [...failed, ...loop.failed],
    remaining: loop.remaining,
    stopped: loop.stopped,
    unrecorded: loop.unrecorded,
    quota: await quota(admin),
  });
}

Deno.serve(async req => {
  try {
    return await handle(req);
  } catch (error) {
    if (error instanceof ConfigError) return fail(503, "not_configured", error.message);
    console.error("send-email crashed:", shortError(error));
    return fail(500, "internal", "The email function hit an unexpected error. Anyone already emailed is recorded, so sending again only reaches the rest.");
  }
});
