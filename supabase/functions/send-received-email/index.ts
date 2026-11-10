// Sends the "We've received your DataHacks 2027 application" email.
//
// POST {}           the caller's own submitted applications that haven't had it
//                   (the hacker and mentor/judge forms call this right after
//                   submitting, and the portal calls it again when it loads
//                   and the application still hasn't had one)
// POST { eventId }  organizers of that event: every submitted application in
//                   it that hasn't had one, 40 per request (the console's
//                   Email page, for anything left waiting on Gmail's daily
//                   limit or a failed send)
//   -> { sent, due, skipped, failed, stopped, unrecorded, stillDue?, quota? }
//
// Who gets what is decided here, from the database: the caller is whoever
// their Supabase session says (checked with the Auth server), the application
// is their own row with status 'submitted', the address is the sign-in email on
// it, and the wording is built from that row (_shared/receivedEmail.ts).
// Nothing in the request can choose an address, a name or any text, so it
// can't be used to email anyone else.
//
// Exactly one per application, ever: each email is claimed in public.email_log
// (key received:<application id>) before it's sent, and finish_email sets
// applications.received_emailed_at in the same transaction that marks it sent.
// A second tab, a double click or a retry gets "busy" or "sent" and sends
// nothing. Claims count towards email_daily_limit() like every other email; at
// the limit (or if Gmail fails) nothing is marked, so the application stays
// due and the portal or the console tries again later. Migration
// *_received_email.sql has the details and the backfill for earlier applicants.
//
// The MCP server's submit tools send the same email through the same code
// (_shared/receivedSend.ts), not through this function.
//
// Secrets: the same as send-email (GMAIL_ADDRESS, GMAIL_APP_PASSWORD,
// SEND_DELAY_SECONDS, SEND_BUDGET_SECONDS). SUPABASE_URL, SUPABASE_ANON_KEY
// and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Deploy: merging to main (it's in FUNCTIONS in .github/workflows/supabase-deploy.yml),
// or by hand: supabase functions deploy send-received-email

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { requestScope } from "../_shared/receivedEmail.ts";
import { ConfigError, countDue, env, sendReceived, serviceClient } from "../_shared/receivedSend.ts";
import { shortError } from "../_shared/sendLoop.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const fail = (status: number, code: string, error: string) => json({ error, code }, status);

/** Most applications one organizer request sends; the console asks again for the rest. */
const EVENT_BATCH = 40;

async function handle(req: Request): Promise<Response> {
  const startedAt = Date.now();
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail(405, "method", "Method not allowed");

  let body: unknown = {};
  try {
    const raw = await req.text();
    body = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return fail(400, "bad_request", "Expected a JSON body.");
  }

  // Who is asking: their Supabase session, verified by the Auth server.
  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  const caller = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who, error: authError } = token ? await caller.auth.getUser(token) : { data: null, error: null };
  if (authError) console.error("getUser:", authError.status ?? "", authError.message);

  const plan = await requestScope(body, {
    userId: who?.user?.id ?? null,
    isStaff: async eventId => {
      const { data, error } = await caller.rpc("is_event_staff", { eid: eventId });
      if (error) {
        console.error("is_event_staff:", error.code, error.message);
        return false;
      }
      return data === true;
    },
  });
  if (!plan.ok) return fail(plan.status, plan.code, plan.error);

  const admin = serviceClient();
  const forEvent = plan.scope.userId === undefined;
  let result;
  try {
    result = await sendReceived(admin, plan.scope, forEvent ? { startedAt, limit: EVENT_BATCH } : { startedAt, budgetMs: 60_000, limit: 5 });
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    console.error("send-received-email:", shortError(error));
    return fail(500, "db_error", "Couldn't load the applications from the database, so nothing was sent. Try again in a minute.");
  }

  const reply = {
    sent: result.sent.length,
    due: result.due,
    skipped: result.skipped,
    failed: result.failed,
    stopped: result.stopped,
    unrecorded: result.unrecorded,
  };
  if (!forEvent) return json(reply);

  const [stillDue, used, limit] = await Promise.all([
    countDue(admin, plan.scope.eventId!),
    admin.rpc("email_sends_last_day"),
    admin.rpc("email_daily_limit"),
  ]);
  const quota = used.error || limit.error
    ? null
    : { used: used.data as number, limit: limit.data as number, remaining: Math.max(0, (limit.data as number) - (used.data as number)) };
  return json({ ...reply, stillDue, quota });
}

Deno.serve(async req => {
  try {
    return await handle(req);
  } catch (error) {
    if (error instanceof ConfigError) return fail(503, "not_configured", error.message);
    console.error("send-received-email crashed:", shortError(error));
    return fail(500, "internal", "The email function hit an unexpected error. Anyone already emailed is recorded, so trying again only reaches the rest.");
  }
});
