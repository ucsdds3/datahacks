import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { sendEmails, sendWalletPasses, type SendResult } from "./data";
import { PreviewOnlyError, isPreview } from "./preview";
import type { Template } from "./templates";
import { previewMarkNoShows, previewOverview, previewSaveSettings, previewUnmark } from "./dayOfPreview";

/**
 * The console's Day-of section: check-in cutoffs, releasing no-shows' spots,
 * and offering them to the waitlist. The rules live in the database
 * (migration *_waitlist_release.sql); this file reads them and words them.
 *
 *   open spots   capacity - hackers checked in - accepted hackers still expected
 *   no-show      accepted, not checked in, past their deadline, marked by an organizer
 *   queue        waitlisted hackers who opted in, in the order they asked for a spot
 *                (waitlist_opt_in_at; ties by when they submitted their application)
 */

export const EVENT_TIME_ZONE = "America/Los_Angeles";

export type DaySettings = {
  hacker_capacity: number | null;
  checkin_cutoff_at: string | null;
  ucsd_checkin_cutoff_at: string | null;
  offer_window_minutes: number;
};

export type AbsentHacker = {
  application_id: string; name: string; email: string | null; code: string | null;
  ucsd: boolean; deadline: string | null; past_deadline: boolean; offered_at: string | null;
};
export type NoShow = { application_id: string; name: string; email: string | null; code: string | null; no_show_at: string };
export type QueuedHacker = { application_id: string; name: string; email: string | null; submitted_at: string | null; opted_in_at: string };
export type Offer = {
  application_id: string; name: string; email: string | null; code: string | null;
  offered_at: string; expires_at: string; emailed_at: string | null; checked_in_at: string | null; no_show_at: string | null;
};

/** waitlist_overview(event): everything the Day-of page shows. */
export type Overview = {
  now: string;
  settings: DaySettings;
  checked_in: number;
  expected: number;
  /** null until a capacity is set. */
  open_spots: number | null;
  waitlisted: number;
  absent: AbsentHacker[];
  no_shows: NoShow[];
  queue: QueuedHacker[];
  offers: Offer[];
};

/** Who "Mark no-shows" would mark: accepted, not checked in, past their deadline. */
export const markable = (o: Overview) => o.absent.filter(a => a.past_deadline);

/** Open spots once those are marked (they stop holding a spot). null without a capacity. */
export function openAfterMarking(o: Overview): number | null {
  const cap = o.settings.hacker_capacity;
  if (cap === null) return null;
  return Math.max(cap - o.checked_in - (o.expected - markable(o).length), 0);
}

/** Exactly who "Offer N spots" gives a spot to right now: the front of the queue, one per open spot. */
export const nextOffers = (o: Overview) => o.queue.slice(0, Math.max(o.open_spots ?? 0, 0));

/** Offers whose email didn't go out (it failed, or the page was closed mid-send). */
export const unemailedOffers = (o: Overview) => o.offers.filter(x => !x.emailed_at && !x.checked_in_at && !x.no_show_at);

export type Phase = "no-settings" | "before-cutoff" | "after-cutoff";

/** Before the first cutoff nobody can be a no-show yet; once any cutoff passes, some can. */
export function phaseOf(o: Overview, now = new Date(o.now)): Phase {
  const { checkin_cutoff_at: general, ucsd_checkin_cutoff_at: ucsd } = o.settings;
  if (!general || o.settings.hacker_capacity === null) return "no-settings";
  const first = Math.min(...[general, ucsd].filter((x): x is string => !!x).map(x => Date.parse(x)));
  return now.getTime() >= first ? "after-cutoff" : "before-cutoff";
}

// --- Event-local (Pacific) times ------------------------------------------

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE, hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

function zoned(date: Date) {
  const p = Object.fromEntries(PARTS.formatToParts(date).map(x => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** An instant as a <input type="datetime-local"> value in event time ("2027-01-16T10:30"). */
export function toEventInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const z = zoned(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${z.y}-${pad(z.mo)}-${pad(z.d)}T${pad(z.h)}:${pad(z.mi)}`;
}

/** A datetime-local value read as event time, to an ISO instant. "" gives null. */
export function fromEventInput(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // The zone's offset at that wall time: guess, then correct once (covers DST changes).
  let t = wall;
  for (let i = 0; i < 2; i++) {
    const z = zoned(new Date(t));
    const offset = Date.UTC(z.y, z.mo - 1, z.d, z.h, z.mi, z.s) - t;
    t = wall - offset;
  }
  return new Date(t).toISOString();
}

/** "11:30 AM", in event time. */
export const eventTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: EVENT_TIME_ZONE });

/** "Sat, Jan 16, 11:30 AM", in event time. */
export const eventDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: EVENT_TIME_ZONE });

// --- The "a spot opened up" email (SPOT_OFFER_TEMPLATE in templates.ts) ---

/** Fills {{deadline}} (send-email doesn't know it); everyone in one batch has the same one. */
export const withDeadline = (t: Template, deadlineIso: string): Template => {
  const fill = (s: string) => s.replace(/\{\{\s*deadline\s*\}\}/g, eventTime(deadlineIso));
  return { subject: fill(t.subject), body: fill(t.body) };
};

// --- Data ------------------------------------------------------------------

export async function fetchOverview(eventId: string): Promise<Overview> {
  if (isPreview()) return previewOverview();
  const { data, error } = await supabase.rpc("waitlist_overview", { p_event_id: eventId });
  if (error) throw error;
  return data as Overview;
}

/** Reloads every 30 seconds, since check-ins keep landing while the page is open. */
export function useOverview(eventId: string) {
  return useQuery({ queryKey: ["waitlist-overview", eventId], queryFn: () => fetchOverview(eventId), refetchInterval: 30_000 });
}

export async function saveSettings(eventId: string, s: DaySettings) {
  if (isPreview()) return previewSaveSettings(s);
  const { error } = await supabase.from("event_day_settings").upsert({ event_id: eventId, ...s }, { onConflict: "event_id" });
  if (error) throw error;
}

export async function markNoShows(eventId: string): Promise<{ application_id: string; name: string }[]> {
  if (isPreview()) return previewMarkNoShows();
  const { data, error } = await supabase.rpc("mark_no_shows", { p_event_id: eventId });
  if (error) throw error;
  return data ?? [];
}

export async function unmarkNoShows(eventId: string, ids: string[]): Promise<number> {
  if (isPreview()) return previewUnmark(ids);
  const { data, error } = await supabase.rpc("unmark_no_shows", { p_event_id: eventId, p_application_ids: ids });
  if (error) throw error;
  return data ?? 0;
}

export type Offered = { application_id: string; name: string; email: string | null; code: string | null; offer_expires_at: string };

export async function offerSpots(eventId: string, count: number): Promise<Offered[]> {
  if (isPreview()) throw new PreviewOnlyError();
  const { data, error } = await supabase.rpc("offer_waitlist_spots", { p_event_id: eventId, p_count: count });
  if (error) throw error;
  return data ?? [];
}

export type OfferEmailOutcome = {
  emailed: number;
  emailFailed: SendResult["failed"];
  emailError: string | null;
  passesSent: number;
  passesFailed: number;
  passError: string | null;
};

/**
 * Emails people who were just given a spot, then their wallet passes (the pass
 * shouldn't arrive first), and records who got the email so a failure can be
 * retried from the page. Grouped by deadline, since that's in the email.
 */
export async function emailOffers(
  eventId: string,
  people: { application_id: string; expires_at: string }[],
  template: Template,
  onProgress: (text: string) => void = () => {},
): Promise<OfferEmailOutcome> {
  if (isPreview()) throw new PreviewOnlyError();
  const out: OfferEmailOutcome = { emailed: 0, emailFailed: [], emailError: null, passesSent: 0, passesFailed: 0, passError: null };
  const byDeadline = new Map<string, string[]>();
  for (const p of people) byDeadline.set(p.expires_at, [...(byDeadline.get(p.expires_at) ?? []), p.application_id]);

  const emailed: string[] = [];
  try {
    for (const [deadline, ids] of byDeadline) {
      onProgress(`Emailing ${ids.length} ${ids.length === 1 ? "person" : "people"}…`);
      const t = withDeadline(template, deadline);
      const result = await sendEmails(eventId, ids, t.subject, t.body, "decision");
      const failed = new Set(result.failed.map(f => f.id));
      emailed.push(...ids.filter(id => !failed.has(id)));
      out.emailFailed.push(...result.failed);
    }
  } catch (e) {
    out.emailError = e instanceof Error ? e.message : String(e);
  }
  out.emailed = emailed.length;
  if (emailed.length === 0) return out;

  const { error } = await supabase.from("applications").update({ waitlist_offer_emailed_at: new Date().toISOString() })
    .in("id", emailed).eq("event_id", eventId);
  if (error) console.error("Could not record waitlist_offer_emailed_at:", error.message);

  try {
    onProgress("Sending wallet passes…");
    const passes = await sendWalletPasses(eventId, n => onProgress(`Sending wallet passes (${n} of ${emailed.length})…`), { applicationIds: emailed });
    out.passesSent = passes.sent;
    out.passesFailed = passes.failed.length;
  } catch (e) {
    out.passError = e instanceof Error ? e.message : String(e);
  }
  return out;
}
