// The Gmail and database side of the "We've received your application" email
// (the rules and wording are in receivedEmail.ts). Shared by the
// send-received-email function and the MCP server's submit tools.
//
// Same account, secrets and email_log as send-email: GMAIL_ADDRESS,
// GMAIL_APP_PASSWORD, SEND_DELAY_SECONDS; SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";
import type { ClaimResult } from "./sendLoop.ts";
import {
  RECEIVED_COLUMNS, receivedKey, sendReceivedEmails, type ReceivedApplication, type ReceivedResult, type ReceivedScope,
} from "./receivedEmail.ts";

export class ConfigError extends Error {}

export const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new ConfigError(`Email isn't configured on the server yet (missing the ${name} secret). Nothing was sent.`);
  return value;
};

/** Bypasses row-level security: only for reads and writes the caller's identity has already scoped. */
export const serviceClient = (): SupabaseClient =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

const dbError = (what: string, error: { code?: string; message?: string }) =>
  new Error(`${what}: ${error.code ?? ""} ${error.message ?? ""}`.trim());

/**
 * Sends whatever is due in the scope (see sendReceivedEmails). Throws
 * ConfigError when there's something to send but Gmail isn't configured, and
 * an Error when the database can't be read; claims, Gmail and marking each
 * email are handled per email and reported in the result.
 */
export async function sendReceived(
  admin: SupabaseClient,
  scope: ReceivedScope,
  options: { startedAt?: number; budgetMs?: number; limit?: number } = {},
): Promise<ReceivedResult> {
  let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
  let from = "";
  try {
    return await sendReceivedEmails({
      due: async (s, limit) => {
        let query = admin
          .from("applications")
          .select(RECEIVED_COLUMNS)
          .eq("status", "submitted")
          .is("received_emailed_at", null);
        if (s.userId !== undefined) query = query.eq("user_id", s.userId);
        if (s.eventId !== undefined) query = query.eq("event_id", s.eventId);
        const { data, error } = await query.order("submitted_at", { ascending: true }).limit(limit);
        if (error) throw dbError("load the applications", error);
        return (data ?? []) as unknown as ReceivedApplication[];
      },
      profileEmails: async userIds => {
        const { data, error } = await admin.from("profiles").select("id, email").in("id", userIds);
        if (error) console.error("profiles:", error.code ?? "", error.message);
        return new Map((data ?? []).filter(p => typeof p.email === "string").map(p => [p.id as string, p.email as string]));
      },
      mlhEvents: async eventIds => {
        // A failed read counts as off: the email then just doesn't mention MLH.
        const { data, error } = await admin.from("events").select("id, mlh_required").in("id", eventIds);
        if (error) console.error("events:", error.code ?? "", error.message);
        return new Set((data ?? []).filter(e => e.mlh_required === true).map(e => e.id as string));
      },
      ready: () => {
        from = env("GMAIL_ADDRESS");
        const password = env("GMAIL_APP_PASSWORD").replace(/\s+/g, "");
        // SMTP over port 465 (TLS): Supabase Edge Functions block outgoing 25 and 587. Settings as in send-email.
        transport = nodemailer.createTransport({
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
      },
      claim: async app => {
        const { data, error } = await admin.rpc("claim_email", {
          p_event_id: app.event_id, p_kind: "received", p_key: receivedKey(app.id), p_application_id: app.id, p_by: null,
        });
        if (error) throw dbError("claim_email", error);
        return data as ClaimResult;
      },
      deliver: async (to, message) => {
        await transport!.sendMail({ from: `DataHacks Team <${from}>`, to, subject: message.subject, text: message.text, html: message.html });
      },
      finish: async (app, ok, error) => {
        const { error: dbErr } = await admin.rpc("finish_email", { p_key: receivedKey(app.id), p_ok: ok, p_error: error ?? null });
        if (dbErr) throw dbError("finish_email", dbErr);
      },
    }, scope, {
      startedAt: options.startedAt ?? Date.now(),
      budgetMs: options.budgetMs ?? Math.max(10, Number(Deno.env.get("SEND_BUDGET_SECONDS") ?? "90")) * 1000,
      delayMs: Math.max(0, Number(Deno.env.get("SEND_DELAY_SECONDS") ?? "1")) * 1000,
      limit: options.limit,
    });
  } finally {
    (transport as { close(): void } | null)?.close();
  }
}

/** How many applications in the event are still due (for the console). Null if it can't be counted. */
export async function countDue(admin: SupabaseClient, eventId: string): Promise<number | null> {
  const { count, error } = await admin
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "submitted")
    .is("received_emailed_at", null);
  if (error) {
    console.error("count due:", error.code ?? "", error.message);
    return null;
  }
  return count ?? 0;
}

/**
 * For the MCP server, right after it submits someone's application: sends
 * their email in the background (the tool answers straight away), and never
 * throws. Anything that goes wrong is logged, and the application stays due,
 * so the portal sends it when they next sign in.
 */
export function sendReceivedInBackground(scope: ReceivedScope): void {
  const task = (async () => {
    try {
      const result = await sendReceived(serviceClient(), scope, { budgetMs: 60_000, limit: 1 });
      if (result.failed.length || result.stopped) console.error("received email not sent:", JSON.stringify({ failed: result.failed, stopped: result.stopped }));
    } catch (error) {
      console.error("received email failed:", error instanceof Error ? error.message : String(error));
    }
  })();
  // Keeps the worker alive until it's done (Supabase Edge Runtime); elsewhere it just runs.
  (globalThis as { EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(task);
}
