import type { AbsentHacker, DaySettings, NoShow, Overview, QueuedHacker } from "./dayOf";

/**
 * `npm run dev` with `?preview`: a made-up event day for the Day-of page, so it
 * can be clicked through without an organizer account or real applicants.
 * Settings and no-show marking change it in memory; offering spots sends
 * email, so it says it's preview-only like releasing does.
 */

const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
const person = (i: number, name: string) => ({ application_id: `p${i}`, name, email: `${name.split(" ")[0].toLowerCase()}@example.edu` });

let settings: DaySettings = {
  hacker_capacity: 460,
  ucsd_checkin_cutoff_at: minutes(-95),
  checkin_cutoff_at: minutes(-5),
  offer_window_minutes: 60,
};

const late = (i: number, name: string, ucsd: boolean, extra: Partial<AbsentHacker> = {}): AbsentHacker => ({
  ...person(i, name), code: `DH27-H${String(100 + i).padStart(3, "0")}`, ucsd,
  deadline: ucsd ? settings.ucsd_checkin_cutoff_at : settings.checkin_cutoff_at, past_deadline: true, offered_at: null, ...extra,
});

let absent: AbsentHacker[] = [
  late(1, "Ava Chen", true),
  late(2, "Farah Haddad", true),
  late(3, "Ben Ortiz", false),
  late(4, "Ema Rossi", false),
  late(5, "Kai Nakamura", false, { deadline: minutes(35), past_deadline: false, offered_at: minutes(-25) }),
];
let noShows: NoShow[] = [];

const queue: QueuedHacker[] = [
  "Chloe Nguyen", "Dev Patel", "Grace Kim", "Hugo Silva", "Isha Rao", "Jonah Weiss", "Lena Park", "Marco Diaz", "Nora Ali",
].map((name, i) => ({ ...person(20 + i, name), submitted_at: `2026-12-0${1 + Math.floor(i / 3)}T1${i}:00:00-08:00`, opted_in_at: `2027-01-10T0${i}:30:00-08:00` }));

const CHECKED_IN = 452;

export function previewOverview(): Overview {
  const cap = settings.hacker_capacity;
  return {
    now: new Date().toISOString(),
    settings,
    checked_in: CHECKED_IN,
    expected: absent.length,
    open_spots: cap === null ? null : Math.max(cap - CHECKED_IN - absent.length, 0),
    waitlisted: 31,
    absent,
    no_shows: noShows,
    queue,
    offers: [
      { ...person(5, "Kai Nakamura"), code: "DH27-H105", offered_at: minutes(-25), expires_at: minutes(35), emailed_at: minutes(-24), checked_in_at: null, no_show_at: null },
      { ...person(6, "Lia Moreno"), code: "DH27-H106", offered_at: minutes(-25), expires_at: minutes(35), emailed_at: minutes(-24), checked_in_at: minutes(-10), no_show_at: null },
    ],
  };
}

export function previewSaveSettings(next: DaySettings) {
  settings = next;
}

export function previewMarkNoShows() {
  const marked = absent.filter(a => a.past_deadline);
  absent = absent.filter(a => !a.past_deadline);
  noShows = [...marked.map(a => ({ application_id: a.application_id, name: a.name, email: a.email, code: a.code, no_show_at: new Date().toISOString() })), ...noShows];
  return marked.map(a => ({ application_id: a.application_id, name: a.name }));
}

export function previewUnmark(ids: string[]) {
  const back = noShows.filter(n => ids.includes(n.application_id));
  noShows = noShows.filter(n => !ids.includes(n.application_id));
  absent = [...absent, ...back.map(n => late(Number(n.application_id.slice(1)), n.name, Number(n.application_id.slice(1)) <= 2))];
  return back.length;
}
