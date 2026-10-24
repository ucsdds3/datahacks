import { supabase } from "@/lib/supabaseClient";

/**
 * The event the portal is taking applications for, by its code in the
 * `events` table. Applications, roles and check-in codes are all per event, so
 * for a new year: add the event in Table Editor -> events, then change this.
 * Applications stay closed until that row's `applications_open` is turned on.
 */
export const EVENT_CODE = "DH27BETA";

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

/**
 * Whether the current event takes applications (events.applications_open), and
 * the date to announce while it doesn't (events.applications_open_at, optional).
 * Not cached: an organizer can flip the switch while someone has the page open.
 * The database enforces the switch too; this only decides what the apply pages show.
 */
export type ApplicationWindow = { open: boolean; opensAt: string | null };

export async function fetchApplicationWindow(): Promise<ApplicationWindow> {
  const { data, error } = await supabase
    .from("events")
    .select("applications_open, applications_open_at")
    .eq("code", EVENT_CODE)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No event with code ${EVENT_CODE}. Add it in Supabase: Table Editor -> events.`);
  return { open: data.applications_open === true, opensAt: data.applications_open_at ?? null };
}

/** "Applications open on November 3, 2026" while that's still ahead (Pacific time), otherwise a plain "not open". */
export function closedTitle(opensAt: string | null, now = new Date()): string {
  const when = opensAt ? new Date(opensAt) : null;
  if (!when || Number.isNaN(when.getTime()) || when <= now) return "Applications aren't open right now";
  const date = when.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
  return `Applications open on ${date}`;
}
