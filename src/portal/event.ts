import { supabase } from "@/lib/supabaseClient";

/**
 * The event the portal is taking applications for, by its code in the
 * `events` table. Applications, roles and check-in codes are all per event, so
 * for a new year: add the event in Table Editor -> events, then change this.
 */
export const EVENT_CODE = "DH26";

let cached: Promise<string> | null = null;

/** The current event's id. Throws if the event is missing, so a form can say so. */
export function currentEventId(): Promise<string> {
  cached ??= (async () => {
    const { data, error } = await supabase.from("events").select("id").eq("code", EVENT_CODE).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`No event with code ${EVENT_CODE}. Add it in Supabase: Table Editor -> events.`);
    return data.id as string;
  })().catch(error => {
    cached = null;
    throw error;
  });
  return cached;
}
