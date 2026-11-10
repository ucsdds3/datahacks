import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { currentEventId } from "@/portal/event";
import { errorText, functionErrorMessage } from "./errors";
import { LIST_FIELDS, NO_REVIEW, type Application, type Decision, type ListApplication, type MlhConsent, type Review, type Row } from "./types";
import { MLH_EXPORT_COLUMNS, type MlhExportApp } from "./mlhExport";
import { STATS_FIELDS, type StatsRow } from "./stats";
import {
  PREVIEW_EVENT_ID, isPreview, previewApplication, previewMlhExport, previewQuota, previewRelease, previewRows, previewSendEmails,
  previewSendPasses, previewStage,
} from "./preview";

/** Everything ApplicationDetail shows, loaded for one application at a time. */
const DETAIL_COLUMNS = [
  "id", "user_id", "event_id", "applicant_type", "status", "submitted_at",
  "first_name", "last_name", "email", "phone",
  "school", "level_of_study", "major", "graduation_year",
  "organization", "role_title", "resume_url", "linkedin_url", "devpost_url",
  "judging_track", "bio", "essay_proudest_project", "essay_unique_thing", "essay_goal",
  "suggested_food", "suggested_activity", "heard_about",
  "gender", "race_ethnicity", "city_of_residence", "country_of_residence", "hackathon_experience", "github_url",
  "wants_travel_stipend", "travel_region", "travel_method", "travel_distance", "travel_stipend_reason",
  "decision_released_at", "decision_emailed_at",
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

type RosterEntry = { application_id: string | null; code: string | null; checked_in_at: string | null; emailed_at: string | null; waiver_signed_at?: string | null };

const ROSTER_COLUMNS = "application_id, code, checked_in_at, emailed_at";

/** The check-in roster, a page at a time; `withWaiver` adds attendees.waiver_signed_at. */
const fetchRoster = (eventId: string, withWaiver: boolean) =>
  fetchAllPages<RosterEntry>((from, to) =>
    supabase.from("attendees").select(withWaiver ? `${ROSTER_COLUMNS}, waiver_signed_at` : ROSTER_COLUMNS).eq("event_id", eventId)
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to) as unknown as Page<RosterEntry>);

type StagedDecision = { id: string; decision: Decision | null; version: number; decided_at: string | null; decided_by: string | null };

const missingFunction = (error: { code?: string; message?: string } | null, name: string) =>
  !!error && (error.code === "PGRST202" || error.code === "42883" || (error.message ?? "").includes(name));

/**
 * The review columns (decision, who decided, when, version) for the event.
 * Applicants can't read them, so they come from the staged_decisions function
 * rather than the rows. On a database from before that function, the
 * decision is still a plain column.
 */
async function fetchReviews(eventId: string): Promise<Map<string, Review>> {
  const { data, error } = await supabase.rpc("staged_decisions", { p_event_id: eventId });
  if (error) {
    if (!missingFunction(error, "staged_decisions")) throw error;
    const rows = await fetchAllPages<{ id: string; decision: Decision | null }>((from, to) =>
      supabase.from("applications").select("id, decision").eq("event_id", eventId).not("decision", "is", null)
        .order("id", { ascending: true }).range(from, to) as unknown as Page<{ id: string; decision: Decision | null }>);
    return new Map(rows.map(r => [r.id, { ...NO_REVIEW, decision: r.decision }]));
  }
  return new Map(((data ?? []) as StagedDecision[]).map(r => [r.id, {
    decision: r.decision, decided_by: r.decided_by, decided_at: r.decided_at, decision_version: r.version ?? 0,
  }]));
}

type MlhRow = { id: string; mlh_code_of_conduct_at: string | null; mlh_data_sharing_at: string | null; mlh_emails_opt_in: boolean | null };

/**
 * Hackers' MLH agreements (docs/mlh.md), by application id. Empty on a
 * database from before MLH's columns (or if the read fails): the console
 * then just shows no MLH consent.
 */
async function fetchMlhConsent(eventId: string): Promise<Map<string, MlhConsent>> {
  try {
    const rows = await fetchAllPages<MlhRow>((from, to) =>
      supabase.from("applications").select("id, mlh_code_of_conduct_at, mlh_data_sharing_at, mlh_emails_opt_in")
        .eq("event_id", eventId).eq("applicant_type", "hacker")
        .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to) as unknown as Page<MlhRow>);
    return new Map(rows.map(r => [r.id, { codeOfConductAt: r.mlh_code_of_conduct_at, dataSharingAt: r.mlh_data_sharing_at, emailsOptIn: r.mlh_emails_opt_in === true }]));
  } catch {
    return new Map();
  }
}

/** What the MLH export needs for every hacker who agreed to share their data with MLH. */
export async function fetchMlhExport(eventId: string): Promise<MlhExportApp[]> {
  if (isPreview()) return previewMlhExport();
  return fetchAllPages<MlhExportApp>((from, to) =>
    supabase.from("applications").select(MLH_EXPORT_COLUMNS)
      .eq("event_id", eventId).eq("applicant_type", "hacker").eq("mlh_data_sharing", true)
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to) as unknown as Page<MlhExportApp>);
}

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
  const [apps, reviews, attendees, mlh] = await Promise.all([
    fetchAllPages<Omit<ListApplication, keyof Review>>((from, to) =>
      supabase.from("applications").select(LIST_COLUMNS).eq("event_id", eventId)
        .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to) as unknown as Page<Omit<ListApplication, keyof Review>>),
    fetchReviews(eventId),
    // The roster is a nice-to-have here: a failure leaves codes and check-ins blank.
    // A database without the waiver column yet (it's added by a migration) still loads the rest.
    fetchRoster(eventId, true)
      .catch(() => fetchRoster(eventId, false))
      .catch(() => [] as RosterEntry[]),
    fetchMlhConsent(eventId),
  ]);
  const roster = new Map(attendees.filter(a => a.application_id).map(a => [a.application_id!, a]));
  return apps.map(app => ({ ...app, ...(reviews.get(app.id) ?? NO_REVIEW) }) as ListApplication).sort(bySubmitted).map(app => {
    const entry = roster.get(app.id);
    const consent = mlh.get(app.id);
    return {
      ...app, code: entry?.code ?? null, checkedIn: !!entry?.checked_in_at, passSentAt: entry?.emailed_at ?? null, waiverSignedAt: entry?.waiver_signed_at ?? null,
      ...(consent ? { mlh: consent } : {}),
    };
  });
}

export function useApplications(eventId: string | undefined) {
  return useQuery({
    queryKey: ["organizer-applications", eventId],
    enabled: !!eventId,
    queryFn: () => fetchApplicationRows(eventId!),
  });
}

export type StatsData = {
  rows: StatsRow[];
  /** Whether the check-in roster could be read (check-in counts are left out if not). */
  hasRoster: boolean;
};

const STATS_COLUMNS = STATS_FIELDS.join(", ");

/**
 * What the Stats page counts: every application at the event (the answers it
 * tallies, no names, emails or essays), each with its decision and whether
 * they've checked in. A page at a time, like the tables.
 */
export async function fetchStats(eventId: string): Promise<StatsData> {
  // Dev ?preview: a made-up application season, loaded only in the preview.
  if (isPreview()) return (await import("./statsPreview")).previewStats();
  type StatsColumns = Omit<StatsRow, "decision" | "checkedIn">;
  const [apps, reviews, roster] = await Promise.all([
    fetchAllPages<StatsColumns>((from, to) =>
      supabase.from("applications").select(STATS_COLUMNS).eq("event_id", eventId)
        .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to) as unknown as Page<StatsColumns>),
    fetchReviews(eventId),
    // Check-in counts are extra: without the roster the rest still shows.
    fetchRoster(eventId, false).catch(() => null),
  ]);
  const checkedIn = new Set((roster ?? []).filter(a => a.application_id && a.checked_in_at).map(a => a.application_id!));
  return {
    rows: apps.map(app => ({ ...app, decision: reviews.get(app.id)?.decision ?? null, checkedIn: checkedIn.has(app.id) })),
    hasRoster: roster !== null,
  };
}

/** How often the Stats page reloads while it's open and the browser tab is showing. */
export const STATS_REFRESH_MS = 60_000;

export function useStats(eventId: string | undefined) {
  return useQuery({
    queryKey: ["organizer-stats", eventId],
    enabled: !!eventId,
    queryFn: () => fetchStats(eventId!),
    refetchInterval: STATS_REFRESH_MS,
    // Paused while the browser tab is hidden; coming back to it reloads.
    refetchIntervalInBackground: false,
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
  // The review columns come from the table's row (staged_decisions), not from here.
  return { ...NO_REVIEW, ...(data as object) } as unknown as Application;
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

/** Ids per stage_decisions call (they go in the request body). */
export const STAGE_CHUNK = 500;

export type StageConflict = { id: string; decision: Decision | null; decided_by: string | null; decided_at: string | null; version: number };
export type StageOutcome = {
  updated: { id: string; version: number }[];
  /** Changed by someone else since this page loaded, so left alone. */
  conflicts: StageConflict[];
  /** Not submitted, so they can't get a decision. */
  drafts: string[];
  missing: string[];
};

/**
 * Stages a decision (or clears it with null) for each row. Nothing is sent
 * until decisions are released. Each row carries the decision_version this
 * page loaded; a row someone else changed since comes back in `conflicts`
 * and keeps their decision. Limited to the current event too, so an organizer
 * of several events can't touch another's.
 */
export async function stageDecision(items: { id: string; decision_version?: number }[], decision: Decision | null): Promise<StageOutcome> {
  const outcome: StageOutcome = { updated: [], conflicts: [], drafts: [], missing: [] };
  if (items.length === 0) return outcome;
  if (isPreview()) return previewStage(items, decision);
  const eventId = await currentEventId();
  for (let i = 0; i < items.length; i += STAGE_CHUNK) {
    const chunk = items.slice(i, i + STAGE_CHUNK);
    const { data, error } = await supabase.rpc("stage_decisions", {
      p_event_id: eventId,
      p_ids: chunk.map(r => r.id),
      p_decision: decision,
      p_versions: chunk.every(r => typeof r.decision_version === "number") ? chunk.map(r => r.decision_version) : null,
    });
    if (error) throw error;
    const part = data as StageOutcome;
    outcome.updated.push(...(part.updated ?? []));
    outcome.conflicts.push(...(part.conflicts ?? []));
    outcome.drafts.push(...(part.drafts ?? []));
    outcome.missing.push(...(part.missing ?? []));
  }
  return outcome;
}

const DECISION_WORD: Record<Decision, string> = { accepted: "Accepted", waitlisted: "Waitlisted", rejected: "Rejected" };

/** What to tell the organizer about rows stage_decisions didn't change, or null if it changed them all. */
export function stageProblems(outcome: StageOutcome, nameOf: (id: string) => string): string | null {
  const parts: string[] = [];
  if (outcome.conflicts.length) {
    const who = outcome.conflicts.slice(0, 3).map(c => {
      const now = c.decision ? DECISION_WORD[c.decision] : "no decision";
      const by = c.decided_by ? ` by ${c.decided_by}` : "";
      const at = c.decided_at ? ` at ${new Date(c.decided_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "";
      return `${nameOf(c.id)} (now ${now}${by}${at})`;
    }).join("; ");
    parts.push(`Someone else changed ${outcome.conflicts.length === 1 ? "this application" : `${outcome.conflicts.length} of these`} since your page loaded, so ${outcome.conflicts.length === 1 ? "it wasn't" : "they weren't"} changed: ${who}${outcome.conflicts.length > 3 ? "; …" : ""}. The list is reloaded; check and try again.`);
  }
  if (outcome.drafts.length) parts.push(`${outcome.drafts.length === 1 ? "1 hasn't" : `${outcome.drafts.length} haven't`} submitted yet (Draft), so can't get a decision.`);
  if (outcome.missing.length) parts.push(`${outcome.missing.length} ${outcome.missing.length === 1 ? "wasn't" : "weren't"} found at this event.`);
  return parts.length ? parts.join(" ") : null;
}

export type ReleasedRow = { application_id: string; email: string | null; first_name: string | null; applicant_type: string; status: string };

/** Ids per release call: each reply stays under the API's 1,000-row cap. */
export const RELEASE_CHUNK = 500;

export class ReleaseError extends Error {
  constructor(message: string, readonly released: ReleasedRow[]) {
    super(message);
    this.name = "ReleaseError";
  }
}

/**
 * Releases exactly these staged decisions (the ones the dialog showed), each
 * only if its decision_version is still the one shown: a decision someone else
 * changed since is left staged and comes back in notReleased, as does anything
 * already released. Drafts are never released.
 */
export async function releaseDecisions(
  eventId: string,
  targets: { id: string; decision_version: number }[],
): Promise<{ released: ReleasedRow[]; notReleased: string[] }> {
  if (isPreview()) return previewRelease(targets);
  const released: ReleasedRow[] = [];
  for (let i = 0; i < targets.length; i += RELEASE_CHUNK) {
    const chunk = targets.slice(i, i + RELEASE_CHUNK);
    const { data, error } = await supabase.rpc("release_decisions", {
      p_event_id: eventId, p_ids: chunk.map(t => t.id), p_versions: chunk.map(t => t.decision_version),
    });
    if (error) throw new ReleaseError(errorText(error), released);
    released.push(...((data ?? []) as ReleasedRow[]));
  }
  const done = new Set(released.map(r => r.application_id));
  return { released, notReleased: targets.map(t => t.id).filter(id => !done.has(id)) };
}

export type Quota = { used: number; limit: number; remaining: number; frees_at?: string | null };

/** How many emails the Gmail account can still send in the last-24-hours window (null if unknown). */
export function useEmailQuota(eventId: string | undefined) {
  return useQuery({
    queryKey: ["email-quota", eventId],
    enabled: !!eventId,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<Quota | null> => {
      if (isPreview()) return previewQuota();
      const { data, error } = await supabase.rpc("email_quota", { p_event_id: eventId });
      if (error) return null;
      return data as Quota;
    },
  });
}

export function useRefreshQuota() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["email-quota"] });
}

export type SkipReason = "already_sent" | "in_progress";

export type SendResult = {
  sent: number;
  /** Already had this email (or someone else is sending it right now): not sent again. */
  skipped: { id: string; reason: SkipReason }[];
  failed: { id: string; error: string }[];
  /** Not tried: the daily limit was reached (stopped), or the send failed partway (SendError). */
  notSent: string[];
  stopped: "daily_limit" | null;
  quota: Quota | null;
};

const emptyResult = (): SendResult => ({ sent: 0, skipped: [], failed: [], notSent: [], stopped: null, quota: null });

/** A send that failed partway: what went out before it failed, and who wasn't tried. */
export class SendError extends Error {
  constructor(message: string, readonly partial: SendResult, readonly code: string | null = null) {
    super(message);
    this.name = "SendError";
  }
}

export type EmailKind = "decision" | "offer" | "blast";

/**
 * Recipients per request. The function also stops itself after about 90 s
 * and hands back whoever it didn't get to, which go in the next request.
 */
export const EMAIL_CHUNK = 40;

type SendReply = {
  sent?: number;
  skipped?: { id: string; reason: SkipReason }[];
  failed?: { id: string; error: string }[];
  remaining?: string[];
  stopped?: "time" | "daily_limit" | null;
  quota?: Quota | null;
};

/**
 * Sends one subject/body to the given applications through the send-email
 * function, 40 at a time. The function looks up addresses itself, so the
 * browser can only email people at the organizer's own event, and it records
 * each email the moment it's sent, so calling this again for the same people
 * only reaches those who haven't had it. expectStatus (decisions) skips anyone
 * whose released decision isn't that one.
 */
export async function sendEmails(
  eventId: string,
  applicationIds: string[],
  subject: string,
  body: string,
  kind: EmailKind,
  onProgress?: (done: number) => void,
  options: { expectStatus?: Decision } = {},
): Promise<SendResult> {
  if (isPreview()) return previewSendEmails(applicationIds, kind, onProgress);
  const total = emptyResult();
  const queue = [...applicationIds];
  let done = 0;
  let stalled = 0;
  while (queue.length > 0) {
    const chunk = queue.splice(0, EMAIL_CHUNK);
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { eventId, applicationIds: chunk, subject, body, kind, ...(options.expectStatus ? { expectStatus: options.expectStatus } : {}) },
    });
    if (error) {
      const info = await functionErrorMessage(error, "email");
      total.notSent = [...chunk, ...queue];
      throw new SendError(info.message, total, info.code);
    }
    const reply = (data ?? {}) as SendReply;
    const remaining = reply.remaining ?? [];
    total.sent += reply.sent ?? 0;
    total.skipped.push(...(reply.skipped ?? []));
    total.failed.push(...(reply.failed ?? []));
    total.quota = reply.quota ?? total.quota;
    done += chunk.length - remaining.length;
    onProgress?.(done);
    if (reply.stopped === "daily_limit") {
      total.stopped = "daily_limit";
      total.notSent = [...remaining, ...queue];
      break;
    }
    if (remaining.length > 0) {
      // Out of time: the rest go first in the next request. Three requests in a row that get nowhere means something's wrong.
      stalled = remaining.length === chunk.length ? stalled + 1 : 0;
      if (stalled >= 3) {
        total.notSent = [...remaining, ...queue];
        throw new SendError("The email service keeps running out of time without sending anything. Anyone already emailed is recorded; try again later.", total, "stalled");
      }
      queue.unshift(...remaining);
    }
  }
  return total;
}

export type WalletPassResult = {
  sent: number;
  failed: { code: string; email: string; error: string }[];
  /** Chosen people not tried because the daily email limit was reached. */
  notSent?: string[];
  stopped?: "daily_limit" | null;
};
type WalletPassRound = WalletPassResult & { remaining: number; remainingIds?: string[] };

/**
 * Chosen people per request. The function takes up to 40 but also stops itself
 * after about 75 s (WalletWallet, storage and Gmail per person) and hands back
 * who it didn't get to, which go in the next request.
 */
export const WALLET_PASS_CHUNK = 20;

export class PassSendError extends Error {
  constructor(message: string, readonly partial: WalletPassResult) {
    super(message);
    this.name = "PassSendError";
  }
}

/**
 * Before sending to chosen people, makes sure the deployed function knows
 * applicationIds. An older one ignores the list and would email everyone
 * without a pass, so it's refused here and nothing is sent.
 */
async function checkCanChoose() {
  const { data, error } = await supabase.functions.invoke("send-wallet-passes", { method: "GET" });
  const status = (error as { context?: { status?: number } } | null)?.context?.status;
  // 405: the version before applicationIds, which only takes POST.
  if (error && status !== 405) throw new Error(`${(await functionErrorMessage(error, "passes")).message} Nothing was sent.`.replace("sent. Nothing was sent.", "sent."));
  if (error || (data as { applicationIds?: unknown } | null)?.applicationIds !== true) {
    throw new Error("The deployed send-wallet-passes function can't send to chosen people yet. Deploy the latest version and try again. Nothing was sent.");
  }
}

async function walletPassRound(body: Record<string, unknown>, total: WalletPassResult): Promise<WalletPassRound> {
  const { data, error } = await supabase.functions.invoke("send-wallet-passes", { body });
  if (error) throw new PassSendError((await functionErrorMessage(error, "passes")).message, total);
  const round = (data ?? {}) as Partial<WalletPassRound>;
  return {
    sent: round.sent ?? 0, failed: round.failed ?? [], remaining: round.remaining ?? 0,
    remainingIds: round.remainingIds, stopped: round.stopped ?? null,
  };
}

/**
 * Emails check-in passes through the send-wallet-passes function.
 *
 * With no applicationIds it sends to everyone accepted without a pass, 40 at a
 * time, and stops if a round sends nothing, so a persistent failure (say, a bad
 * address) can't loop forever.
 *
 * With applicationIds it sends to just those people, 20 per request, once
 * each (whoever a request didn't get to goes in the next), after checking the
 * deployed function supports that; resend also covers chosen people who
 * already have a pass. An empty list sends nothing.
 */
export async function sendWalletPasses(
  eventId: string,
  onProgress?: (sent: number) => void,
  options: { applicationIds?: string[]; resend?: boolean } = {},
): Promise<WalletPassResult> {
  const { applicationIds, resend = false } = options;
  if (isPreview()) return previewSendPasses(applicationIds ?? [], onProgress);
  const total: WalletPassResult = { sent: 0, failed: [] };

  if (applicationIds) {
    if (applicationIds.length > 0) await checkCanChoose();
    const queue = [...applicationIds];
    let stalled = 0;
    while (queue.length > 0) {
      const chunk = queue.splice(0, WALLET_PASS_CHUNK);
      const round = await walletPassRound({ eventId, applicationIds: chunk, resend }, total);
      total.sent += round.sent;
      total.failed.push(...round.failed);
      onProgress?.(total.sent);
      const left = round.remainingIds ?? [];
      if (round.stopped === "daily_limit") {
        total.stopped = "daily_limit";
        total.notSent = [...left, ...queue];
        break;
      }
      if (left.length > 0) {
        stalled = left.length === chunk.length ? stalled + 1 : 0;
        if (stalled >= 3) throw new PassSendError("The passes service keeps running out of time without sending anything. Anyone already sent a pass is recorded; try again later.", total);
        queue.unshift(...left);
      }
    }
    return total;
  }

  for (;;) {
    const round = await walletPassRound({ eventId }, total);
    total.sent += round.sent;
    onProgress?.(total.sent);
    if (round.stopped === "daily_limit") total.stopped = "daily_limit";
    if (round.remaining === 0 || round.sent === 0 || round.stopped === "daily_limit") {
      total.failed = round.failed;
      return total;
    }
  }
}
