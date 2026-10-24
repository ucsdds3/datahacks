// Shared helpers for the load-test seed/cleanup scripts. Node 18+, no deps.
//
// Credentials come from scripts/loadtest/staging.env.local (gitignored by
// *.local) or the environment: SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY. They are never printed.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const HERE = new URL(".", import.meta.url);
export const DATA_DIR = new URL(".data/", HERE);

/** Projects that must never receive load or writes from these scripts. */
const FORBIDDEN_REFS = ["yrxjhrrphhbmqejresvy"]; // production
/** Only this project is allowed unless LOADTEST_ALLOW_REF says otherwise. */
const ALLOWED_REF = process.env.LOADTEST_ALLOW_REF ?? "gpoqlosneoicpzrluilj"; // staging

function readEnvFile() {
  const file = new URL("staging.env.local", HERE);
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split("\n")
      .map(line => line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, "")]),
  );
}

const fileEnv = readEnvFile();
const get = name => process.env[name] ?? fileEnv[name];

export const URL_ = (get("SUPABASE_URL") ?? "").replace(/\/$/, "");
export const ANON = get("SUPABASE_ANON_KEY");
export const SERVICE = get("SUPABASE_SERVICE_ROLE_KEY");

if (!URL_ || !ANON || !SERVICE) {
  throw new Error("Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (see scripts/loadtest/README.md).");
}
const ref = new globalThis.URL(URL_).hostname.split(".")[0];
if (FORBIDDEN_REFS.includes(ref)) throw new Error(`Refusing to run against production (${ref}).`);
if (ref !== ALLOWED_REF) throw new Error(`Refusing to run against ${ref}: only ${ALLOWED_REF} (staging) is allowed. Set LOADTEST_ALLOW_REF to override.`);

/** All load-test accounts live under this domain, so cleanup can find them. */
export const EMAIL_DOMAIN = "loadtest.example.com";
export const emailFor = i => `lt${String(i).padStart(5, "0")}@${EMAIL_DOMAIN}`;
/** Event codes: LOADTEST00 is the main event; 01..NN only multiply insert slots. */
export const eventCode = i => `LOADTEST${String(i).padStart(2, "0")}`;
export const ORGANIZER_EMAIL = `organizer@${EMAIL_DOMAIN}`;

/** fetch, retried a few times on network errors (not on HTTP errors). */
async function fetchRetry(url, init, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise(r => setTimeout(r, 2000 * i));
    }
  }
}

export async function call(path, { method = "GET", key = ANON, token, body, prefer, ok = [] } = {}) {
  const res = await fetchRetry(`${URL_}${path}`, {
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
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok && !ok.includes(res.status)) {
    const err = new Error(`${method} ${path.split("?")[0]}: ${res.status} ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return { status: res.status, data, headers: res.headers };
}

export const admin = (path, opts = {}) => call(path, { ...opts, key: SERVICE });

export function readData(name, fallback) {
  const file = new URL(name, DATA_DIR);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback;
}

export function writeData(name, value) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(new URL(name, DATA_DIR), JSON.stringify(value, null, 1), { mode: 0o600 });
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Runs fn over items with at most `limit` in flight. */
export async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }));
  return results;
}
