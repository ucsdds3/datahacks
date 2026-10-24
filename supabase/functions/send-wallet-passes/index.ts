// Emails each accepted attendee their check-in pass, from the organizer console.
//
// The same job as send_emails.py in the check-in repo (DS3-DataHacks-Check-in),
// moved server-side so nobody has to run it from a laptop: it reads the roster
// from public.attendees, makes a WalletWallet pass per person with the same
// design (barcode = attendees.code, which the check-in desk scans), emails it,
// and sets attendees.emailed_at. Either one skips people the other has done.
//
// Each email has the QR code in the body, the .pkpass attached (iPhone Mail
// offers "Add to Apple Wallet"), and Add to Apple Wallet / Add to Google Wallet
// buttons, so it works on Android and laptops too.
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

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";
import QRCode from "npm:qrcode@1.5.4";
import { MAX_PER_REQUEST, outsideEvent, parseApplicationIds } from "./selection.ts";

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

const ROLE_LABELS: Record<string, string> = { hacker: "Hacker", judge: "Judge", mentor: "Mentor" };
const roleLabels = (roles: string[]) => roles.map(r => ROLE_LABELS[r] ?? r).join(", ") || "Attendee";

type Attendee = { id: string; code: string; name: string; email: string; roles: string[]; team: string | null };
type Pass = { applePass: string; googleSaveUrl?: string; shareUrl?: string };

/** The pass design from send_emails.py's build_pass_payload. */
async function createPass(eventName: string, a: Attendee): Promise<Pass> {
  const response = await fetch("https://api.walletwallet.dev/api/passes", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env("WALLETWALLET_API_KEY")}` },
    body: JSON.stringify({
      barcodeValue: a.code,
      barcodeFormat: "QR",
      logoText: eventName,
      organizationName: "DataHacks",
      primaryFields: [{ label: roleLabels(a.roles).toUpperCase(), value: a.name }],
      secondaryFields: [
        { label: "TEAM", value: a.team || "—" },
        { label: "CODE", value: a.code },
      ],
    }),
  });
  if (!response.ok) throw new Error(`WalletWallet ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return await response.json() as Pass;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const button = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 18px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${label}</a>`;

function buildEmail(eventName: string, a: Attendee, pass: Pass) {
  const roles = roleLabels(a.roles);
  const first = a.name.split(" ")[0] || a.name;
  const appleUrl = pass.shareUrl;
  const text = [
    `Hi ${first},`,
    "",
    `You're registered for ${eventName} as a ${roles}. Here's your check-in pass.`,
    "",
    `Your check-in code: ${a.code}`,
    "",
    "Show the QR code in this email (or in your wallet) at the registration desk.",
    "On an iPhone, open the attached pass to add it to Apple Wallet.",
    ...(pass.googleSaveUrl ? [`Android: add it to Google Wallet: ${pass.googleSaveUrl}`] : []),
    ...(appleUrl ? [`Or open ${appleUrl} on your phone.`] : []),
    "",
    "See you there!",
    "The DataHacks Team",
    "info@ds3.club",
  ].join("\n");
  const html = `<div style="font-family:sans-serif;line-height:1.5;color:#111">
<p>Hi ${escapeHtml(first)},</p>
<p>You're registered for ${escapeHtml(eventName)} as a ${escapeHtml(roles)}. Here's your check-in pass.</p>
<img src="cid:checkin-qr" alt="Check-in QR code ${escapeHtml(a.code)}" width="240" height="240" style="display:block;margin:8px 0">
<p>Your check-in code: <strong>${escapeHtml(a.code)}</strong></p>
<p>${appleUrl ? button(appleUrl, "Add to Apple Wallet") : ""}${pass.googleSaveUrl ? button(pass.googleSaveUrl, "Add to Google Wallet") : ""}</p>
<p>Show the QR code at the registration desk. On an iPhone you can also open the attached pass.</p>
<p>See you there!<br>The DataHacks Team<br>info@ds3.club</p>
</div>`;
  return { text, html };
}

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
  const { data: event, error: eventError } = await admin.from("events").select("id, name").eq("id", eventId).single();
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
    else queue.push({ id: r.id, code: String(r.code).toUpperCase(), name: r.name || email, email, roles: r.roles ?? [], team: r.team });
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
      const pass = await createPass(event.name, a);
      const { text, html } = buildEmail(event.name, a, pass);
      await transport.sendMail({
        from: `DataHacks Team <${from}>`,
        to: a.email,
        subject: `Your ${event.name} check-in pass`,
        text,
        html,
        attachments: [
          { filename: `checkin-${a.code}.png`, content: await QRCode.toBuffer(a.code, { width: 480, margin: 2 }), cid: "checkin-qr" },
          { filename: `${a.code}.pkpass`, content: pass.applePass, encoding: "base64", contentType: "application/vnd.apple.pkpass" },
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
