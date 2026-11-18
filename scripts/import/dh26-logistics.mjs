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
// Only email matches are used unless --include-name-matches is given. An
// application with any logistics_source is skipped (the applicant answered for
// DH27, or an earlier run filled it); otherwise only empty columns are filled,
// and logistics_source becomes 'dh26_import'. Each write re-checks those
// conditions and must update exactly one row: any that doesn't is listed by
// application id, the rest still run, and the script exits non-zero.
// Prints counts and failed ids only, never names or answers.
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local (never prints them).

import { readFileSync } from "node:fs";
import { LOGISTICS_COLUMNS } from "./dh26-logistics-normalize.mjs";
import { APPLY_COUNTERS, SUMMARY_COUNTERS, applyPatches, counter, matchesUsed, parseCsv, planPatches, wantedFromRows } from "./dh26-logistics-plan.mjs";

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

const call = async (path, { method = "GET", body, prefer } = {}) => {
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  // Status only: an error body can echo the values sent.
  if (!res.ok) throw new Error(`${method} ${path.split("?")[0]}: HTTP ${res.status}`);
  return text ? JSON.parse(text) : null;
};

const { count, bump } = counter(apply ? [...SUMMARY_COUNTERS, ...APPLY_COUNTERS] : SUMMARY_COUNTERS);
const rows = parseCsv(readFileSync(csvPath, "utf8"));
bump("rows in the CSV", rows.length);
const wanted = wantedFromRows(rows, { includeName }, bump);

// What's there now, so nothing is overwritten.
const current = new Map();
const ids = [...wanted.keys()];
for (let i = 0; i < ids.length; i += 100) {
  const batch = ids.slice(i, i + 100);
  const got = await call(`/rest/v1/applications?id=in.(${batch.join(",")})&select=id,applicant_type,logistics_source,${LOGISTICS_COLUMNS.join(",")}`);
  for (const a of got) current.set(a.id, a);
}

const patches = planPatches(wanted, current, bump);
const failed = apply ? await applyPatches(patches, call, bump) : [];

console.log(apply ? "APPLIED" : "DRY RUN (nothing written; add --apply to write)");
console.log(`Matches used: ${[...matchesUsed(includeName)].join(", ")}`);
for (const [k, v] of Object.entries(count).sort()) console.log(`  ${k}: ${v}`);
if (failed.length) {
  console.log(`Not updated (application ids; re-run to retry, already-filled rows are skipped):`);
  for (const id of failed) console.log(`  ${id}`);
  process.exitCode = 1;
}
