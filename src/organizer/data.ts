import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { currentEventId } from "@/portal/event";
import type { Application, Decision, Row } from "./types";
import { PREVIEW_EVENT_ID, PreviewOnlyError, isPreview, previewRows, previewStage } from "./preview";

const COLUMNS = [
  "id", "user_id", "event_id", "applicant_type", "status", "submitted_at",
  "first_name", "last_name", "email", "phone",
  "school", "level_of_study", "major", "graduation_year",
  "organization", "role_title", "resume_url", "resume_path", "linkedin_url", "devpost_url",
  "judging_track", "bio", "essay_proudest_project", "essay_unique_thing", "essay_goal", "heard_about",
  "gender", "race_ethnicity", "city_of_residence", "country_of_residence", "hackathon_experience", "github_url",
  "wants_travel_stipend", "travel_region", "travel_method", "travel_distance", "travel_stipend_reason",
  "decision", "decision_released_at", "decision_emailed_at",
].join(", ");

export function useEventId() {
  return useQuery({ queryKey: ["current-event"], queryFn: () => (isPreview() ? PREVIEW_EVENT_ID : currentEventId()), staleTime: Infinity });
}

/**
 * Every application at the event, with check-in codes from the attendee roster.
 * Row-level security only returns these to organizers of the event.
 */
export function useApplications(eventId: string | undefined) {
  return useQuery({
    queryKey: ["organizer-applications", eventId],
    enabled: !!eventId,
    queryFn: async (): Promise<Row[]> => {
      if (isPreview()) return previewRows();
      const [apps, attendees] = await Promise.all([
        supabase.from("applications").select(COLUMNS).eq("event_id", eventId!).order("submitted_at", { ascending: true }),
        supabase.from("attendees").select("application_id, code, checked_in_at, emailed_at").eq("event_id", eventId!),
      ]);
      if (apps.error) throw apps.error;
      // The roster is a nice-to-have here: a failure leaves codes and check-ins blank.
      const roster = new Map(
        (attendees.data ?? []).map(a => [a.application_id as string, a as { code: string | null; checked_in_at: string | null; emailed_at: string | null }]),
      );
      return ((apps.data ?? []) as unknown as Application[]).map(app => {
        const entry = roster.get(app.id);
        return { ...app, code: entry?.code ?? null, checkedIn: !!entry?.checked_in_at, passSentAt: entry?.emailed_at ?? null };
      });
    },
  });
}

export function useRefreshApplications() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["organizer-applications"] });
}

/**
 * Stages a decision (or clears it with null). Nothing is sent until decisions are released.
 * Limited to the current event too, so an organizer of several events can't touch another's.
 */
export async function stageDecision(ids: string[], decision: Decision | null) {
  if (ids.length === 0) return;
  if (isPreview()) return previewStage(ids, decision);
  const eventId = await currentEventId();
  const { error } = await supabase.from("applications").update({ decision }).in("id", ids).eq("event_id", eventId);
  if (error) throw error;
}

export type ReleasedRow = { application_id: string; email: string | null; first_name: string | null; applicant_type: string; status: string };

/** Applies every staged decision at the event in one database call. */
export async function releaseDecisions(eventId: string): Promise<ReleasedRow[]> {
  if (isPreview()) throw new PreviewOnlyError();
  const { data, error } = await supabase.rpc("release_decisions", { p_event_id: eventId });
  if (error) throw error;
  return (data ?? []) as ReleasedRow[];
}

export class EmailNotSetUpError extends Error {
  constructor() {
    super("Email sending isn't set up yet. Deploy the send-email function (see supabase/functions/send-email) and try again.");
    this.name = "EmailNotSetUpError";
  }
}

export type SendResult = { sent: number; failed: { id: string; error: string }[] };
export type EmailKind = "decision" | "blast";

export const EMAIL_CHUNK = 200;

/**
 * Sends one subject/body to the given applications through the send-email
 * function, 200 at a time. The function looks up addresses itself, so the
 * browser can only email people at the organizer's own event.
 */
export async function sendEmails(
  eventId: string,
  applicationIds: string[],
  subject: string,
  body: string,
  kind: EmailKind,
  onProgress?: (done: number) => void,
): Promise<SendResult> {
  if (isPreview()) throw new PreviewOnlyError();
  const total: SendResult = { sent: 0, failed: [] };
  for (let i = 0; i < applicationIds.length; i += EMAIL_CHUNK) {
    const chunk = applicationIds.slice(i, i + EMAIL_CHUNK);
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { eventId, applicationIds: chunk, subject, body, kind },
    });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      if (error.name === "FunctionsFetchError" || error.name === "FunctionsRelayError" || status === 404) {
        throw new EmailNotSetUpError();
      }
      let message = error.message;
      try {
        const detail = await (error as { context?: Response }).context?.json();
        if (detail?.error) message = detail.error;
      } catch { /* not JSON */ }
      throw new Error(message);
    }
    const result = (data ?? { sent: 0, failed: [] }) as SendResult;
    total.sent += result.sent ?? 0;
    total.failed.push(...(result.failed ?? []));
    onProgress?.(Math.min(i + EMAIL_CHUNK, applicationIds.length));
  }
  return total;
}

export type WalletPassResult = { sent: number; failed: { code: string; email: string; error: string }[] };
type WalletPassRound = WalletPassResult & { remaining: number };

/** The function's per-request maximum, so each chosen-people request is one round. */
export const WALLET_PASS_CHUNK = 40;

async function walletPassRound(body: Record<string, unknown>): Promise<WalletPassRound> {
  const { data, error } = await supabase.functions.invoke("send-wallet-passes", { body });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (error.name === "FunctionsFetchError" || error.name === "FunctionsRelayError" || status === 404) {
      throw new Error("Wallet passes aren't set up yet. Deploy the send-wallet-passes function (see supabase/functions/send-wallet-passes) and try again.");
    }
    let message = error.message;
    try {
      const detail = await (error as { context?: Response }).context?.json();
      if (detail?.error) message = detail.error;
    } catch { /* not JSON */ }
    throw new Error(message);
  }
  const round = (data ?? {}) as Partial<WalletPassRound>;
  return { sent: round.sent ?? 0, failed: round.failed ?? [], remaining: round.remaining ?? 0 };
}

/**
 * Emails check-in passes through the send-wallet-passes function.
 *
 * With no applicationIds it sends to everyone accepted without a pass, 40 at a
 * time, and stops if a round sends nothing, so a persistent failure (say, a bad
 * address) can't loop forever.
 *
 * With applicationIds it sends to just those people, 40 per request, once
 * each; resend also covers chosen people who already have a pass. An empty
 * list sends nothing.
 */
export async function sendWalletPasses(
  eventId: string,
  onProgress?: (sent: number) => void,
  options: { applicationIds?: string[]; resend?: boolean } = {},
): Promise<WalletPassResult> {
  if (isPreview()) throw new PreviewOnlyError();
  const total: WalletPassResult = { sent: 0, failed: [] };
  const { applicationIds, resend = false } = options;

  if (applicationIds) {
    for (let i = 0; i < applicationIds.length; i += WALLET_PASS_CHUNK) {
      const round = await walletPassRound({ eventId, applicationIds: applicationIds.slice(i, i + WALLET_PASS_CHUNK), resend });
      total.sent += round.sent;
      total.failed.push(...round.failed);
      onProgress?.(total.sent);
    }
    return total;
  }

  for (;;) {
    const round = await walletPassRound({ eventId });
    total.sent += round.sent;
    onProgress?.(total.sent);
    if (round.remaining === 0 || round.sent === 0) {
      total.failed = round.failed;
      return total;
    }
  }
}

/** A short-lived link to a hacker's uploaded resume. */
export async function resumeLink(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("resumes").createSignedUrl(path, 300);
  if (error || !data) throw error ?? new Error("No link returned.");
  return data.signedUrl;
}
