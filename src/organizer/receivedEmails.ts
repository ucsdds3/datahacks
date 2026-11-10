import { supabase } from "@/lib/supabaseClient";
import { RECEIVED_EMAIL_FUNCTION } from "@/portal/receivedEmail";
import { functionErrorMessage } from "./errors";
import { isPreview } from "./preview";

// The "We've received your application" emails, from the console's side. They
// go out by themselves (supabase/functions/send-received-email); this is for
// the ones still waiting on Gmail's daily limit or a failed send.

/**
 * Submitted applications in the event that haven't had the email yet. Null
 * when it can't be counted (for instance before the database change that
 * added received_emailed_at is deployed), so the console shows nothing.
 */
export async function countReceivedDue(eventId: string): Promise<number | null> {
  if (isPreview()) return 0;
  try {
    const { count, error } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "submitted")
      .is("received_emailed_at", null);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export type ReceivedSendResult = {
  sent: number;
  failed: { id: string; error: string }[];
  stopped: "daily_limit" | null;
  /** Still waiting after this, as the server counted (null if it couldn't). */
  stillDue: number | null;
};

type Reply = {
  sent?: number;
  failed?: { id: string; error: string }[];
  stopped?: "time" | "daily_limit" | null;
  stillDue?: number | null;
};

export class ReceivedSendError extends Error {
  constructor(message: string, readonly partial: ReceivedSendResult) {
    super(message);
    this.name = "ReceivedSendError";
  }
}

/** Requests at most; each sends up to 40, so this covers thousands. */
const MAX_ROUNDS = 60;

/**
 * Sends every one still due in the event, 40 per request, until none are left,
 * the daily limit stops it, or a request sends nothing (the rest failed, or
 * are being sent by someone else right now). The server picks who and what,
 * and never emails anyone twice, so pressing it again is safe.
 */
export async function sendReceivedDue(eventId: string, onProgress?: (sent: number) => void): Promise<ReceivedSendResult> {
  const total: ReceivedSendResult = { sent: 0, failed: [], stopped: null, stillDue: null };
  if (isPreview()) return { ...total, stillDue: 0 };
  const seen = new Set<string>();
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data, error } = await supabase.functions.invoke(RECEIVED_EMAIL_FUNCTION, { body: { eventId } });
    if (error) {
      const info = await functionErrorMessage(error, "email");
      const message = info.code === "not_deployed"
        ? `The ${RECEIVED_EMAIL_FUNCTION} function isn't deployed yet, so nothing was sent.`
        : info.message;
      throw new ReceivedSendError(message, total);
    }
    const reply = (data ?? {}) as Reply;
    total.sent += reply.sent ?? 0;
    for (const f of reply.failed ?? []) {
      if (!seen.has(f.id)) { seen.add(f.id); total.failed.push(f); }
    }
    total.stillDue = typeof reply.stillDue === "number" ? reply.stillDue : null;
    onProgress?.(total.sent);
    if (reply.stopped === "daily_limit") { total.stopped = "daily_limit"; break; }
    if (!reply.sent || !total.stillDue) break;
  }
  return total;
}
