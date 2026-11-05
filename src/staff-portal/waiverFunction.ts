import { supabase } from "@/lib/supabaseClient";
import { currentEventId, EVENT_CODE } from "@/portal/event";

/** Calls the docusign-waiver edge function; every call says which event it's for. */
export async function callWaiverFunction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("docusign-waiver", { body: { eventCode: EVENT_CODE, ...body } });
  if (error) {
    const message = await error.context?.json?.().then((b: { error?: string }) => b.error).catch(() => undefined);
    throw new Error(message ?? "Something went wrong talking to DocuSign.");
  }
  return data as T;
}

/** What `status` says: `recorded` when the signature is now on file in the database. */
export type WaiverStatus = { signed: boolean; status?: string; recorded?: boolean };

/**
 * Whether the signed-in person has a waiver on file for this event (public.waivers).
 * Row-level security returns only their own row; only the edge function can write one.
 */
export async function fetchWaiverOnFile(userId: string): Promise<boolean> {
  const eventId = await currentEventId();
  const { data, error } = await supabase
    .from("waivers")
    .select("signed_at")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.signed_at);
}
