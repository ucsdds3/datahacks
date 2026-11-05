import type { ApplicantType } from "./types";

/**
 * The console's Check-in section, the numbers half: everything here is pure,
 * so the tab's sums can be tested without a database.
 *
 * Who's expected comes from the check-in roster (public.attendees): accepted
 * people get a roster row (with their code) when their decision is released,
 * and the check-in app's check_in_by_code stamps checked_in_at and
 * checked_in_by on it. So "accepted" below means "on the roster".
 */

/** The roles a roster row can have. A mentor & judge has both mentor and judge. */
export type CheckinRole = "hacker" | "mentor" | "judge";
export const CHECKIN_ROLES: readonly CheckinRole[] = ["hacker", "mentor", "judge"];

/** One public.attendees row, as the Check-in section loads it. */
export type RosterEntry = {
  id: string;
  application_id: string | null;
  code: string;
  name: string;
  email: string | null;
  roles: string[];
  checked_in_at: string | null;
  checked_in_by: string | null;
  /** Only when the database has the waiver column (added by the waivers migration). */
  waiver_signed_at?: string | null;
};

/** What the Check-in section needs from someone's application. */
export type CheckinApplication = {
  id: string;
  applicant_type: ApplicantType;
  school: string | null;
  organization: string | null;
  wants_travel_stipend: boolean | null;
  travel_region: string | null;
  travel_method: string | null;
  travel_distance: string | null;
};

export type Person = {
  id: string;
  applicationId: string | null;
  code: string;
  name: string;
  email: string | null;
  roles: CheckinRole[];
  type: ApplicantType;
  /** School for hackers; organization (or school) for mentors and judges. */
  affiliation: string;
  school: string | null;
  checkedInAt: string | null;
  checkedInBy: string | null;
  /** undefined when the database has no waiver column. */
  waiverSignedAt?: string | null;
  travel: Pick<CheckinApplication, "travel_region" | "travel_method" | "travel_distance"> | null;
};

const typeFromRoles = (roles: CheckinRole[]): ApplicantType =>
  roles.includes("hacker") ? "hacker"
  : roles.includes("mentor") && roles.includes("judge") ? "hybrid"
  : roles.includes("judge") ? "judge"
  : "mentor";

const rolesOf = (raw: string[]) => {
  const roles = CHECKIN_ROLES.filter(r => raw.includes(r));
  return roles.length ? roles : (["hacker"] as CheckinRole[]);
};

/** The roster joined to applications (school, type, travel). Rows without an application still count. */
export function buildPeople(roster: RosterEntry[], applications: CheckinApplication[]): Person[] {
  const apps = new Map(applications.map(a => [a.id, a]));
  return roster.map(entry => {
    const app = entry.application_id ? apps.get(entry.application_id) : undefined;
    const roles = rolesOf(entry.roles ?? []);
    const type = app?.applicant_type ?? typeFromRoles(roles);
    const school = app?.school?.trim() || null;
    const affiliation = (type === "hacker" ? school : app?.organization?.trim() || school) ?? "";
    return {
      id: entry.id,
      applicationId: entry.application_id,
      code: entry.code,
      name: entry.name,
      email: entry.email,
      roles,
      type,
      affiliation,
      school,
      checkedInAt: entry.checked_in_at,
      checkedInBy: entry.checked_in_by,
      ...("waiver_signed_at" in entry ? { waiverSignedAt: entry.waiver_signed_at ?? null } : {}),
      travel: app?.wants_travel_stipend
        ? { travel_region: app.travel_region, travel_method: app.travel_method, travel_distance: app.travel_distance }
        : null,
    };
  });
}

export const isCheckedIn = (p: Pick<Person, "checkedInAt">) => !!p.checkedInAt;

export type Tally = { accepted: number; checkedIn: number; expected: number; percent: number };

export function tally(people: Pick<Person, "checkedInAt">[]): Tally {
  const checkedIn = people.filter(isCheckedIn).length;
  return {
    accepted: people.length,
    checkedIn,
    expected: people.length - checkedIn,
    percent: people.length ? Math.round((checkedIn / people.length) * 100) : 0,
  };
}

/**
 * Headline numbers: everyone, then each role. A mentor & judge counts under
 * both mentors and judges (they hold both badges), and once under everyone.
 */
export function roleTallies(people: Person[]): Record<"all" | CheckinRole, Tally> {
  return {
    all: tally(people),
    hacker: tally(people.filter(p => p.roles.includes("hacker"))),
    mentor: tally(people.filter(p => p.roles.includes("mentor"))),
    judge: tally(people.filter(p => p.roles.includes("judge"))),
  };
}

export type Bucket = { start: number; count: number; cumulative: number };

/** 15 minutes, widened so a long span (say, test check-ins the day before) still draws as at most this many bars. */
export const MAX_BUCKETS = 96;
const BUCKET_STEPS = [15, 30, 60, 120, 240, 480, 1440];

/**
 * Check-ins per time bucket, oldest first, with empty buckets filled in and a
 * running total. Buckets start on whole multiples of the bucket length since
 * the epoch, which is :00/:15/:30/:45 in every time zone that's a whole
 * number of quarter hours off UTC (all of them, today).
 *
 * `until` extends the axis to now while the doors are open, so a quiet spell
 * shows as empty bars instead of just ending the chart.
 */
export function arrivalBuckets(times: (string | null)[], options: { minutes?: number; until?: number; maxBuckets?: number } = {}) {
  const stamps = times.filter((t): t is string => !!t).map(t => Date.parse(t)).filter(Number.isFinite).sort((a, b) => a - b);
  const maxBuckets = options.maxBuckets ?? MAX_BUCKETS;
  if (stamps.length === 0) return { minutes: options.minutes ?? 15, buckets: [] as Bucket[] };
  const first = stamps[0];
  const last = Math.max(stamps[stamps.length - 1], options.until ?? -Infinity);
  let minutes = options.minutes ?? 15;
  const span = (m: number) => Math.floor(last / (m * 60_000)) - Math.floor(first / (m * 60_000)) + 1;
  for (const step of BUCKET_STEPS) {
    if (step < minutes) continue;
    minutes = step;
    if (span(step) <= maxBuckets) break;
  }
  const size = minutes * 60_000;
  const start0 = Math.floor(first / size) * size;
  const n = Math.min(span(minutes), maxBuckets);
  const buckets: Bucket[] = Array.from({ length: n }, (_, i) => ({ start: start0 + i * size, count: 0, cumulative: 0 }));
  for (const t of stamps) buckets[Math.min(Math.floor((t - start0) / size), n - 1)].count++;
  let running = 0;
  for (const b of buckets) { running += b.count; b.cumulative = running; }
  return { minutes, buckets };
}

/** Accepted (on the roster) and not checked in yet, in roster order. */
export const noShows = <T extends Pick<Person, "checkedInAt">>(people: T[]) => people.filter(p => !isCheckedIn(p));

export const NO_SCHOOL = "(no school given)";

/** Groups by school (organization for mentors and judges), biggest group first, "no school" last. */
export function groupBySchool<T extends Pick<Person, "affiliation">>(people: T[]): { school: string; people: T[] }[] {
  const groups = new Map<string, { school: string; people: T[] }>();
  for (const p of people) {
    const name = p.affiliation.trim() || NO_SCHOOL;
    const key = name === NO_SCHOOL ? "" : name.toLowerCase();
    const group = groups.get(key) ?? { school: name, people: [] };
    group.people.push(p);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) =>
    (a.school === NO_SCHOOL ? 1 : 0) - (b.school === NO_SCHOOL ? 1 : 0)
    || b.people.length - a.people.length
    || a.school.localeCompare(b.school));
}

/**
 * Whether a school is UC San Diego: the form's "University of California, San
 * Diego" plus how people type it ("UCSD", "UC San Diego", "University of
 * California San Diego"). Not the University of San Diego or San Diego State.
 * null when no school was given.
 */
export function isUcsd(school: string | null | undefined): boolean | null {
  const s = (school ?? "").trim();
  if (!s) return null;
  return /\bucsd\b|\buc[\s-]+san\s+diego\b|\buniversity\s+of\s+california,?\s*(?:at\s+|-\s*)?san\s+diego\b/i.test(s);
}

/** UCSD vs everyone else (vs no school given), each with its own tally. */
export function ucsdSplit(people: Pick<Person, "school" | "checkedInAt">[]) {
  const pick = (want: boolean | null) => tally(people.filter(p => isUcsd(p.school) === want));
  return { ucsd: pick(true), other: pick(false), unknown: pick(null) };
}

/** Accepted people who asked for travel reimbursement, and whether they came. */
export function travelRequests(people: Person[]) {
  const asked = people.filter(p => p.travel);
  return { people: asked, ...tally(asked) };
}

/**
 * Waivers among people who've checked in. null when the database has no
 * waiver column yet (so the section stays hidden).
 */
export function waiverStats(people: Person[]) {
  if (!people.some(p => p.waiverSignedAt !== undefined)) return null;
  const arrived = people.filter(isCheckedIn);
  const missing = arrived.filter(p => !p.waiverSignedAt);
  const signed = arrived.length - missing.length;
  return { checkedIn: arrived.length, signed, missing, percent: arrived.length ? Math.round((signed / arrived.length) * 100) : 0 };
}

export type Activity = {
  key: string;
  at: string;
  kind: "checkin" | "undo";
  /** type is null for someone no longer on the roster (only the check-in log knows them). */
  person: Pick<Person, "id" | "name" | "code"> & { type: ApplicantType | null };
  /** Organizer's profile id: from the log for both kinds; from the roster, check-ins only (undo_check_in clears it). */
  by: string | null;
  /** From the log: "offline" when it reached the server from a phone's queue. */
  source?: string;
};

/** A check-in that was there before and isn't now: undo_check_in clears checked_in_at and checked_in_by. */
export type Undo = Activity & { kind: "undo" };

/**
 * Compares two loads of the roster and returns the check-ins that were undone
 * in between. The database keeps no record of undos, so the feed can only
 * show the ones this browser saw happen.
 */
export function findUndos(before: RosterEntry[], after: RosterEntry[], seenAt: string, people?: Map<string, Pick<Person, "type">>): Undo[] {
  const now = new Map(after.map(e => [e.id, e]));
  return before
    .filter(e => e.checked_in_at && !now.get(e.id)?.checked_in_at)
    .map(e => ({
      key: `undo-${e.id}-${e.checked_in_at}`,
      at: seenAt,
      kind: "undo" as const,
      person: { id: e.id, name: e.name, code: e.code, type: people?.get(e.id)?.type ?? typeFromRoles(rolesOf(e.roles ?? [])) },
      by: null,
    }));
}

/** Newest first: every current check-in, plus the undos seen this session. */
export function activityFeed(people: Person[], undos: Undo[] = []): Activity[] {
  const checkins: Activity[] = people.filter(isCheckedIn).map(p => ({
    key: `in-${p.id}-${p.checkedInAt}`,
    at: p.checkedInAt!,
    kind: "checkin",
    person: { id: p.id, name: p.name, type: p.type, code: p.code },
    by: p.checkedInBy,
  }));
  return [...checkins, ...undos].sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.key.localeCompare(b.key));
}

/** How many check-ins each organizer has done, most first. null is "not recorded". */
export function checkinsByOrganizer(people: Person[]): { by: string | null; count: number }[] {
  const counts = new Map<string | null, number>();
  for (const p of people.filter(isCheckedIn)) counts.set(p.checkedInBy, (counts.get(p.checkedInBy) ?? 0) + 1);
  return [...counts].map(([by, count]) => ({ by, count })).sort((a, b) => b.count - a.count);
}

// --- The check-in log (public.checkin_events) ----------------------------------
// Since the batch-2 migration every check-in, undo and meal/swag scan is a row
// here, written by the RPCs. Where the database has it, the feed, arrivals and
// scan counts read it; without it they fall back to the roster above.

/** One public.checkin_events row, as the Check-in section loads it. */
export type LogEvent = {
  id: number;
  attendee_id: string;
  code: string;
  kind: "check_in" | "undo" | "scan";
  scan_type_id: string | null;
  by_user: string | null;
  /** When the desk scanned (offline scans keep their time). */
  scanned_at: string;
  source: "online" | "offline" | "backfill";
  /** Scans only: they hadn't checked in yet. */
  not_checked_in: boolean;
};

const logOrder = (a: LogEvent, b: LogEvent) => Date.parse(a.scanned_at) - Date.parse(b.scanned_at) || a.id - b.id;

/** Newest first: every check-in and undo in the log, named from the roster. */
export function activityFromLog(log: LogEvent[], people: Map<string, Pick<Person, "id" | "name" | "type" | "code">>): Activity[] {
  return log
    .filter(e => e.kind === "check_in" || e.kind === "undo")
    .sort((a, b) => logOrder(b, a))
    .map(e => {
      const p = people.get(e.attendee_id);
      return {
        key: `log-${e.id}`,
        at: e.scanned_at,
        kind: e.kind === "undo" ? "undo" as const : "checkin" as const,
        person: p ? { id: p.id, name: p.name, code: p.code, type: p.type } : { id: e.attendee_id, name: e.code, code: e.code, type: null },
        by: e.by_user,
        source: e.source,
      };
    });
}

/**
 * Arrival time per person still checked in, from the log: the scan time of
 * their latest check-in, unless an undo came after it. Keyed by attendee id.
 */
export function arrivalsFromLog(log: LogEvent[]): Map<string, string> {
  const latest = new Map<string, LogEvent>();
  for (const e of [...log].filter(e => e.kind !== "scan").sort(logOrder)) latest.set(e.attendee_id, e);
  const out = new Map<string, string>();
  for (const [id, e] of latest) if (e.kind === "check_in") out.set(id, e.scanned_at);
  return out;
}

export type ScanCount = {
  scanTypeId: string;
  /** People scanned for it (one each, the database makes sure). */
  scanned: number;
  /** Of those, scanned before they'd checked in (recorded anyway). */
  notCheckedIn: number;
  /** Share of the people checked in now (null when nobody is). */
  percentOfHere: number | null;
};

/** Scans per scan type, for every type given (zero when none yet), in the order given. */
export function scanCounts(log: LogEvent[], typeIds: string[], checkedIn: number): ScanCount[] {
  const counts = new Map(typeIds.map(id => [id, { scanned: 0, notCheckedIn: 0 }]));
  for (const e of log) {
    if (e.kind !== "scan" || !e.scan_type_id) continue;
    const c = counts.get(e.scan_type_id);
    if (!c) continue;
    c.scanned++;
    if (e.not_checked_in) c.notCheckedIn++;
  }
  return typeIds.map(id => {
    const c = counts.get(id)!;
    return { scanTypeId: id, ...c, percentOfHere: checkedIn ? Math.round((c.scanned / checkedIn) * 100) : null };
  });
}
