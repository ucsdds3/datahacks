// Dev only: create a dummy applicant account and submit its application the
// way a real applicant would (signed in as them, so every database rule
// applies). Accounts are on example.com and share VITE_DEV_TEST_PASSWORD.
//
//   node scripts/dev/create-dummy-applicant.mjs path/to/applicant.json [...more.json]
//
// applicant.json: { "email": "...@example.com", "name": "First Last",
//                   "application": { applicant_type, first_name, ... } }
// Reads VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// and VITE_DEV_TEST_PASSWORD from .env.local. Never prints them.

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split("\n")
    .map(line => line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, "")]),
);
const URL_ = env.VITE_SUPABASE_URL.replace(/\/$/, "");
const ANON = env.VITE_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = env.VITE_DEV_TEST_PASSWORD;
const EVENT_CODE = "DH27BETA";

const call = async (path, { method = "GET", key = ANON, token, body, prefer } = {}) => {
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token ?? key}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
  return data;
};

const [event] = await call(`/rest/v1/events?code=eq.${EVENT_CODE}&select=id`);
if (!event) throw new Error(`No ${EVENT_CODE} event`);

const admin = { key: SERVICE };
const { users } = await call("/auth/v1/admin/users?per_page=1000", admin);

for (const file of process.argv.slice(2)) {
  const spec = JSON.parse(readFileSync(file, "utf8"));
  if (!spec.email.endsWith("@example.com")) throw new Error(`${spec.email}: dummy accounts must be @example.com`);

  let user = users.find(u => u.email === spec.email);
  const profile = { email: spec.email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: spec.name, dummy: true } };
  user = user
    ? await call(`/auth/v1/admin/users/${user.id}`, { ...admin, method: "PUT", body: profile })
    : await call("/auth/v1/admin/users", { ...admin, method: "POST", body: profile });

  const session = await call("/auth/v1/token?grant_type=password", { method: "POST", body: { email: spec.email, password: PASSWORD } });
  const as = { token: session.access_token };

  await call("/rest/v1/profiles", { ...as, method: "POST", body: { id: user.id, email: spec.email }, prefer: "resolution=merge-duplicates,return=minimal" });

  const existing = await call(`/rest/v1/applications?user_id=eq.${user.id}&event_id=eq.${event.id}&select=id`, as);
  if (existing.length) {
    console.log(`${spec.email}: already applied, skipped`);
    continue;
  }
  await call("/rest/v1/applications", {
    ...as,
    method: "POST",
    prefer: "return=minimal",
    body: {
      status: "submitted",
      submitted_at: new Date().toISOString(),
      ...spec.application,
      user_id: user.id,
      event_id: event.id,
      email: spec.email,
    },
  });
  console.log(`${spec.email}: ${spec.application.applicant_type} application submitted`);
}
