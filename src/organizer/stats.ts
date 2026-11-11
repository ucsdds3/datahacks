import { HACKER_GOAL, TIMELINE, applicationBatch } from "@/staff-portal/config";
import { HACKATHON_EXPERIENCE, LEVELS_OF_STUDY, TRAVEL_DISTANCES } from "@/staff-portal/formOptions";
import { NICKNAMES, normalize } from "@/staff-portal/schoolSearch";
import { isDraft, isStaged, placeOf, type ApplicantType, type Decision, type Status } from "./types";

/**
 * The console's Stats page: who's applying, worked out from the application
 * rows organizers can read (row-level security). Everything here is a pure
 * function of the rows, so it's tested on its own (stats.test.ts).
 *
 * Drafts never count, except as "drafts in progress".
 */

/** What the Stats page loads for every application: answers to count, no names, emails or essays. */
export type StatsRow = {
  id: string;
  applicant_type: ApplicantType;
  status: Status | null;
  submitted_at: string | null;
  school: string | null;
  major: string | null;
  level_of_study: string | null;
  graduation_year: string | null;
  hackathon_experience: string | null;
  attended_before: boolean | null;
  country_of_residence: string | null;
  heard_about: string[] | null;
  /** Hackers' "Help us plan" answers, as typed (null on applications from before they were asked). */
  suggested_food: string | null;
  suggested_activity: string | null;
  wants_travel_stipend: boolean | null;
  travel_region: string | null;
  travel_distance: string | null;
  gender: string | null;
  /** The form's choices joined with "; " (it's a multi-select). */
  race_ethnicity: string | null;
  judging_track: string | null;
  ucsd_affiliation: string | null;
  /** The decision an organizer picked (staged or released), from staged_decisions. */
  decision: Decision | null;
  /** On the check-in roster and checked in. */
  checkedIn: boolean;
};

/** The applications columns the Stats page selects (the decision and check-in come from elsewhere). */
export const STATS_FIELDS = [
  "id", "applicant_type", "status", "submitted_at",
  "school", "major", "level_of_study", "graduation_year", "hackathon_experience", "attended_before",
  "country_of_residence", "heard_about", "suggested_food", "suggested_activity",
  "wants_travel_stipend", "travel_region", "travel_distance",
  "gender", "race_ethnicity", "judging_track", "ucsd_affiliation",
] as const satisfies readonly (keyof StatsRow)[];

/** One bar. `rest` is set on the rolled-up "Other" bar: how many smaller answers it stands for. */
export type Item = { key: string; label: string; count: number; rest?: number };

export type Breakdown = {
  items: Item[];
  /** People with at least one answer: what the percentages are of. */
  answered: number;
  /** People who left it blank. */
  missing: number;
  /** Different answers, before any roll-up into "Other". */
  distinct: number;
};

/** The key of the rolled-up "Other" bar; can't clash with a real answer's key. */
export const OTHER_KEY = "\u0000other";

/** "52%", "<1%" for a sliver, "" when there's nothing to be a share of. */
export function share(count: number, of: number) {
  if (of <= 0) return "";
  const p = (count / of) * 100;
  return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
}

/** Trimmed, with runs of spaces made one; null when blank. */
export const clean = (value: string | null | undefined): string | null => value?.replace(/\s+/g, " ").trim() || null;

/** How free-text answers group: case, accents, spacing and punctuation don't matter ("Data science." = "data  Science"). */
export const textKey = (value: string) => normalize(value);

type Value = string | null | undefined;

export type TallyOptions = {
  /** Answers with the same key share a bar. Default: textKey. */
  key?: (value: string) => string;
  /** A fixed name for an answer's bar; otherwise the bar takes its most common spelling. */
  label?: (value: string, key: string) => string | undefined;
  /** Bar order. Default: most first, ties A–Z. */
  sort?: (a: Item, b: Item) => number;
};

export const byCount = (a: Item, b: Item) => b.count - a.count || a.label.localeCompare(b.label);

/** In the form's order (for answers with a natural order), anything else after by count. */
export function byOptions(options: readonly string[]) {
  const rank = new Map(options.map((o, i) => [textKey(o), i]));
  return (a: Item, b: Item) => {
    const [x, y] = [rank.get(a.key) ?? Infinity, rank.get(b.key) ?? Infinity];
    return x === y ? byCount(a, b) : x - y;
  };
}

function mostCommon(spellings: Map<string, number>) {
  let best = "";
  let most = 0;
  for (const [spelling, n] of spellings) if (n > most) [best, most] = [spelling, n];
  return best;
}

/**
 * Counts answers, one bar per answer. `pick` gives one answer or, for a
 * multi-select, a list: each choice counts once per person, so the bars can
 * add up to more than the number of people.
 */
export function tally<T>(rows: readonly T[], pick: (row: T) => Value | readonly Value[], options: TallyOptions = {}): Breakdown {
  const keyOf = options.key ?? textKey;
  const groups = new Map<string, { count: number; fixed?: string; spellings: Map<string, number> }>();
  let answered = 0;
  for (const row of rows) {
    const picked = pick(row);
    const values = (Array.isArray(picked) ? picked : [picked]) as Value[];
    const seen = new Set<string>();
    for (const raw of values) {
      const value = clean(raw);
      if (!value) continue;
      const key = keyOf(value);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      let group = groups.get(key);
      if (!group) groups.set(key, (group = { count: 0, spellings: new Map() }));
      group.count++;
      group.fixed ??= options.label?.(value, key);
      group.spellings.set(value, (group.spellings.get(value) ?? 0) + 1);
    }
    if (seen.size > 0) answered++;
  }
  const items = [...groups].map(([key, g]): Item => ({ key, label: g.fixed ?? mostCommon(g.spellings), count: g.count }));
  items.sort(options.sort ?? byCount);
  return { items, answered, missing: rows.length - answered, distinct: items.length };
}

/**
 * The biggest `n` bars, and the rest added up in one "Other" bar at the end.
 * Leaves the list alone when folding would only hide one bar. For one-answer
 * questions: on a multi-select, "Other" would count people more than once.
 */
export function topN(breakdown: Breakdown, n: number, otherLabel = "Other"): Breakdown {
  if (breakdown.items.length <= n + 1) return breakdown;
  const sorted = [...breakdown.items].sort(byCount);
  const rest = sorted.slice(n);
  return {
    ...breakdown,
    items: [...sorted.slice(0, n), { key: OTHER_KEY, label: otherLabel, count: rest.reduce((s, i) => s + i.count, 0), rest: rest.length }],
  };
}

/** A yes/no question: Yes, then No; unanswered (null) is `missing`. */
export function yesNo<T>(rows: readonly T[], pick: (row: T) => boolean | null | undefined): Breakdown {
  return tally(rows, r => {
    const v = pick(r);
    return v === true ? "Yes" : v === false ? "No" : null;
  }, { sort: byOptions(["Yes", "No"]) });
}

/** "UCSD", "UC San Diego" and "University of California, San Diego" are one school. */
const SCHOOL_NAMES = new Map(
  Object.values(NICKNAMES).filter(names => names.length === 1).map(([name]) => [textKey(name), name]),
);

export function schoolKey(value: string): string {
  const key = textKey(value);
  const nickname = NICKNAMES[key];
  if (nickname?.length === 1) return textKey(nickname[0]);
  return key.replace(/^uc /, "university of california ").replace(/^university of california at /, "university of california ");
}

const UCSD_KEY = schoolKey("University of California, San Diego");

/** Whether a school is UC San Diego, however it's spelled ("UCSD", "UC San Diego", ...). */
export const isUcsd = (school: string | null) => !!school && schoolKey(school) === UCSD_KEY;

/** The hackers table's school toggle: everyone, UCSD students, or students from other schools. */
export type SchoolScope = "all" | "ucsd" | "other";

/** The list's spelling for schools people often shorten; others keep their most common spelling. */
export const schoolLabel = (_value: string, key: string) => SCHOOL_NAMES.get(key);

/** Graduation years in order, then "Already graduated", "Not applicable" and anything else. */
export function byGraduationYear(a: Item, b: Item) {
  const year = (i: Item) => (/^\d{4}$/.test(i.label) ? Number(i.label) : null);
  const [x, y] = [year(a), year(b)];
  if (x !== null && y !== null) return x - y;
  if (x !== null) return -1;
  if (y !== null) return 1;
  return byOptions(["Already graduated", "Not applicable"])(a, b);
}

/** The staff form's judging tracks (StaffApplication.tsx; the database's applications_judging_track_check). */
export const JUDGING_TRACK_LABEL: Record<string, string> = {
  social_good: "Social Good",
  biotech_life_sciences: "Biotech & Life Sciences",
  defense_cybersecurity: "Defense & Cybersecurity",
  finance: "Finance",
  entertainment: "Entertainment",
};

/** The staff form's UCSD affiliation choices (StaffApplication.tsx). */
export const UCSD_AFFILIATION_LABEL: Record<string, string> = {
  student: "UCSD student",
  alumni: "UCSD alumni",
  faculty: "UCSD faculty",
  none: "Not affiliated with UCSD",
};

const ROLE_LABEL: Record<string, string> = { mentor: "Mentor", judge: "Judge", hybrid: "Mentor & judge" };

const humanize = (value: string) => value.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());

/** The answer the form records for "how many hackathons" when it's someone's first. */
export const FIRST_HACKATHON = HACKATHON_EXPERIENCE[0];

/** Priority batch: submitted by the priority deadline (11:59 PM Pacific, TIMELINE). */
export function batchSplit(rows: readonly Pick<StatsRow, "submitted_at">[]) {
  let priority = 0;
  for (const r of rows) if (applicationBatch(r.submitted_at) === "priority") priority++;
  return { priority, regular: rows.length - priority };
}

export type DecisionKey = Decision | "undecided";
export type DecisionCount = { key: DecisionKey; label: string; count: number; released: number; staged: number };

const DECISION_ORDER: { key: DecisionKey; label: string }[] = [
  { key: "accepted", label: "Accepted" },
  { key: "waitlisted", label: "Waitlisted" },
  { key: "rejected", label: "Rejected" },
  { key: "undecided", label: "No decision yet" },
];

/**
 * Where each submitted application stands, as the console's tabs place it
 * (placeOf): the decision picked, released to the applicant or still staged.
 */
export function decisionTally(rows: readonly Pick<StatsRow, "status" | "decision">[]): DecisionCount[] {
  const out = new Map(DECISION_ORDER.map(d => [d.key, { ...d, count: 0, released: 0, staged: 0 }]));
  for (const r of rows) {
    if (isDraft(r)) continue;
    const place = placeOf(r);
    const entry = out.get(place === "applied" ? "undecided" : place)!;
    entry.count++;
    if (place !== "applied") entry[isStaged(r) ? "staged" : "released"]++;
  }
  return [...out.values()];
}

/** Accepted (released) and how many of them have checked in. */
export function checkinTally(rows: readonly Pick<StatsRow, "status" | "checkedIn">[]) {
  const accepted = rows.filter(r => r.status === "accepted");
  return { accepted: accepted.length, checkedIn: rows.filter(r => r.checkedIn).length };
}

const PACIFIC_DATE = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" });

/** The calendar day in San Diego, as "2026-11-29". */
export function pacificDay(when: Date | string | number): string {
  const parts = Object.fromEntries(PACIFIC_DATE.formatToParts(new Date(when)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export type Day = {
  /** "2026-11-29", in Pacific time. */
  day: string;
  /** That date at 00:00 UTC: for labels formatted in UTC, never for arithmetic in local time. */
  start: number;
  count: number;
  cumulative: number;
};

const DAY_MS = 86_400_000;
const MAX_DAYS = 366;
const dayStart = (day: string) => Date.parse(`${day}T00:00:00Z`);

/**
 * Submissions per Pacific day, with empty days filled in and a running total.
 * Runs to the last submission, or on to today while applications are still
 * open (up to the regular deadline), so a quiet day shows as a gap.
 */
export function dailySubmissions(rows: readonly Pick<StatsRow, "submitted_at">[], now: Date = new Date()): Day[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.submitted_at || Number.isNaN(Date.parse(r.submitted_at))) continue;
    const day = pacificDay(r.submitted_at);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  if (counts.size === 0) return [];
  const days = [...counts.keys()].sort();
  const today = pacificDay(now);
  const closes = pacificDay(TIMELINE.regularDeadline);
  const openUntil = today < closes ? today : closes;
  const last = days[days.length - 1] > openUntil ? days[days.length - 1] : openUntil;
  const end = dayStart(last);
  const start = Math.max(dayStart(days[0]), end - (MAX_DAYS - 1) * DAY_MS);
  // Anything before a very long run's window still counts towards the total.
  let cumulative = [...counts].filter(([d]) => dayStart(d) < start).reduce((s, [, n]) => s + n, 0);
  const out: Day[] = [];
  for (let t = start; t <= end; t += DAY_MS) {
    const day = new Date(t).toISOString().slice(0, 10);
    const count = counts.get(day) ?? 0;
    cumulative += count;
    out.push({ day, start: t, count, cumulative });
  }
  return out;
}

/** Submitted today and in the last 7 days (today and the 6 before), by the Pacific calendar. */
export function recentSubmissions(rows: readonly Pick<StatsRow, "submitted_at">[], now: Date = new Date()) {
  const today = pacificDay(now);
  const weekStart = new Date(dayStart(today) - 6 * DAY_MS).toISOString().slice(0, 10);
  let day = 0;
  let week = 0;
  for (const r of rows) {
    if (!r.submitted_at || Number.isNaN(Date.parse(r.submitted_at))) continue;
    const d = pacificDay(r.submitted_at);
    if (d === today) day++;
    if (d >= weekStart && d <= today) week++;
  }
  return { today: day, week };
}

/** Everything on the Stats page. */
export function computeStats(rows: readonly StatsRow[], { goal = HACKER_GOAL, now = new Date() }: { goal?: number; now?: Date } = {}) {
  const hackerRows = rows.filter(r => r.applicant_type === "hacker");
  const hackers = hackerRows.filter(r => !isDraft(r));
  const staffRows = rows.filter(r => r.applicant_type !== "hacker");
  const staff = staffRows.filter(r => !isDraft(r));
  const travelers = hackers.filter(r => r.wants_travel_stipend === true);
  const judges = staff.filter(r => r.applicant_type === "judge" || r.applicant_type === "hybrid");
  const schools = tally(hackers, r => r.school, { key: schoolKey, label: schoolLabel });

  return {
    goal,
    hackers: hackers.length,
    hackerDrafts: hackerRows.length - hackers.length,
    /** Of the goal; can go past 1. */
    progress: goal > 0 ? hackers.length / goal : 0,
    batch: batchSplit(hackers),
    schoolsRepresented: schools.distinct,
    firstTimers: hackers.filter(r => r.hackathon_experience === FIRST_HACKATHON).length,
    daily: dailySubmissions(hackers, now),
    recent: recentSubmissions(hackers, now),
    decisions: decisionTally(hackers),
    checkin: checkinTally(hackers),
    hacker: {
      schools: topN(schools, 15),
      majors: topN(tally(hackers, r => r.major), 15),
      level: tally(hackers, r => r.level_of_study, { sort: byOptions(LEVELS_OF_STUDY) }),
      graduation: tally(hackers, r => r.graduation_year, { sort: byGraduationYear }),
      experience: tally(hackers, r => r.hackathon_experience, { sort: byOptions(HACKATHON_EXPERIENCE) }),
      attendedBefore: yesNo(hackers, r => r.attended_before),
      country: topN(tally(hackers, r => r.country_of_residence), 10),
      heardAbout: tally(hackers, r => r.heard_about),
      food: topN(tally(hackers, r => r.suggested_food), 15),
      activities: topN(tally(hackers, r => r.suggested_activity), 15),
      travel: yesNo(hackers, r => r.wants_travel_stipend),
      travelDistance: tally(travelers, r => r.travel_distance, { sort: byOptions(TRAVEL_DISTANCES) }),
      travelRegion: topN(tally(travelers, r => r.travel_region), 10),
      gender: tally(hackers, r => r.gender),
      race: tally(hackers, r => r.race_ethnicity?.split(";")),
    },
    staff: {
      total: staff.length,
      drafts: staffRows.length - staff.length,
      byRole: tally(staff, r => r.applicant_type, { label: v => ROLE_LABEL[v] ?? humanize(v), sort: byOptions(["mentor", "judge", "hybrid"]) }),
      decisions: decisionTally(staff),
      checkin: checkinTally(staff),
      tracks: tally(judges, r => r.judging_track, { label: v => JUDGING_TRACK_LABEL[v] ?? humanize(v) }),
      heardAbout: tally(staff, r => r.heard_about),
      affiliation: tally(staff, r => r.ucsd_affiliation, {
        label: v => UCSD_AFFILIATION_LABEL[v] ?? humanize(v), sort: byOptions(Object.keys(UCSD_AFFILIATION_LABEL)),
      }),
    },
  };
}

export type Stats = ReturnType<typeof computeStats>;
