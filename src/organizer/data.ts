import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { currentEventId } from "@/portal/event";
import { LIST_FIELDS, unsentDecisionRows, type Application, type Decision, type ListApplication, type Row } from "./types";
import { PREVIEW_EVENT_ID, PreviewOnlyError, isPreview, previewApplication, previewRows, previewStage } from "./preview";

/** Everything ApplicationDetail shows, loaded for one application at a time. */
const DETAIL_COLUMNS = [
  "id", "user_id", "event_id", "applicant_type", "status", "submitted_at",
  "first_name", "last_name", "email", "phone",
  "school", "level_of_study", "major", "graduation_year",
  "organization", "role_title", "resume_url", "linkedin_url", "devpost_url",
  "judging_track", "bio", "essay_proudest_project", "essay_unique_thing", "essay_goal", "heard_about",
  "gender", "race_ethnicity", "city_of_residence", "country_of_residence", "hackathon_experience", "github_url",
  "wants_travel_stipend", "travel_region", "travel_method", "travel_distance", "travel_stipend_reason",
  "decision", "decision_released_at", "decision_emailed_at",
].join(", ");

const LIST_COLUMNS = LIST_FIELDS.join(", ");

/**
 * Rows per request. Supabase's API returns at most 1,000 rows a request
 * (max_rows) and cuts a longer list short without an error, so this must not
 * be more than that setting.
 */
export const PAGE_SIZE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * Fetches a whole list a page at a time, until a page comes back short.
 * `page(from, to)` gets inclusive row offsets for `.range(from, to)` and must
 * order by a unique key, so pages neither overlap nor skip rows.
 */
export async function fetchAllPages<T>(page: (from: number, to: number) => Page<T>, pageSize = PAGE_SIZE): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }
}

export function useEventId() {
  return useQuery({ queryKey: ["current-event"], queryFn: () => (isPreview() ? PREVIEW_EVENT_ID : currentEventId()), staleTime: Infinity });
}

type RosterEntry = { application_id: string | null; code: string | null; checked_in_at: string | null; emailed_at: string | null };

/** Drafts (no submitted_at) sort last. Array sort is stable, so ties keep their created order. */
const submittedTime = (app: ListApplication) => (app.submitted_at ? Date.parse(app.submitted_at) : Infinity);
const bySubmitted = (a: ListApplication, b: ListApplication) => {
  const [x, y] = [submittedTime(a), submittedTime(b)];
  return x === y ? 0 : x < y ? -1 : 1;
};

/**
 * Every application at the event (the list columns only), with check-in codes
 * from the attendee roster, oldest submission first and drafts last.
 * Row-level security only returns these to organizers of the event.
 *
 * Pages are ordered by created_at then id, which never change and only grow
 * at the end, so a submission arriving mid-load can't shift a row between pages.
 */
export async function fetchApplicationRows(eventId: string): Promise<Row[]> {
  if (isPreview()) return previewRows();
  const [apps, attendees] = await Promise.all([
    fetchAllPages<ListApplication>((from, to) =>
      supabase.from("applications").select(LIST_COLUMNS).eq("event_id", eventId)
        .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to) as unknown as Page<ListApplication>),
    // The roster is a nice-to-have here: a failure leaves codes and check-ins blank.
    fetchAllPages<RosterEntry>((from, to) =>
      supabase.from("attendees").select("application_id, code, checked_in_at, emailed_at").eq("event_id", eventId)
        .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to) as unknown as Page<RosterEntry>)
      .catch(() => [] as RosterEntry[]),
  ]);
  const roster = new Map(attendees.filter(a => a.application_id).map(a => [a.application_id!, a]));
  return apps.sort(bySubmitted).map(app => {
    const entry = roster.get(app.id);
    return { ...app, code: entry?.code ?? null, checkedIn: !!entry?.checked_in_at, passSentAt: entry?.emailed_at ?? null };
  });
}

export function useApplications(eventId: string | undefined) {
  return useQuery({
    queryKey: ["organizer-applications", eventId],
    enabled: !!eventId,
    queryFn: () => fetchApplicationRows(eventId!),
  });
}

/** One whole application (essays and all), for the detail drawer. */
export async function fetchApplication(eventId: string, id: string): Promise<Application> {
  if (isPreview()) {
    const app = previewApplication(id);
    if (!app) throw new Error("That application isn't in the preview.");
    return app;
  }
  const { data, error } = await supabase.from("applications").select(DETAIL_COLUMNS).eq("id", id).eq("event_id", eventId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That application wasn't found. It may have been deleted.");
  return data as unknown as Application;
}

/** Loaded when an organizer opens a row; kept for a few minutes so reopening it is instant. */
export function useApplication(eventId: string | undefined, id: string) {
  return useQuery({
    queryKey: ["organizer-application", eventId, id],
    enabled: !!eventId,
    queryFn: () => fetchApplication(eventId!, id),
    staleTime: 5 * 60_000,
  });
}

export function useRefreshApplications() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["organizer-applications"] });
}

/**
 * Ids per update. The ids go in the URL, and the API answers 400 Bad Request
 * once a URL passes about 16 KB (roughly 430 ids), so accepting 1,500 people at once would fail.
 */
export const STAGE_CHUNK = 100;

/**
 * Stages a decision (or clears it with null). Nothing is sent until decisions are released.
 * Limited to the current event too, so an organizer of several events can't touch another's.
 */
export async function stageDecision(ids: string[], decision: Decision | null) {
  if (ids.length === 0) return;
  if (isPreview()) return previewStage(ids, decision);
  const eventId = await currentEventId();
  for (let i = 0; i < ids.length; i += STAGE_CHUNK) {
    const { error } = await supabase.from("applications").update({ decision }).in("id", ids.slice(i, i + STAGE_CHUNK)).eq("event_id", eventId);
    if (error) throw error;
  }
}

export type ReleasedRow = { application_id: string; email: string | null; first_name: string | null; applicant_type: string; status: string };

/**
 * Applies every staged decision at the event in one database call, and says
 * who was released so they can be emailed.
 *
 * The call's reply is capped at 1,000 rows like any other, though every staged
 * decision is applied. When it comes back full, the rest are found by loading
 * the list again: released, not emailed, and not already in that state before
 * (`unsentBefore`, the ids unsentDecisionRows gave before releasing). If that
 * load fails, they still show under "Send unsent decision emails".
 */
export async function releaseDecisions(eventId: string, unsentBefore: Iterable<string> = []): Promise<ReleasedRow[]> {
  if (isPreview()) throw new PreviewOnlyError();
  const { data, error } = await supabase.rpc("release_decisions", { p_event_id: eventId });
  if (error) throw error;
  const released = (data ?? []) as ReleasedRow[];
  if (released.length < PAGE_SIZE) return released;
  try {
    const skip = new Set([...unsentBefore, ...released.map(r => r.application_id)]);
    const rest = unsentDecisionRows(await fetchApplicationRows(eventId)).filter(r => !skip.has(r.id));
    return [...released, ...rest.map(r => ({ application_id: r.id, email: r.email, first_name: r.first_name, applicant_type: r.applicant_type, status: r.status! }))];
  } catch {
    return released;
  }
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

const notSetUp = (error: { name: string; context?: { status?: number } }) =>
  error.name === "FunctionsFetchError" || error.name === "FunctionsRelayError" || error.context?.status === 404;

const NOT_SET_UP = "Wallet passes aren't set up yet. Deploy the send-wallet-passes function (see supabase/functions/send-wallet-passes) and try again.";

/**
 * Before sending to chosen people, makes sure the deployed function knows
 * applicationIds. An older one ignores the list and would email everyone
 * without a pass, so it's refused here and nothing is sent.
 */
async function checkCanChoose() {
  const { data, error } = await supabase.functions.invoke("send-wallet-passes", { method: "GET" });
  if (error && notSetUp(error)) throw new Error(NOT_SET_UP);
  if (error || (data as { applicationIds?: unknown } | null)?.applicationIds !== true) {
    throw new Error("The deployed send-wallet-passes function can't send to chosen people yet. Deploy the latest version and try again. Nothing was sent.");
  }
}

async function walletPassRound(body: Record<string, unknown>): Promise<WalletPassRound> {
  const { data, error } = await supabase.functions.invoke("send-wallet-passes", { body });
  if (error) {
    if (notSetUp(error)) throw new Error(NOT_SET_UP);
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
 * each, after checking the deployed function supports that; resend also
 * covers chosen people who already have a pass. An empty list sends nothing.
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
    if (applicationIds.length > 0) await checkCanChoose();
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
