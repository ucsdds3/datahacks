// Sends email from the organizer console through the DataHacks Gmail account.
//
// POST { eventId, applicationIds, subject, body, kind? }  ->  { sent, failed: [{ id, error }] }
//
// Only organizers of the event can call it, and it only writes to applications
// in that event: the browser picks who, by application id, but the addresses
// come from the database. So the Gmail password never reaches the browser, and
// the console can't be used to email arbitrary people.
//
// subject and body may use {{first_name}}, {{last_name}}, {{status}}, {{type}}
// and {{code}} (the check-in code, once accepted). With kind "decision", each
// application that was emailed gets decision_emailed_at set.
//
// Secrets (supabase secrets set ...):
//   GMAIL_ADDRESS        the sending account, e.g. info@ds3.club
//   GMAIL_APP_PASSWORD   a Google app password for that account (spaces are fine)
//   SEND_DELAY_SECONDS   pause between emails, to stay under Gmail's limits (default 1)
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Deploy:
//   supabase functions deploy send-email
//   supabase secrets set GMAIL_ADDRESS=info@ds3.club GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
//
// SMTP goes over port 465 (TLS): Supabase Edge Functions block outgoing 25 and 587.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";

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

/** Most recipients one request will send to; the console splits bigger groups. */
const MAX_RECIPIENTS = 200;

type Recipient = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  applicant_type: string;
  status: string;
  code: string | null;
};

const TYPE_LABEL: Record<string, string> = { hacker: "hacker", mentor: "mentor", judge: "judge", hybrid: "mentor and judge" };

const fill = (template: string, r: Recipient) =>
  template.replace(/\{\{\s*(first_name|last_name|status|type|code)\s*\}\}/g, (_, key: string) => {
    switch (key) {
      case "first_name": return r.first_name?.trim() || "there";
      case "last_name": return r.last_name?.trim() ?? "";
      case "status": return r.status;
      case "type": return TYPE_LABEL[r.applicant_type] ?? r.applicant_type;
      case "code": return r.code ?? "";
      default: return "";
    }
  });

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let input: { eventId?: unknown; applicationIds?: unknown; subject?: unknown; body?: unknown; kind?: unknown };
  try {
    input = await req.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  const { eventId, applicationIds, subject, body, kind } = input;
  if (typeof eventId !== "string" || typeof subject !== "string" || typeof body !== "string"
    || !Array.isArray(applicationIds) || !applicationIds.every(id => typeof id === "string")) {
    return json({ error: "Send eventId, applicationIds, subject and body." }, 400);
  }
  if (!subject.trim() || !body.trim()) return json({ error: "The subject and message can't be empty." }, 400);
  if (applicationIds.length === 0) return json({ sent: 0, failed: [] });
  if (applicationIds.length > MAX_RECIPIENTS) {
    return json({ error: `At most ${MAX_RECIPIENTS} recipients per request.` }, 400);
  }

  // Who is asking: the organizer's Supabase session, checked against the event.
  const caller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: isStaff, error: staffError } = await caller.rpc("is_event_staff", { eid: eventId });
  if (staffError) return json({ error: staffError.message }, 401);
  if (isStaff !== true) return json({ error: "Only organizers of this event can send email." }, 403);

  // Recipients come from the database, limited to this event.
  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: rows, error: rowsError } = await admin
    .from("applications")
    .select("id, first_name, last_name, email, applicant_type, status, user_id")
    .eq("event_id", eventId)
    .in("id", applicationIds as string[]);
  if (rowsError) return json({ error: rowsError.message }, 500);

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
  const recipients: Recipient[] = rows.map(r => ({
    id: r.id,
    email: r.email?.trim() || (r.user_id ? profileEmail.get(r.user_id) : null) || null,
    first_name: r.first_name,
    last_name: r.last_name,
    applicant_type: r.applicant_type,
    status: r.status,
    code: codeFor.get(r.id) ?? null,
  }));

  const failed: { id: string; error: string }[] = [];
  const found = new Set(recipients.map(r => r.id));
  for (const id of applicationIds as string[]) {
    if (!found.has(id)) failed.push({ id, error: "Not an application in this event." });
  }

  const from = env("GMAIL_ADDRESS");
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: from, pass: env("GMAIL_APP_PASSWORD").replace(/\s+/g, "") },
  });
  const delayMs = Math.max(0, Number(Deno.env.get("SEND_DELAY_SECONDS") ?? "1")) * 1000;

  let sent = 0;
  const emailed: string[] = [];
  for (const [i, r] of recipients.entries()) {
    if (!r.email) {
      failed.push({ id: r.id, error: "No email address on file." });
      continue;
    }
    if (i > 0 && delayMs) await sleep(delayMs);
    const text = fill(body, r);
    try {
      await transport.sendMail({
        from: `DataHacks <${from}>`,
        to: r.email,
        subject: fill(subject, r),
        text,
        html: `<div style="font-family: sans-serif; line-height: 1.5">${escapeHtml(text).replace(/\r?\n/g, "<br>")}</div>`,
      });
      sent++;
      emailed.push(r.id);
    } catch (error) {
      failed.push({ id: r.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (kind === "decision" && emailed.length) {
    const { error } = await admin
      .from("applications")
      .update({ decision_emailed_at: new Date().toISOString() })
      .in("id", emailed);
    if (error) console.error("Could not record decision_emailed_at:", error.message);
  }

  return json({ sent, failed });
});
