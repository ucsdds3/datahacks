// Seeds and cleans up load-test data on STAGING. See README.md.
//
//   node scripts/loadtest/seed.mjs setup    [--users 500] [--events 80]
//   node scripts/loadtest/seed.mjs sessions [--rate 25]   # sign-ins per minute
//   node scripts/loadtest/seed.mjs apps     [--count 1500] # organizer rows in LOADTEST00
//   node scripts/loadtest/seed.mjs own-apps                # one LOADTEST00 application per session user
//   node scripts/loadtest/seed.mjs reset                   # delete applications in LOADTEST01..NN
//   node scripts/loadtest/seed.mjs status
//   node scripts/loadtest/seed.mjs cleanup                 # delete everything the load test made
//
// Everything it creates is findable: events LOADTEST00..NN and accounts
// @loadtest.example.com (no email is ever sent to them).

import { randomBytes } from "node:crypto";
import {
  ANON, EMAIL_DOMAIN, ORGANIZER_EMAIL, URL_, admin, call, emailFor, eventCode, pool, readData, sleep, writeData,
} from "./lib.mjs";

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? Number(rest[i + 1]) : dflt;
};

async function events() {
  const { data } = await admin("/rest/v1/events?select=id,code&code=like.LOADTEST*&order=code");
  return data;
}

async function allLoadTestUsers() {
  const found = [];
  for (let page = 1; ; page++) {
    const { data } = await admin(`/auth/v1/admin/users?per_page=1000&page=${page}`);
    const users = data.users ?? [];
    found.push(...users.filter(u => u.email?.endsWith(`@${EMAIL_DOMAIN}`)));
    if (users.length < 1000) return found;
  }
}

async function createUser(email, password) {
  try {
    const { data } = await admin("/auth/v1/admin/users", {
      method: "POST",
      body: { email, password, email_confirm: true, user_metadata: { full_name: "Load Test", loadtest: true } },
    });
    return data;
  } catch (e) {
    if (e.status !== 422) throw e; // already exists
    const users = await allLoadTestUsers();
    return users.find(u => u.email === email);
  }
}

/** A hacker application shaped like HackerApplication.tsx sends. */
export function hackerApplication(n) {
  const essay = s => `${s} `.repeat(40).trim(); // ~400 characters, like a real answer
  return {
    applicant_type: "hacker",
    status: "submitted",
    submitted_at: new Date(Date.now() - n * 60_000).toISOString(),
    first_name: `Load${n}`,
    last_name: "Tester",
    phone: `(858) 555-01${String(n % 100).padStart(2, "0")}`,
    gender: "Prefer not to say",
    race_ethnicity: "Prefer not to say",
    birthdate: "2004-01-01",
    country_of_residence: "United States",
    city_of_residence: "San Diego",
    level_of_study: "Undergraduate (3+ year: bachelor's)",
    school: "University of California, San Diego",
    major: "Data Science",
    graduation_year: "2027",
    hackathon_experience: "1–2 hackathons",
    attended_before: false,
    linkedin_url: "https://www.linkedin.com/in/example",
    github_url: "https://github.com/example",
    devpost_url: null,
    resume_url: "https://example.com/resume.pdf",
    essay_proudest_project: essay("I built a model."),
    essay_unique_thing: essay("I like data."),
    essay_goal: essay("I want to learn."),
    funniest_joke: "Why did the dataset break up? Too many outliers.",
    lifetime_goal: "Ship something useful.",
    heard_about: ["Instagram", "Friend or word of mouth"],
    wants_travel_stipend: false,
    travel_region: null,
    travel_method: null,
    travel_distance: null,
    travel_stipend_reason: null,
    agreed_to_terms: true,
  };
}

async function setup() {
  const nUsers = flag("users", 500);
  const nEvents = flag("events", 80);

  // Events: LOADTEST00 (main) plus extras that only multiply insert slots.
  const have = new Set((await events()).map(e => e.code));
  const missing = Array.from({ length: nEvents }, (_, i) => eventCode(i)).filter(c => !have.has(c));
  if (missing.length) {
    await admin("/rest/v1/events", { method: "POST", body: missing.map(code => ({ code, name: `Load test ${code}`, applications_open: true })) });
  }

  const password = readData("password.json", null)?.password ?? randomBytes(18).toString("base64url");
  writeData("password.json", { password });

  const emails = Array.from({ length: nUsers }, (_, i) => emailFor(i + 1));
  let made = 0;
  const users = await pool(emails, 10, async email => {
    const u = await createUser(email, password);
    if (++made % 100 === 0) console.log(`  ${made}/${nUsers} accounts`);
    return { id: u.id, email };
  });

  // The organizer: an account with the organizer role at LOADTEST00.
  const org = await createUser(ORGANIZER_EMAIL, password);
  await admin("/rest/v1/profiles", { method: "POST", prefer: "resolution=merge-duplicates", body: { id: org.id, email: ORGANIZER_EMAIL } });
  const main = (await events()).find(e => e.code === eventCode(0));
  await admin("/rest/v1/event_roles", { method: "POST", prefer: "resolution=ignore-duplicates", body: { event_id: main.id, user_id: org.id, role: "organizer" }, ok: [409] });

  writeData("users.json", { users, organizer: { id: org.id, email: ORGANIZER_EMAIL } });
  writeData("config.json", { url: URL_, anonKey: ANON, events: nEvents });
  console.log(`Setup: ${(await events()).length} events, ${users.length} applicant accounts, 1 organizer.`);
}

/**
 * Signs every account in with its password, paced to --rate per minute, and
 * saves the access tokens for k6. Separates Supabase Auth's per-IP sign-in
 * limit from database capacity: k6 then only talks to the database.
 */
async function sessions() {
  const rate = flag("rate", 25);
  const limit = flag("limit", Infinity);
  const { password } = readData("password.json");
  const { users, organizer } = readData("users.json");
  const existing = readData("sessions.json", { sessions: [], organizer: null });
  const now = Date.now() / 1000;
  const fresh = s => s && s.expires_at - now > 15 * 60; // at least 15 minutes left
  const have = new Map(existing.sessions.filter(fresh).map(s => [s.email, s]));

  const signIn = async email => {
    for (;;) {
      const res = await call("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password }, ok: [429] });
      if (res.status !== 429) return res.data;
      console.log(`  429 from Auth after ${count} sign-ins this run; waiting 60 s`);
      rateLimited++;
      await sleep(60_000);
    }
  };

  let count = 0;
  let rateLimited = 0;
  const started = Date.now();
  const todo = [organizer, ...users].filter(u => !have.has(u.email)).slice(0, limit);
  let org = fresh(existing.organizer) ? existing.organizer : null;
  for (const u of todo) {
    const t0 = Date.now();
    const d = await signIn(u.email);
    count++;
    const s = { email: u.email, user_id: d.user.id, access_token: d.access_token, expires_at: d.expires_at };
    if (u.email === organizer.email) org = s;
    else have.set(u.email, s);
    if (count % 25 === 0) {
      writeData("sessions.json", { sessions: [...have.values()], organizer: org });
      console.log(`  ${count}/${todo.length} signed in (${((Date.now() - started) / 60000).toFixed(1)} min, ${rateLimited} rate-limit waits)`);
    }
    await sleep(Math.max(0, 60_000 / rate - (Date.now() - t0)));
  }
  writeData("sessions.json", { sessions: [...have.values()], organizer: org });
  const exp = Math.min(...[...have.values()].map(s => s.expires_at));
  console.log(`Sessions: ${have.size} applicants + organizer. ${rateLimited} rate-limit waits. Earliest token expires ${new Date(exp * 1000).toISOString()}.`);
}

/** Many applications in LOADTEST00, so the organizer console has a realistic list to load. */
async function apps() {
  const count = flag("count", 1500);
  const main = (await events()).find(e => e.code === eventCode(0));
  const { headers } = await admin(`/rest/v1/applications?select=id&event_id=eq.${main.id}&user_id=is.null`, { prefer: "count=exact" });
  const have = Number(headers.get("content-range")?.split("/")[1] ?? 0);
  const rows = Array.from({ length: Math.max(0, count - have) }, (_, i) => ({ ...hackerApplication(have + i), event_id: main.id, user_id: null, email: `seed${have + i}@${EMAIL_DOMAIN}` }));
  for (let i = 0; i < rows.length; i += 500) {
    await admin("/rest/v1/applications", { method: "POST", body: rows.slice(i, i + 500) });
  }
  console.log(`LOADTEST00 now has ${have + rows.length} seeded applications (+ any from session users).`);
}

/** Gives every session user an application in LOADTEST00, for the status-page spike. */
async function ownApps() {
  const main = (await events()).find(e => e.code === eventCode(0));
  const { sessions: list } = readData("sessions.json");
  const profiles = list.map(s => ({ id: s.user_id, email: s.email }));
  for (let i = 0; i < profiles.length; i += 500) {
    await admin("/rest/v1/profiles", { method: "POST", prefer: "resolution=merge-duplicates", body: profiles.slice(i, i + 500) });
  }
  const rows = list.map((s, i) => ({ ...hackerApplication(i), event_id: main.id, user_id: s.user_id, email: s.email }));
  for (let i = 0; i < rows.length; i += 500) {
    await admin("/rest/v1/applications?on_conflict=user_id,event_id", { method: "POST", prefer: "resolution=ignore-duplicates", body: rows.slice(i, i + 500) });
  }
  console.log(`${rows.length} session users have a LOADTEST00 application.`);
}

/** Deletes applications in LOADTEST01..NN (the applicant-flow insert slots). */
async function reset() {
  const ids = (await events()).filter(e => e.code !== eventCode(0)).map(e => e.id);
  if (ids.length) await admin(`/rest/v1/applications?event_id=in.(${ids.join(",")})`, { method: "DELETE" });
  console.log("Applicant-flow applications deleted.");
}

async function status() {
  const evs = await events();
  const count = async (table, filter) => {
    const { headers } = await admin(`/rest/v1/${table}?select=*&${filter}`, { prefer: "count=exact" });
    return headers.get("content-range")?.split("/")[1];
  };
  const ids = evs.map(e => e.id).join(",");
  console.log({
    events: evs.length,
    applications: ids ? await count("applications", `event_id=in.(${ids})`) : 0,
    attendees: ids ? await count("attendees", `event_id=in.(${ids})`) : 0,
    profiles: await count("profiles", `email=like.*%40${EMAIL_DOMAIN}`),
    authUsers: (await allLoadTestUsers()).length,
  });
}

async function cleanup() {
  const evs = await events();
  const ids = evs.map(e => e.id);
  if (ids.length) {
    // Applications reference events without a cascade, so they go first.
    await admin(`/rest/v1/applications?event_id=in.(${ids.join(",")})`, { method: "DELETE" });
    await admin(`/rest/v1/event_roles?event_id=in.(${ids.join(",")})`, { method: "DELETE" });
    await admin(`/rest/v1/events?id=in.(${ids.join(",")})`, { method: "DELETE" });
  }
  const users = await allLoadTestUsers();
  let n = 0;
  // Deleting the auth user cascades to profiles (and anything left that references them).
  await pool(users, 10, async u => {
    await admin(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" });
    if (++n % 200 === 0) console.log(`  ${n}/${users.length} accounts deleted`);
  });
  await admin(`/rest/v1/profiles?email=like.*%40${EMAIL_DOMAIN}`, { method: "DELETE" });
  writeData("sessions.json", { sessions: [], organizer: null });
  console.log(`Cleanup: removed ${evs.length} events and ${users.length} accounts.`);
  await status();
}

const commands = { setup, sessions, apps, "own-apps": ownApps, reset, status, cleanup };
if (!commands[cmd]) {
  console.log(`Usage: node scripts/loadtest/seed.mjs <${Object.keys(commands).join("|")}>`);
  process.exit(1);
}
await commands[cmd]();
