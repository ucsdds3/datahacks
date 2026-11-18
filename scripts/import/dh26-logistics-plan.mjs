// The DH26 logistics import's steps, without the network or the command line,
// so they can be tested (dh26-logistics-plan.test.mjs). dh26-logistics.mjs
// wires them to the Supabase API.

import { LOGISTICS_COLUMNS, logisticsFromDh26 } from "./dh26-logistics-normalize.mjs";

/** Counts shown in every summary, even at zero, so a dry run and a real run read the same. */
export const SUMMARY_COUNTERS = [
  "rows in the CSV",
  "skipped: answered for DH27",
  "skipped: already imported",
  "applications to fill",
];
export const APPLY_COUNTERS = ["applications filled", "failed: not updated"];

/** A counter: count[name] += n. */
export function counter(names = SUMMARY_COUNTERS) {
  const count = Object.fromEntries(names.map(n => [n, 0]));
  const bump = (k, n = 1) => { count[k] = (count[k] ?? 0) + n; };
  return { count, bump };
}

/** RFC 4180 CSV (quoted fields may hold commas, quotes and line breaks) -> objects keyed by the header. */
export function parseCsv(text) {
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

/** Which matches are trusted: email always, name only when asked. */
export const matchesUsed = (includeName = false) => new Set(["email", "email (name differs)", ...(includeName ? ["name"] : [])]);

/** The CSV rows worth importing, as application id -> the columns to fill. */
export function wantedFromRows(rows, { includeName = false } = {}, bump = () => {}) {
  const use = matchesUsed(includeName);
  const wanted = new Map();
  for (const row of rows) {
    if (!use.has(row.match)) { bump(`skipped: match "${row.match || "blank"}"`); continue; }
    if (!UUID.test(row.app_id)) { bump("skipped: bad app_id"); continue; }
    const { values, unmapped } = logisticsFromDh26(row);
    for (const col of unmapped) bump(`unmapped ${col} (left empty)`);
    if (!Object.keys(values).length) { bump("skipped: nothing usable in DH26 answers"); continue; }
    wanted.set(row.app_id, values);
  }
  return wanted;
}

/**
 * What to write, given each application as it is now (id -> row with
 * applicant_type, logistics_source and the logistics columns). A row that has
 * any logistics_source is skipped whole: 'applicant' means they answered for
 * DH27 (a null there can mean "none", like no dietary restrictions), and
 * 'dh26_import' means an earlier run already filled it. Otherwise only null
 * columns are filled, and logistics_source becomes 'dh26_import'.
 */
export function planPatches(wanted, current, bump = () => {}) {
  const patches = [];
  for (const [id, values] of wanted) {
    const now = current.get(id);
    if (!now) { bump("skipped: application not found"); continue; }
    if (now.applicant_type !== "hacker") { bump("skipped: not a hacker application"); continue; }
    if (now.logistics_source === "applicant") { bump("skipped: answered for DH27"); continue; }
    if (now.logistics_source != null) { bump("skipped: already imported"); continue; }
    const fill = Object.fromEntries(Object.entries(values).filter(([col]) => now[col] == null));
    if (!Object.keys(fill).length) { bump("skipped: already filled"); continue; }
    for (const col of Object.keys(fill)) bump(`fill ${col}`);
    patches.push([id, { ...fill, logistics_source: "dh26_import" }]);
  }
  bump("applications to fill", patches.length);
  return patches;
}

/**
 * The PATCH for one application. The filter repeats the plan's conditions
 * (still no logistics_source, and every column being set still null), so a row
 * that changed since it was read isn't touched; select=id keeps the returned
 * row to its id.
 */
export function patchPath(id, patch) {
  const nulls = Object.keys(patch).filter(col => LOGISTICS_COLUMNS.includes(col) || col === "logistics_source");
  return `/rest/v1/applications?id=eq.${id}${nulls.map(col => `&${col}=is.null`).join("")}&select=id`;
}

/**
 * Writes each patch, one at a time, through call(path, { method, body, prefer }),
 * which returns the parsed response or throws. A write counts only when exactly
 * one row comes back; anything else (no row matched, an error) is a failure,
 * and the rest still run. Returns the ids that failed.
 */
export async function applyPatches(patches, call, bump = () => {}) {
  const failed = [];
  for (const [id, patch] of patches) {
    let updated;
    try {
      updated = await call(patchPath(id, patch), { method: "PATCH", body: patch, prefer: "return=representation" });
    } catch {
      updated = null;
    }
    if (Array.isArray(updated) && updated.length === 1) bump("applications filled");
    else { bump("failed: not updated"); failed.push(id); }
  }
  return failed;
}
