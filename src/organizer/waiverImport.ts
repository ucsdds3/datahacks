/**
 * Reading DocuSign's CSV exports of the waiver PowerForm, and matching each
 * signed envelope to an accepted application. Pure functions; WaiversPage
 * shows the result and record_waivers_import (database) writes it.
 *
 * Exports it understands (columns are found by header name, any case and
 * spacing; see docs/docusign-powerform-setup.md for how to download each):
 *
 *  - PowerForm data (Agreements → PowerForms → Download → CSV): one row per
 *    completed envelope. "Envelope ID", then each signer's columns prefixed
 *    "Role 1::" (role name, name, email) and the form's fields by data label,
 *    including datahacks_id and the Date Signed field.
 *  - Form data with one row per field ("Field Name" / "Value" columns, e.g. an
 *    envelope's Download → Form Data): rows are grouped by envelope.
 *  - Envelope or recipient reports (Reports → Envelope Recipient Report →
 *    Export): "Envelope ID", status, recipient name/email and a completed or
 *    signed time, but no field values, so those match by email.
 */
import type { Row } from "./types";

export type ExportFormat = "powerform-data" | "form-data-fields" | "form-data" | "report";

export const FORMAT_LABEL: Record<ExportFormat, string> = {
  "powerform-data": "PowerForm data export (one row per envelope)",
  "form-data-fields": "Form data (one row per field)",
  "form-data": "Form data",
  report: "Envelope / recipient report (no field values: matched by email)",
};

/** One envelope (or recipient) from the file. */
export type ExportEntry = {
  /** 1-based line in the file (the first data row is line 2). */
  line: number;
  envelopeId: string | null;
  name: string;
  email: string;
  /** The datahacks_id field (an application id), when the file has it. */
  datahacksId: string;
  /** ISO time it was completed or signed, when the file says. */
  completedAt: string | null;
  completed: boolean;
  /** The status as the file wrote it ("" when it has none). */
  status: string;
};

export type ParsedExport = { format: ExportFormat; entries: ExportEntry[]; columns: { id: boolean; email: boolean; completedAt: boolean; status: boolean } };

// ---------- CSV ----------

/** RFC 4180 CSV: quoted fields, doubled quotes, CRLF or LF, a BOM. Also takes ; or tab when the header uses them. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delim = count("\t") > count(",") && count("\t") >= count(";") ? "\t" : count(";") > count(",") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim() !== ""));
}

// ---------- Dates ----------

/**
 * A DocuSign time as an ISO string, or null. Takes ISO ("2026-11-05T15:04:05Z"),
 * US ("11/5/2026 3:04:05 PM", "11/05/2026 | 03:04 PM") and "2026-11-05 15:04:05".
 * Times without a zone are read in this browser's zone (Pacific at DataHacks).
 */
export function parseDocuSignDate(value: string): string | null {
  let s = value.trim().replace(/\s*\|\s*/g, " ").replace(/\s+/g, " ");
  if (!s) return null;
  const utc = /\s(UTC|GMT)$/i.test(s);
  s = s.replace(/\s*\((?:UTC|GMT)[^)]*\)$/i, "").replace(/\s(UTC|GMT|[A-Z]{2,4}T)$/i, "");
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i.exec(s);
  if (iso) {
    const [, y, mo, d, h = "0", mi = "0", se = "0", zone] = iso;
    if (zone || utc) {
      const t = Date.parse(`${y}-${mo}-${d}T${h.padStart(2, "0")}:${mi}:${se.padStart(2, "0")}${zone ? (zone.toUpperCase() === "Z" ? "Z" : zone.length === 5 ? `${zone.slice(0, 3)}:${zone.slice(3)}` : zone) : "Z"}`);
      return Number.isNaN(t) ? null : new Date(t).toISOString();
    }
    return local(+y, +mo, +d, +h, +mi, +se);
  }
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i.exec(s);
  if (us) {
    const [, mo, d, yy, h = "0", mi = "0", se = "0", ampm] = us;
    let hour = +h;
    if (ampm) hour = (hour % 12) + (ampm.toUpperCase() === "PM" ? 12 : 0);
    const year = yy.length === 2 ? 2000 + +yy : +yy;
    if (utc) {
      const t = Date.UTC(year, +mo - 1, +d, hour, +mi, +se);
      return Number.isNaN(t) ? null : new Date(t).toISOString();
    }
    return local(year, +mo, +d, hour, +mi, +se);
  }
  return null;
}

function local(y: number, mo: number, d: number, h: number, mi: number, s: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const date = new Date(y, mo - 1, d, h, mi, s);
  return Number.isNaN(date.getTime()) || date.getDate() !== d ? null : date.toISOString();
}

// ---------- Reading an export ----------

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const ROLE_PREFIX = /^\s*role\s*(\d+)\s*::\s*/i;

type Column = { index: number; key: string; role: number | null };

function columnsOf(header: string[]): Column[] {
  return header.map((raw, index) => {
    const m = ROLE_PREFIX.exec(raw);
    return { index, key: key(m ? raw.slice(m[0].length) : raw), role: m ? Number(m[1]) : null };
  });
}

/** The first candidate any column has (exact key), preferring role 1 / no role. */
function pick(cols: Column[], candidates: (string | ((k: string) => boolean))[]): Column | null {
  for (const cand of candidates) {
    const hits = cols.filter(c => (typeof cand === "string" ? c.key === cand : cand(c.key)));
    if (hits.length) return hits.find(c => c.role === 1) ?? hits.find(c => c.role === null) ?? hits[0];
  }
  return null;
}

const ENVELOPE = ["envelopeid", "envelopeguid", "envelope", "envid"];
const emailCandidates = (role: string) => ["recipientemail", "signeremail", `${role}email`, "email", "emailaddress", "recipientemailaddress", "signeremailaddress", "useremail"];
const nameCandidates = (role: string) => ["recipientname", "signername", `${role}name`, `${role}username`, "name", "fullname", "recipient", "signer", "username"];
const ENVELOPE_STATUS = ["envelopestatus", "status"];
const RECIPIENT_STATUS = ["recipientstatus", "signerstatus"];
const COMPLETED = [
  "envelopecompleted", "envelopecompletedon", "completed", "completedon", "completeddate", "completeddatetime", "completedtime",
  "datecompleted", "completedts", "recipientsigned", "recipientsignedon", "recipientcompleted", "recipientcompletedon",
  "signed", "signedon", "signeddate", "signeddatetime", "datesigned", "datetimesigned",
  (k: string) => k.startsWith("datesigned"),
];
const FIELD_NAME = ["fieldname", "tablabel", "datalabel", "fieldlabel", "field", "tabname", "label"];
const FIELD_VALUE = ["value", "fieldvalue", "tabvalue", "data"];

const DONE = /^(completed|complete|signed)$/i;

function completion(envStatus: string, recipientStatus: string, completedAt: string | null, onlyCompleted: boolean) {
  if (envStatus) return DONE.test(envStatus.trim());
  if (recipientStatus) return DONE.test(recipientStatus.trim());
  return onlyCompleted || completedAt !== null;
}

/**
 * Reads a DocuSign CSV export into one entry per envelope (or recipient row).
 * `idLabel` is the id field's data label (DOCUSIGN.idFieldLabel); `roleName`
 * the signer role, for columns named after it.
 */
export function readDocuSignExport(text: string, { idLabel, roleName }: { idLabel: string; roleName: string }): ParsedExport {
  const [header, ...data] = parseCsv(text);
  if (!header) throw new Error("The file is empty.");
  const cols = columnsOf(header);
  const role = key(roleName);
  const idKey = key(idLabel);
  const isId = (k: string) => k === idKey || (idKey !== "" && k.endsWith(idKey)) || k === "datahacksid";

  const envelope = pick(cols, ENVELOPE);
  const email = pick(cols, emailCandidates(role));
  const name = pick(cols, nameCandidates(role).filter(c => !email || c !== email.key));
  const envStatus = pick(cols, ENVELOPE_STATUS);
  const recipientStatus = pick(cols, RECIPIENT_STATUS);
  const completedAt = pick(cols, COMPLETED);
  const id = pick(cols, [isId]);
  const fieldName = pick(cols, FIELD_NAME);
  const fieldValue = pick(cols, FIELD_VALUE);

  if (!envelope && !email && !id) {
    throw new Error("This doesn't look like a DocuSign export: no Envelope ID, email or datahacks_id column.");
  }

  const cell = (row: string[], col: Column | null) => (col ? (row[col.index] ?? "").trim() : "");

  // One row per field: group by envelope (and recipient email).
  if (fieldName && fieldValue && envelope) {
    const groups = new Map<string, { line: number; rows: string[][]; fields: Map<string, string> }>();
    data.forEach((row, i) => {
      const k = `${cell(row, envelope)}|${cell(row, email).toLowerCase()}`;
      const g = groups.get(k) ?? { line: i + 2, rows: [], fields: new Map() };
      g.rows.push(row);
      const f = key(cell(row, fieldName));
      if (f && !g.fields.has(f)) g.fields.set(f, cell(row, fieldValue));
      groups.set(k, g);
    });
    const first = (g: { rows: string[][] }, col: Column | null) => g.rows.map(r => cell(r, col)).find(Boolean) ?? "";
    const field = (g: { fields: Map<string, string> }, match: (k: string) => boolean) => [...g.fields].find(([k, v]) => match(k) && v)?.[1] ?? "";
    const entries = [...groups.values()].map(g => {
      const timeText = first(g, completedAt) || field(g, k => COMPLETED.some(c => (typeof c === "string" ? c === k : c(k))));
      const at = timeText ? parseDocuSignDate(timeText) : null;
      const es = first(g, envStatus);
      const rs = first(g, recipientStatus);
      return {
        line: g.line,
        envelopeId: first(g, envelope) || null,
        name: first(g, name) || field(g, k => k === "fullname" || k === "name"),
        email: first(g, email) || field(g, k => k === "email" || k === "emailaddress"),
        datahacksId: first(g, id) || field(g, isId),
        completedAt: at,
        completed: completion(es, rs, at, false),
        status: es || rs,
      };
    });
    return { format: "form-data-fields", entries, columns: { id: true, email: !!email, completedAt: !!completedAt, status: !!(envStatus || recipientStatus) } };
  }

  const powerForm = cols.some(c => c.role !== null);
  const format: ExportFormat = powerForm ? "powerform-data" : id ? "form-data" : "report";
  const entries = data.map((row, i) => {
    const timeText = cell(row, completedAt);
    const at = timeText ? parseDocuSignDate(timeText) : null;
    const es = cell(row, envStatus);
    const rs = cell(row, recipientStatus);
    return {
      line: i + 2,
      envelopeId: cell(row, envelope) || null,
      name: cell(row, name),
      email: cell(row, email),
      datahacksId: cell(row, id),
      completedAt: at,
      // The PowerForm download only has completed envelopes.
      completed: completion(es, rs, at, powerForm),
      status: es || rs,
    };
  });
  return { format, entries, columns: { id: !!id, email: !!email, completedAt: !!completedAt, status: !!(envStatus || recipientStatus) } };
}

// ---------- Matching ----------

export type MatchKind = "ready" | "already" | "unmatched" | "not_completed";

export type MatchedEntry = {
  entry: ExportEntry;
  kind: MatchKind;
  /** The application it matched (ready and already). */
  row?: Row;
  by?: "id" | "email";
  reason?: string;
};

export type MatchResult = { items: MatchedEntry[]; counts: Record<MatchKind, number> };

const STATUS_WORD: Record<string, string> = { draft: "a draft", submitted: "not decided yet", waitlisted: "waitlisted", rejected: "rejected" };

/**
 * Matches each completed entry to one of this event's applications: by the
 * datahacks_id field (the application id), else by email (any case) among
 * accepted applications. Already on file (or earlier in the same file) isn't
 * recorded again. The earliest signature in the file wins.
 */
export function matchWaivers(entries: ExportEntry[], rows: Row[]): MatchResult {
  const byId = new Map(rows.map(r => [r.id, r]));
  const byEmail = new Map<string, Row[]>();
  for (const r of rows) {
    const e = r.email?.trim().toLowerCase();
    if (e) byEmail.set(e, [...(byEmail.get(e) ?? []), r]);
  }
  const ordered = [...entries].sort((a, b) =>
    (a.completedAt ?? "9999").localeCompare(b.completedAt ?? "9999") || a.line - b.line);
  const taken = new Set<string>();
  const items = ordered.map((entry): MatchedEntry => {
    if (!entry.completed) {
      return { entry, kind: "not_completed", reason: entry.status ? `Status: ${entry.status}` : "No completed time in the file" };
    }
    let row: Row | undefined;
    let by: "id" | "email" | undefined;
    const id = entry.datahacksId.trim().toLowerCase();
    if (id && byId.has(id)) { row = byId.get(id); by = "id"; }
    if (!row) {
      const sameEmail = byEmail.get(entry.email.trim().toLowerCase()) ?? [];
      const accepted = sameEmail.filter(r => r.status === "accepted");
      if (accepted.length > 1) return { entry, kind: "unmatched", reason: "Email matches more than one accepted application" };
      row = accepted[0] ?? sameEmail[0];
      by = row ? "email" : undefined;
    }
    if (!row) {
      return { entry, kind: "unmatched", reason: id ? "No application with this datahacks_id or email" : entry.email ? "No application with this email" : "No email or datahacks_id in the row" };
    }
    if (row.status !== "accepted") {
      return { entry, kind: "unmatched", row, by, reason: `Application is ${STATUS_WORD[row.status ?? "draft"] ?? row.status}` };
    }
    if (row.waiverSignedAt) return { entry, kind: "already", row, by, reason: "Waiver already on file" };
    if (taken.has(row.id)) return { entry, kind: "already", row, by, reason: "An earlier row in this file" };
    taken.add(row.id);
    return { entry, kind: "ready", row, by };
  });
  const order: MatchKind[] = ["ready", "already", "unmatched", "not_completed"];
  items.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.entry.line - b.entry.line);
  const counts = { ready: 0, already: 0, unmatched: 0, not_completed: 0 } as Record<MatchKind, number>;
  for (const it of items) counts[it.kind]++;
  return { items, counts };
}

const ENVELOPE_ID = /^[A-Za-z0-9-]{1,100}$/;

/** What record_waivers_import gets for the ready rows. */
export const importRows = (items: MatchedEntry[]) =>
  items.filter(i => i.kind === "ready" && i.row).map(i => ({
    application_id: i.row!.id,
    envelope_id: i.entry.envelopeId && ENVELOPE_ID.test(i.entry.envelopeId) ? i.entry.envelopeId : null,
    signed_at: i.entry.completedAt,
  }));
