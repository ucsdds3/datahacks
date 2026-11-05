import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import type { CheckinApplication, RosterEntry } from "./checkin";
import { fetchAllPages } from "./data";
import { isPreview } from "./preview";
import { previewCheckinApplications, previewCheckinRoster, previewOrganizers } from "./checkinPreview";

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

const ROSTER_COLUMNS = "id, application_id, code, name, email, roles, checked_in_at, checked_in_by";
const APPLICATION_COLUMNS = "id, applicant_type, school, organization, wants_travel_stipend, travel_region, travel_method, travel_distance";

/** How often to reload when Realtime isn't connected. */
export const POLL_MS = 30_000;

const rosterPages = (eventId: string, columns: string) =>
  fetchAllPages<RosterEntry>((from, to) =>
    supabase.from("attendees").select(columns).eq("event_id", eventId)
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to) as unknown as Page<RosterEntry>);

export type Roster = { entries: RosterEntry[]; hasWaiver: boolean };

/**
 * The event's check-in roster (public.attendees; organizers only, by RLS).
 * Asks for waiver_signed_at too, and if the database doesn't have that column
 * yet (the waivers migration adds it), loads the rest without it and says so.
 */
export async function fetchCheckinRoster(eventId: string): Promise<Roster> {
  if (isPreview()) return { entries: previewCheckinRoster(), hasWaiver: true };
  try {
    return { entries: await rosterPages(eventId, `${ROSTER_COLUMNS}, waiver_signed_at`), hasWaiver: true };
  } catch {
    return { entries: await rosterPages(eventId, ROSTER_COLUMNS), hasWaiver: false };
  }
}

/** Accepted applications' school, type and travel answers (not essays), for joining to the roster. */
export async function fetchCheckinApplications(eventId: string): Promise<CheckinApplication[]> {
  if (isPreview()) return previewCheckinApplications();
  return fetchAllPages<CheckinApplication>((from, to) =>
    supabase.from("applications").select(APPLICATION_COLUMNS).eq("event_id", eventId).eq("status", "accepted")
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to) as unknown as Page<CheckinApplication>);
}

export type Organizer = { id: string; email: string; first_name: string | null; last_name: string | null };

/**
 * Who did the check-ins (attendees.checked_in_by is a profile id). Organizers
 * can read the profiles of anyone with a role at their event, which covers
 * everyone allowed to check people in. A failure just leaves names blank.
 */
export async function fetchOrganizers(ids: string[]): Promise<Organizer[]> {
  if (ids.length === 0) return [];
  if (isPreview()) return previewOrganizers().filter(o => ids.includes(o.id));
  const { data, error } = await supabase.from("profiles").select("id, email, first_name, last_name").in("id", ids);
  if (error) return [];
  return (data ?? []) as Organizer[];
}

export const organizerName = (o: Organizer | undefined) =>
  !o ? null : [o.first_name, o.last_name].filter(Boolean).join(" ").trim() || o.email;

export type Live = "connecting" | "live" | "polling";

/**
 * The roster, kept current: a Realtime subscription to the event's attendees
 * reloads it (at most every few seconds, so a rush of scans is one reload),
 * and if Realtime can't connect it reloads every 30 seconds instead.
 */
export function useCheckinRoster(eventId: string) {
  const client = useQueryClient();
  const preview = isPreview();
  const [live, setLive] = useState<Live>(preview ? "polling" : "connecting");

  const query = useQuery({
    queryKey: ["organizer-checkin-roster", eventId],
    queryFn: () => fetchCheckinRoster(eventId),
    // Preview has no Realtime: it "checks people in" on each reload, every few seconds.
    refetchInterval: preview ? 4_000 : live === "live" ? false : POLL_MS,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (preview) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reload = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        client.invalidateQueries({ queryKey: ["organizer-checkin-roster", eventId] });
      }, 2_000);
    };
    const channel = supabase
      .channel(`organizer-checkin-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendees", filter: `event_id=eq.${eventId}` }, reload)
      .subscribe(status => {
        if (status === "SUBSCRIBED") {
          setLive("live");
          // Catch anything that happened while connecting.
          reload();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setLive("polling");
        }
      });
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [client, eventId, preview]);

  return { ...query, live };
}

export function useCheckinApplications(eventId: string) {
  return useQuery({
    queryKey: ["organizer-checkin-applications", eventId],
    queryFn: () => fetchCheckinApplications(eventId),
    // Accepted people's schools and travel answers barely change on the day.
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useOrganizers(ids: string[]) {
  const key = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["organizer-checkin-organizers", key],
    queryFn: () => fetchOrganizers(key),
    enabled: key.length > 0,
    staleTime: 10 * 60_000,
  });
}
