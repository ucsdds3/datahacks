// Prefills DH27 hackers' day-of logistics (emergency contact, dietary
// restrictions, shirt size, overnight stay, team matching) from their DH26
// Google Form answers, for people who applied both years.
//
//   node scripts/import/dh26-logistics.mjs matches.csv                  # dry run: counts only
//   node scripts/import/dh26-logistics.mjs matches.csv --apply          # writes
//   node scripts/import/dh26-logistics.mjs matches.csv --apply --include-name-matches
//
// matches.csv has one row per DH27 application with at least these columns:
//   app_id     the DH27 applications.id
//   match      how it was matched to DH26: "email", "email (name differs)",
//              "name", or anything else (skipped)
//   ec_name, ec_phone, ec_rel, allergies, shirt, overnight, team
//              the DH26 answers, as the form saved them
// It holds personal data: keep it out of the repo and delete it when done.
//
// Only email matches are used unless --include-name-matches is given. A column
// that already has a value is never overwritten, and rows it fills get
// logistics_source = 'dh26_import'. Prints counts only, never names or answers.
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local (never prints them).

import { readFileSync } from "node:fs";
import { LOGISTICS_COLUMNS, logisticsFromDh26 } from "./dh26-logistics-normalize.mjs";

const args = process.argv.slice(2);
const csvPath = args.find(a => !a.startsWith("--"));
const apply = args.includes("--apply");
const includeName = args.includes("--include-name-matches");
if (!csvPath) {
  console.error("Usage: node scripts/import/dh26-logistics.mjs matches.csv [--apply] [--include-name-matches]");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split("\n")
    .map(line => line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, "")]),
);
const URL_ = (env.SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_.startsWith("https://") || !KEY) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");

const call = async (path, { method = "GET", body } = {}) => {
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  // Status only: an error body can echo the values sent.
  if (!res.ok) throw new Error(`${method} ${path.split("?")[0]}: HTTP ${res.status}`);
  return text ? JSON.parse(text) : null;
};

/** RFC 4180 CSV (quoted fields may hold commas, quotes and line breaks) -> objects keyed by the header. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter(r => r.some(Boolean));
  return body.map(r => Object.fromEntries(header.map((h, i) => [h.replace(/^﻿/, ""), r[i] ?? ""])));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USE = new Set(["email", "email (name differs)", ...(includeName ? ["name"] : [])]);

const rows = parseCsv(readFileSync(csvPath, "utf8"));
const count = {};
const bump = (k, n = 1) => { count[k] = (count[k] ?? 0) + n; };
bump("rows in the CSV", rows.length);

const wanted = new Map();
for (const row of rows) {
  if (!USE.has(row.match)) { bump(`skipped: match "${row.match || "blank"}"`); continue; }
  if (!UUID.test(row.app_id)) { bump("skipped: bad app_id"); continue; }
  const { values, unmapped } = logisticsFromDh26(row);
  for (const col of unmapped) bump(`unmapped ${col} (left empty)`);
  if (!Object.keys(values).length) { bump("skipped: nothing usable in DH26 answers"); continue; }
  wanted.set(row.app_id, values);
}

// What's there now, so nothing is overwritten.
const current = new Map();
const ids = [...wanted.keys()];
for (let i = 0; i < ids.length; i += 100) {
  const batch = ids.slice(i, i + 100);
  const got = await call(`/rest/v1/applications?id=in.(${batch.join(",")})&select=id,applicant_type,logistics_source,${LOGISTICS_COLUMNS.join(",")}`);
  for (const a of got) current.set(a.id, a);
}

const patches = [];
for (const [id, values] of wanted) {
  const now = current.get(id);
  if (!now) { bump("skipped: application not found"); continue; }
  if (now.applicant_type !== "hacker") { bump("skipped: not a hacker application"); continue; }
  const patch = Object.fromEntries(Object.entries(values).filter(([col]) => now[col] == null));
  if (!Object.keys(patch).length) { bump("skipped: already filled"); continue; }
  if (now.logistics_source == null) patch.logistics_source = "dh26_import";
  for (const col of Object.keys(patch)) if (col !== "logistics_source") bump(`fill ${col}`);
  patches.push([id, patch]);
}
bump("applications to fill", patches.length);

if (apply) {
  for (const [id, patch] of patches) {
    await call(`/rest/v1/applications?id=eq.${id}`, { method: "PATCH", body: patch });
    bump("applications filled");
  }
}

console.log(apply ? "APPLIED" : "DRY RUN (nothing written; add --apply to write)");
console.log(`Matches used: ${[...USE].join(", ")}`);
for (const [k, v] of Object.entries(count).sort()) console.log(`  ${k}: ${v}`);
