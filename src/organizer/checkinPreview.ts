import type { CheckinApplication, LogEvent, RosterEntry } from "./checkin";
import type { ScanType, ScanTypePatch } from "./scanTypes";
import type { ApplicantType } from "./types";

/**
 * `npm run dev` with `?preview`: a made-up check-in day for the Check-in
 * section, so it can be looked at without real attendees. About 170 people,
 * two thirds checked in over the last three hours. Each reload checks one
 * more person in, and every fifth undoes the latest, so the live parts move.
 * Same seed every time; nothing here touches the database.
 */

// mulberry32: a tiny seeded random, so the preview looks the same on every load.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Ava", "Ben", "Chloe", "Dev", "Ema", "Farah", "Gabe", "Hana", "Ivan", "Jia", "Kofi", "Lena", "Maya", "Nico", "Omar", "Priya", "Quinn", "Rosa", "Sam", "Tara", "Uma", "Vik", "Wren", "Xin", "Yara", "Zane"];
const LAST = ["Chen", "Ortiz", "Nguyen", "Patel", "Rossi", "Haddad", "Kim", "Garcia", "Singh", "Lopez", "Okafor", "Silva", "Tanaka", "Weber", "Ali", "Brown"];
const SCHOOLS: [string | null, number][] = [
  ["University of California, San Diego", 46], ["UCSD", 6], ["San Diego State University", 10], ["UC Irvine", 7],
  ["University of California, Los Angeles", 7], ["University of San Diego", 5], ["University of Southern California", 5],
  ["UC Berkeley", 4], ["San Diego Mesa College", 4], ["Stanford University", 2], [null, 4],
];
const ORGS = ["Qualcomm", "Intuit", "Illumina", "ServiceNow", "UC San Diego", "Scripps Research", "Booz Allen"];
const ORGANIZERS = [
  { id: "org-1", email: "desk-a@example.com", first_name: "Alex", last_name: "Desk" },
  { id: "org-2", email: "desk-b@example.com", first_name: "Bea", last_name: "Scanner" },
  { id: "org-3", email: "lead@example.com", first_name: null, last_name: null },
];

type Fixture = { roster: RosterEntry[]; apps: CheckinApplication[]; log: LogEvent[]; scanTypes: ScanType[] };

let fixture: Fixture | null = null;
let reloads = 0;

function build(now: number): Fixture {
  const rand = seeded(2027);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const school = () => {
    let r = rand() * SCHOOLS.reduce((s, [, w]) => s + w, 0);
    for (const [name, w] of SCHOOLS) if ((r -= w) < 0) return name;
    return null;
  };
  const roster: RosterEntry[] = [];
  const apps: CheckinApplication[] = [];
  const add = (n: number, type: ApplicantType, roles: string[], prefix: string, arriveShare: number) => {
    for (let i = 1; i <= n; i++) {
      const id = `${prefix}${i}`;
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      const sch = type === "hacker" ? school() : null;
      const arrived = rand() < arriveShare;
      // Most people arrive in the first hour; a trickle after.
      const minutesAgo = Math.floor(180 * Math.pow(rand(), 0.45));
      const travel = type === "hacker" && sch !== "University of California, San Diego" && sch !== "UCSD" && rand() < 0.3;
      roster.push({
        id, application_id: `app-${id}`, code: `DH27-${prefix.toUpperCase()}${String(i).padStart(3, "0")}`,
        name, email: `${name.split(" ")[0].toLowerCase()}.${i}@example.edu`, roles,
        checked_in_at: arrived ? new Date(now - minutesAgo * 60_000).toISOString() : null,
        checked_in_by: arrived ? (rand() < 0.04 ? null : pick(ORGANIZERS).id) : null,
        waiver_signed_at: rand() < 0.85 ? new Date(now - 3 * 86_400_000).toISOString() : null,
      });
      apps.push({
        id: `app-${id}`, applicant_type: type, school: sch, organization: type === "hacker" ? null : pick(ORGS),
        wants_travel_stipend: travel,
        travel_region: travel ? pick(["Los Angeles, CA", "Irvine, CA", "Berkeley, CA", "Tijuana, MX", "Phoenix, AZ"]) : null,
        travel_method: travel ? pick(["Car", "Train", "Bus", "Plane"]) : null,
        travel_distance: travel ? pick(["50–200 miles", "200–500 miles", "Over 500 miles"]) : null,
      });
    }
  };
  add(140, "hacker", ["hacker"], "h", 0.68);
  add(18, "mentor", ["mentor"], "m", 0.6);
  add(10, "judge", ["judge"], "j", 0.5);
  add(4, "hybrid", ["mentor", "judge"], "x", 0.75);

  // The log: everyone's check-in (a few of them sent later from a phone that
  // was offline), then lunch for most people here and shirts for some.
  const scanTypes: ScanType[] = [
    { id: "st-lunch", event_id: "preview-event", label: "Lunch · Sat", kind: "meal", active: true, sort: 10, opens_at: new Date(now - 60 * 60_000).toISOString(), closes_at: new Date(now + 60 * 60_000).toISOString() },
    { id: "st-shirt", event_id: "preview-event", label: "T-shirt", kind: "swag", active: true, sort: 20, opens_at: null, closes_at: null },
    { id: "st-dinner", event_id: "preview-event", label: "Dinner · Sat", kind: "meal", active: false, sort: 30, opens_at: null, closes_at: null },
  ];
  const log: LogEvent[] = [];
  const push = (e: Omit<LogEvent, "id">) => log.push({ id: log.length + 1, ...e });
  for (const r of roster.filter(r => r.checked_in_at).sort((a, b) => Date.parse(a.checked_in_at!) - Date.parse(b.checked_in_at!))) {
    push({ attendee_id: r.id, code: r.code, kind: "check_in", scan_type_id: null, by_user: r.checked_in_by, scanned_at: r.checked_in_at!, source: rand() < 0.08 ? "offline" : "online", not_checked_in: false });
  }
  for (const r of roster) {
    const here = !!r.checked_in_at;
    const scan = (type: string, share: number) => {
      if (rand() >= share) return;
      const at = here ? Math.max(Date.parse(r.checked_in_at!), now - 50 * 60_000) + Math.floor(rand() * 40) * 60_000 : now - Math.floor(rand() * 40) * 60_000;
      push({ attendee_id: r.id, code: r.code, kind: "scan", scan_type_id: type, by_user: pick(ORGANIZERS).id, scanned_at: new Date(Math.min(at, now)).toISOString(), source: "online", not_checked_in: !here });
    };
    scan("st-lunch", here ? 0.72 : 0.03);
    scan("st-shirt", here ? 0.45 : 0);
  }
  return { roster, apps, log, scanTypes };
}

const get = () => (fixture ??= build(Date.now()));

export function previewCheckinRoster(): RosterEntry[] {
  const f = get();
  if (reloads++ > 0) {
    const latest = f.roster.filter(e => e.checked_in_at).sort((a, b) => Date.parse(b.checked_in_at!) - Date.parse(a.checked_in_at!))[0];
    const by = ORGANIZERS[reloads % ORGANIZERS.length].id;
    const at = new Date().toISOString();
    const log = (e: RosterEntry, kind: "check_in" | "undo") =>
      f.log.push({ id: f.log.length + 1, attendee_id: e.id, code: e.code, kind, scan_type_id: null, by_user: by, scanned_at: at, source: "online", not_checked_in: false });
    if (reloads % 5 === 0 && latest) {
      latest.checked_in_at = null;
      latest.checked_in_by = null;
      log(latest, "undo");
    } else {
      const next = f.roster.find(e => !e.checked_in_at);
      if (next) {
        next.checked_in_at = at;
        next.checked_in_by = by;
        log(next, "check_in");
      }
    }
  }
  return f.roster.map(e => ({ ...e }));
}

export const previewCheckinApplications = () => get().apps.map(a => ({ ...a }));

export const previewOrganizers = () => ORGANIZERS;

export const previewCheckinLog = () => get().log.map(e => ({ ...e }));

export const previewScanTypes = () => get().scanTypes.map(t => ({ ...t })).sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));

export function previewAddScanType(row: Pick<ScanType, "event_id" | "label" | "kind" | "sort" | "active">) {
  const f = get();
  if (f.scanTypes.some(t => t.label.toLowerCase() === row.label.toLowerCase())) throw new Error("There's already one with that name.");
  f.scanTypes.push({ ...row, id: `st-${f.scanTypes.length + 1}-${Date.now()}`, opens_at: null, closes_at: null });
}

export function previewUpdateScanType(id: string, patch: ScanTypePatch) {
  const t = get().scanTypes.find(x => x.id === id);
  if (t) Object.assign(t, patch);
}
