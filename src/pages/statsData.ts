/**
 * Data for the public live stats page (/stats, Stats.tsx): one call to the
 * database's public_event_stats() (supabase/migrations/*_public_event_stats.sql),
 * which returns counts only, never anything about one person.
 *
 * It's a plain fetch to Supabase's REST endpoint with the public anon key, not
 * the Supabase client: the page stays small, and a build without the Supabase
 * values shows the error state instead of failing to load (see portal/PortalShell).
 */

/** DataHacks 2027 applicant goal. What the page's goal progress measures against (not stored in the database). */
export const APPLICANT_GOAL = 1500;

/**
 * The event whose stats the page shows. Must match EVENT_CODE in portal/event.ts
 * (a test checks); it's repeated here because that file loads the Supabase client.
 * The event's events.stats_public switch decides whether the database answers.
 */
export const STATS_EVENT_CODE = "DH27";

/** How often the page fetches new numbers while it's on screen. */
export const REFRESH_MS = 60_000;

/** Groups smaller than this are never named; the database folds them into "Other". */
export const MIN_GROUP = 5;

export type Bucket = { label: string; count: number };
export type DayPoint = { date: string; count: number; total: number };

export type PublicStats = {
  hackers: number;
  schools: number;
  firstTime: number;
  attendedBefore: number;
  countries: number;
  mentorsJudges: number;
  topSchools: Bucket[];
  levels: Bucket[];
  majors: Bucket[];
  graduationYears: Bucket[];
  perDay: DayPoint[];
};

/** The event's stats switch is off (or the event isn't public): the database refused, on purpose. */
export class StatsPausedError extends Error {
  constructor() {
    super("Live stats are paused.");
    this.name = "StatsPausedError";
  }
}

const count = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const buckets = (value: unknown): Bucket[] =>
  Array.isArray(value)
    ? value
        .filter((b): b is { label: unknown; count: unknown } => typeof b === "object" && b !== null)
        .map(b => ({ label: String(b.label ?? "").trim(), count: count(b.count) }))
        .filter(b => b.label !== "" && b.count > 0)
    : [];

const days = (value: unknown): DayPoint[] =>
  Array.isArray(value)
    ? value
        .filter((d): d is { date: unknown; count: unknown; total: unknown } => typeof d === "object" && d !== null)
        .map(d => ({ date: String(d.date ?? ""), count: count(d.count), total: count(d.total) }))
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    : [];

/** The database's JSON, checked: anything missing or malformed reads as zero or empty rather than breaking the page. */
export function parseStats(raw: unknown): PublicStats {
  const s = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    hackers: count(s.hackers),
    schools: count(s.schools),
    firstTime: count(s.first_time),
    attendedBefore: count(s.attended_before),
    countries: count(s.countries),
    mentorsJudges: count(s.mentors_judges),
    topSchools: buckets(s.top_schools),
    levels: buckets(s.levels),
    majors: buckets(s.majors),
    graduationYears: buckets(s.graduation_years),
    perDay: days(s.per_day),
  };
}

/**
 * `npm run dev` with `?preview`: sample numbers, so the page can be looked at
 * without a database. `?preview=empty`, `=error`, `=paused` and `=slow` act out
 * the other states. Never on in a build (import.meta.env.DEV is false there, so
 * the sample data isn't even bundled).
 */
export const previewMode = (): string | null =>
  import.meta.env.DEV ? new URLSearchParams(window.location.search).get("preview") : null;

export async function fetchPublicStats(signal?: AbortSignal): Promise<PublicStats> {
  if (import.meta.env.DEV) {
    const mode = previewMode();
    if (mode !== null) return (await import("./statsPreview")).previewStats(mode);
  }

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) throw new Error("This copy of the site isn't connected to the database.");

  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json", Accept: "application/json" };
  // A legacy anon key is a JWT and goes in Authorization too, as the Supabase client sends it; a new publishable key doesn't.
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;

  const response = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/rpc/public_event_stats`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_code: STATS_EVENT_CODE }),
    signal,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { code?: string } | null;
    if (body?.code === "P0002") throw new StatsPausedError();
    throw new Error(`The stats request failed (${response.status}).`);
  }
  return parseStats(await response.json());
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** 1234 -> "1,234". */
export const formatCount = (n: number) => n.toLocaleString("en-US");

/** A whole-number percentage of `whole`; "<1%" for a small but non-zero share, "0%" when there's nothing. */
export function formatPercent(part: number, whole: number): string {
  if (whole <= 0 || part <= 0) return "0%";
  const pct = Math.round((part / whole) * 100);
  return pct === 0 ? "<1%" : `${pct}%`;
}

/** How far along the goal is: the label can pass 100%, the bar stops there. */
export function goalProgress(total: number, goal: number = APPLICANT_GOAL) {
  return {
    label: formatPercent(total, goal),
    fill: goal > 0 ? Math.min(100, Math.max(0, (total / goal) * 100)) : 0,
    reached: goal > 0 && total >= goal,
  };
}

const parseDay = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** "2026-11-03" -> "Nov 3" (the date as written: the database already gives Pacific dates). */
export const formatDay = (date: string) =>
  parseDay(date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** When the numbers last came in, on the viewer's clock: "4:27:33 PM". */
export const formatUpdated = (at: number) =>
  new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });

/** Graduation years in calendar order, then "Already graduated" and the like, then "Other". */
export function sortGraduationYears(list: Bucket[]): Bucket[] {
  const rank = (b: Bucket) => (b.label === "Other" ? 2 : /^\d{4}$/.test(b.label) ? 0 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b) || (rank(a) === 0 ? Number(a.label) - Number(b.label) : b.count - a.count));
}

/** The top of a chart's scale: a round number at or above `n` (at least 10, and even, so its half is whole too). */
export function niceMax(n: number): number {
  if (n <= 10) return 10;
  const power = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 3, 4, 5, 6, 8, 10].find(s => s * power >= n) ?? 10;
  return step * power;
}

/** Points for the running-total chart, in a `width` x `height` box with 0 at the bottom. */
export function chartPoints(perDay: DayPoint[], width: number, height: number) {
  const top = niceMax(Math.max(1, ...perDay.map(d => d.total)));
  const span = Math.max(1, perDay.length - 1);
  const points = perDay.map((d, i) => ({
    ...d,
    x: perDay.length === 1 ? width / 2 : (i / span) * width,
    y: height - (d.total / top) * height,
  }));
  return { top, points };
}
