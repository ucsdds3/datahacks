// k6 load test for the application portal's Supabase backend (STAGING ONLY).
// Sends exactly the requests the React app makes (see README.md for the map
// from each request to the source file). Run through run.sh, or directly:
//
//   k6 run -e SCENARIO=applicant -e VUS=100 scripts/loadtest/portal.js
//   k6 run -e SCENARIO=spike -e USERS=500 scripts/loadtest/portal.js
//   k6 run -e SCENARIO=organizer -e VUS=5 scripts/loadtest/portal.js
//   k6 run -e SCENARIO=signin -e RATE=2 scripts/loadtest/portal.js
//
// Reads .data/config.json and .data/sessions.json written by seed.mjs.

import http from "k6/http";
import exec from "k6/execution";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";

const config = JSON.parse(open("./.data/config.json"));
const BASE = config.url;
if (/yrxjhrrphhbmqejresvy/.test(BASE)) throw new Error("Refusing to load-test production.");

const sessions = new SharedArray("sessions", () => JSON.parse(open("./.data/sessions.json")).sessions);
const organizer = JSON.parse(open("./.data/sessions.json")).organizer;

const SCENARIO = __ENV.SCENARIO || "applicant";
const VUS = Number(__ENV.VUS || 50);
const HOLD = __ENV.HOLD || "60s";
const THINK = Number(__ENV.THINK ?? 1); // seconds between "pages" for an applicant
const EVENTS = Number(config.events || 20);
const MAIN_EVENT = "LOADTEST00";

// The same columns src/organizer/data.ts asks for.
const ORGANIZER_COLUMNS = [
  "id", "user_id", "event_id", "applicant_type", "status", "submitted_at",
  "first_name", "last_name", "email", "phone",
  "school", "level_of_study", "major", "graduation_year",
  "organization", "role_title", "resume_url", "resume_path", "linkedin_url", "devpost_url",
  "judging_track", "bio", "essay_proudest_project", "essay_unique_thing", "essay_goal", "heard_about",
  "gender", "race_ethnicity", "city_of_residence", "country_of_residence", "hackathon_experience", "github_url",
  "wants_travel_stipend", "travel_region", "travel_method", "travel_distance", "travel_stipend_reason",
  "decision", "decision_released_at", "decision_emailed_at",
].join(",");

const STEPS = {
  applicant: ["profile_upsert", "event_lookup", "application_exists", "event_roles", "application_window", "application_insert", "status_query"],
  spike: ["profile_upsert", "event_lookup", "application_exists", "event_roles", "status_query"],
  organizer: ["event_lookup", "organizer_applications", "organizer_attendees"],
  signin: ["sign_in"],
};

const scenarios = {
  // Each VU is one applicant after another, clicking through with THINK seconds between pages.
  applicant: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [{ duration: "20s", target: VUS }, { duration: HOLD, target: VUS }, { duration: "10s", target: 0 }],
    gracefulRampDown: "10s",
    exec: "applicant",
  },
  // "Decisions are out": USERS people open their status page within about a minute.
  spike: {
    executor: "ramping-arrival-rate",
    startRate: 0,
    timeUnit: "1s",
    preAllocatedVUs: Math.min(Number(__ENV.USERS || 500), 1000),
    maxVUs: 2000,
    // 10 s ramp up, 40 s at peak, 10 s down: 50 x peak arrivals in total.
    stages: [
      { duration: "10s", target: Number(__ENV.USERS || 500) / 50 },
      { duration: "40s", target: Number(__ENV.USERS || 500) / 50 },
      { duration: "10s", target: 0 },
    ],
    exec: "statusPage",
  },
  // Organizers with the console open, each refreshing the full list every 5 s.
  organizer: {
    executor: "constant-vus",
    vus: VUS,
    duration: HOLD,
    exec: "organizerConsole",
  },
  // Password sign-ins from this one machine, to see Supabase Auth's per-IP limit.
  signin: {
    executor: "constant-arrival-rate",
    rate: Number(__ENV.RATE || 2),
    timeUnit: "1s",
    duration: HOLD,
    preAllocatedVUs: 20,
    exec: "signIn",
  },
};

const thresholds = {
  // Stop a run once more than 5% of requests fail (checked after 15 s so a few early errors don't end it).
  http_req_failed: [{ threshold: "rate<0.05", abortOnFail: true, delayAbortEval: "15s" }],
};
// Per-step latency shows up in the summary because each step has a threshold.
for (const step of STEPS[SCENARIO]) thresholds[`http_req_duration{name:${step}}`] = ["p(95)<60000"];
if (SCENARIO === "signin") delete thresholds.http_req_failed; // 429s are the point of this one

export const options = {
  scenarios: { [SCENARIO]: scenarios[SCENARIO] },
  thresholds,
  summaryTrendStats: ["med", "p(95)", "p(99)", "max", "avg"],
};

const headers = (token, extra = {}) => ({
  apikey: config.anonKey,
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "X-Client-Info": "supabase-js-web/2 loadtest",
  ...extra,
});

const rest = (path) => `${BASE}/rest/v1/${path}`;
const ok = (res, name) => check(res, { [`${name} ok`]: r => r.status >= 200 && r.status < 300 });

/** AuthCallback.tsx: upsert the profile. */
function profileUpsert(s) {
  const res = http.post(rest("profiles"), JSON.stringify({ id: s.user_id, email: s.email }), {
    headers: headers(s.access_token, { Prefer: "resolution=merge-duplicates,return=minimal" }),
    tags: { name: "profile_upsert" },
  });
  ok(res, "profile_upsert");
}

/** src/portal/event.ts: the event's id by code (cached for the rest of the page load). */
function eventLookup(s, code) {
  const res = http.get(rest(`events?select=id&code=eq.${code}`), { headers: headers(s.access_token), tags: { name: "event_lookup" } });
  ok(res, "event_lookup");
  try { return res.json()[0].id; } catch { return null; }
}

/** AuthCallback.tsx: has this person already applied? */
function applicationExists(s, eventId) {
  const res = http.get(rest(`applications?select=id&user_id=eq.${s.user_id}&event_id=eq.${eventId}&limit=1`), {
    headers: headers(s.access_token), tags: { name: "application_exists" },
  });
  ok(res, "application_exists");
}

/** AuthContext.tsx: this person's roles at the event. */
function eventRoles(s, eventId) {
  const res = http.get(rest(`event_roles?select=role&user_id=eq.${s.user_id}&event_id=eq.${eventId}`), {
    headers: headers(s.access_token), tags: { name: "event_roles" },
  });
  ok(res, "event_roles");
}

/** useStaffAccess.ts: the status page's application query. */
function statusQuery(s, eventId) {
  const res = http.get(
    rest(`applications?select=first_name,last_name,applicant_type,status,submitted_at&user_id=eq.${s.user_id}&event_id=eq.${eventId}` +
      `&applicant_type=in.(hacker,mentor,judge,hybrid)&order=submitted_at.desc&limit=1`),
    { headers: headers(s.access_token), tags: { name: "status_query" } },
  );
  ok(res, "status_query");
}

/** Apply.tsx (fetchApplicationWindow in src/portal/event.ts): is the event taking applications? */
function applicationWindow(s, code) {
  const res = http.get(rest(`events?select=applications_open,applications_open_at&code=eq.${code}`), {
    headers: headers(s.access_token), tags: { name: "application_window" },
  });
  ok(res, "application_window");
}

/** HackerApplication.tsx: the insert, with a realistic payload. */
function applicationInsert(s, eventId, n) {
  const essay = text => `${text} `.repeat(40).trim();
  const body = {
    applicant_type: "hacker", event_id: eventId, user_id: s.user_id, email: s.email, status: "submitted",
    submitted_at: new Date().toISOString(),
    first_name: `Load${n}`, last_name: "Tester", phone: `(858) 555-01${String(n % 100).padStart(2, "0")}`, gender: "Prefer not to say",
    race_ethnicity: "Prefer not to say", birthdate: "2004-01-01", country_of_residence: "United States",
    city_of_residence: "San Diego", level_of_study: "Undergraduate (3+ year: bachelor's)",
    school: "University of California, San Diego", major: "Data Science", graduation_year: "2027",
    hackathon_experience: "1–2 hackathons", attended_before: false,
    linkedin_url: "https://www.linkedin.com/in/example", github_url: "https://github.com/example", devpost_url: null,
    resume_url: "https://example.com/resume.pdf",
    essay_proudest_project: essay("I built a model."), essay_unique_thing: essay("I like data."), essay_goal: essay("I want to learn."),
    funniest_joke: "Why did the dataset break up? Too many outliers.", lifetime_goal: "Ship something useful.",
    heard_about: ["Instagram", "Friend or word of mouth"], wants_travel_stipend: false,
    travel_region: null, travel_method: null, travel_distance: null, travel_stipend_reason: null, agreed_to_terms: true,
  };
  const res = http.post(rest("applications"), JSON.stringify(body), {
    headers: headers(s.access_token, { Prefer: "return=minimal" }), tags: { name: "application_insert" },
  });
  check(res, {
    "application_insert ok": r => r.status === 201,
    "application_insert not duplicate": r => r.status !== 409,
  });
}

/**
 * One applicant: lands on /auth/callback signed in, then the form, then the status page.
 * Each iteration uses a (user, event) pair no earlier iteration used, so every insert is new.
 */
export function applicant() {
  const i = exec.scenario.iterationInTest + Number(__ENV.OFFSET || 0);
  const s = sessions[i % sessions.length];
  const code = `LOADTEST${String(1 + (Math.floor(i / sessions.length) % (EVENTS - 1))).padStart(2, "0")}`;

  // /auth/callback (and AuthProvider, which asks for roles at the same time)
  profileUpsert(s);
  const eventId = eventLookup(s, code);
  if (!eventId) return;
  applicationExists(s, eventId);
  eventRoles(s, eventId);
  sleep(THINK);
  // /apply: the page checks the event is open, then the form is submitted
  applicationWindow(s, code);
  applicationInsert(s, eventId, i);
  sleep(THINK);
  // /portal: the status page
  statusQuery(s, eventId);
  sleep(THINK);
}

/** Someone who already applied opens the decision email and signs in to see their status. */
export function statusPage() {
  const i = exec.scenario.iterationInTest;
  const s = sessions[i % sessions.length];
  profileUpsert(s);
  const eventId = eventLookup(s, MAIN_EVENT);
  if (!eventId) return;
  applicationExists(s, eventId);
  eventRoles(s, eventId);
  statusQuery(s, eventId);
}

/** The organizer console: every application at the event plus the attendee roster. */
export function organizerConsole() {
  const s = organizer;
  const eventId = eventLookup(s, MAIN_EVENT);
  if (!eventId) return;
  const [apps, roster] = http.batch([
    ["GET", rest(`applications?select=${ORGANIZER_COLUMNS}&event_id=eq.${eventId}&order=submitted_at.asc`), null,
      { headers: headers(s.access_token), tags: { name: "organizer_applications" } }],
    ["GET", rest(`attendees?select=application_id,code,checked_in_at,emailed_at&event_id=eq.${eventId}`), null,
      { headers: headers(s.access_token), tags: { name: "organizer_attendees" } }],
  ]);
  check(apps, {
    "organizer_applications ok": r => r.status === 200,
    "organizer sees every application": r => r.status === 200 && r.json().length >= Number(__ENV.EXPECT_ROWS || 1),
  });
  ok(roster, "organizer_attendees");
  sleep(5);
}

const password = SCENARIO === "signin" ? JSON.parse(open("./.data/password.json")).password : null;

/** Password sign-in (the real site uses Google OAuth, which ends in the same /token endpoint). */
export function signIn() {
  const s = sessions[exec.scenario.iterationInTest % sessions.length];
  const res = http.post(`${BASE}/auth/v1/token?grant_type=password`, JSON.stringify({ email: s.email, password }), {
    headers: { apikey: config.anonKey, "Content-Type": "application/json" },
    tags: { name: "sign_in" },
    responseCallback: http.expectedStatuses(200, 429),
  });
  check(res, {
    "sign_in 200": r => r.status === 200,
    "sign_in not rate limited (429)": r => r.status !== 429,
  });
}
