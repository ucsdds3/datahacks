import { describe, expect, it } from "vitest";
import { importRows, matchWaivers, parseCsv, parseDocuSignDate, readDocuSignExport } from "./waiverImport";
import type { Row } from "./types";

const OPTS = { idLabel: "datahacks_id", roleName: "Participant" };
const ID1 = "6f1c2a9e-3b7d-4e8a-9c0f-1a2b3c4d5e61";
const ID2 = "6f1c2a9e-3b7d-4e8a-9c0f-1a2b3c4d5e62";
const ID3 = "6f1c2a9e-3b7d-4e8a-9c0f-1a2b3c4d5e63";
const ID4 = "6f1c2a9e-3b7d-4e8a-9c0f-1a2b3c4d5e64";
const ID5 = "6f1c2a9e-3b7d-4e8a-9c0f-1a2b3c4d5e65";

const row = (id: string, first: string, email: string, extra: Partial<Row> = {}): Row => ({
  id, applicant_type: "hacker", status: "accepted", submitted_at: null, first_name: first, last_name: "Test", email,
  phone: null, school: null, level_of_study: null, organization: null, heard_about: null, decision: "accepted", decided_by: null, decided_at: null, decision_version: 1, decision_released_at: null,
  decision_emailed_at: null, code: null, checkedIn: false, passSentAt: null, waiverSignedAt: null, ...extra,
});

const ROWS: Row[] = [
  row(ID1, "José", "Jose.Nunez@UCSD.edu"),
  row(ID2, "Siobhán", "siobhan@example.com"),
  row(ID3, "Already", "already@example.com", { waiverSignedAt: "2026-11-01T00:00:00Z" }),
  row(ID4, "Waitlisted", "wait@example.com", { status: "waitlisted", decision: "waitlisted" }),
  row(ID5, "Mentor", "mentor@example.com", { applicant_type: "mentor" }),
];

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, commas and line breaks in fields, CRLF and a BOM", () => {
    const text = "\uFEFFName,Note\r\n\"O'Brien, Siobhán\",\"said \"\"hi\"\"\nthen left\"\r\nZoë,plain\r\n\r\n";
    expect(parseCsv(text)).toEqual([["Name", "Note"], ["O'Brien, Siobhán", 'said "hi"\nthen left'], ["Zoë", "plain"]]);
  });

  it("reads semicolon- or tab-separated files", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("parseDocuSignDate", () => {
  it("reads ISO times with a zone exactly", () => {
    expect(parseDocuSignDate("2026-11-05T23:04:05.123Z")).toBe("2026-11-05T23:04:05.000Z");
    expect(parseDocuSignDate("2026-11-05T15:04:05-08:00")).toBe("2026-11-05T23:04:05.000Z");
    expect(parseDocuSignDate("11/5/2026 11:04:05 PM UTC")).toBe("2026-11-05T23:04:05.000Z");
  });

  it("reads US and plain times in the browser's zone", () => {
    const local = (y: number, m: number, d: number, h: number, mi: number, s = 0) => new Date(y, m - 1, d, h, mi, s).toISOString();
    expect(parseDocuSignDate("11/5/2026 3:04:05 PM")).toBe(local(2026, 11, 5, 15, 4, 5));
    expect(parseDocuSignDate("11/05/2026 | 12:30 AM")).toBe(local(2026, 11, 5, 0, 30));
    expect(parseDocuSignDate("11/05/26 12:30 PM PST")).toBe(local(2026, 11, 5, 12, 30));
    expect(parseDocuSignDate("2026-11-05 15:04:05")).toBe(local(2026, 11, 5, 15, 4, 5));
    expect(parseDocuSignDate("11/5/2026")).toBe(local(2026, 11, 5, 0, 0));
  });

  it("is null for anything else", () => {
    for (const s of ["", "yesterday", "13/40/2026", "2026-02-30 10:00", "Completed"]) expect(parseDocuSignDate(s)).toBeNull();
  });
});

describe("readDocuSignExport", () => {
  it("reads the PowerForm data download (Role 1:: columns, only completed envelopes)", () => {
    const csv = [
      "Envelope ID,Role 1::Role Name,Role 1::Name,Role 1::Email,Role 1::datahacks_id,Role 1::DateSigned",
      `0f1e2d3c-aaaa-bbbb-cccc-1234567890ab,Participant,"Núñez, José",jose.nunez@ucsd.edu,${ID1},11/5/2026 3:04:05 PM`,
      `1f1e2d3c-aaaa-bbbb-cccc-1234567890ab,Participant,Siobhán O'Brien,SIOBHAN@example.com,,`,
    ].join("\r\n");
    const p = readDocuSignExport(csv, OPTS);
    expect(p.format).toBe("powerform-data");
    expect(p.columns).toMatchObject({ id: true, email: true, completedAt: true });
    expect(p.entries[0]).toMatchObject({ line: 2, envelopeId: "0f1e2d3c-aaaa-bbbb-cccc-1234567890ab", name: "Núñez, José", email: "jose.nunez@ucsd.edu", datahacksId: ID1, completed: true });
    expect(p.entries[0].completedAt).toBe(new Date(2026, 10, 5, 15, 4, 5).toISOString());
    // No time in the row, but the PowerForm download only has completed envelopes.
    expect(p.entries[1]).toMatchObject({ completed: true, completedAt: null, datahacksId: "" });
  });

  it("finds columns by header name in any case or spacing, including a bare field label", () => {
    const csv = `ENVELOPEID,recipient email,Recipient Name,Status,Completed,DataHacksID\n0f1e,a@b.c,A B,completed,2026-11-05T10:00:00Z,${ID2}\n`;
    const p = readDocuSignExport(csv, OPTS);
    expect(p.format).toBe("form-data");
    expect(p.entries[0]).toMatchObject({ envelopeId: "0f1e", email: "a@b.c", name: "A B", datahacksId: ID2, completed: true, completedAt: "2026-11-05T10:00:00.000Z" });
  });

  it("reads the Envelope Recipient Report (no field values; status decides)", () => {
    const csv = [
      "Envelope ID,Subject,Status,Recipient,Recipient Email,Recipient Status,Recipient Signed",
      "e1,DataHacks 2027 Liability Waiver,Completed,Siobhán O'Brien,siobhan@example.com,Completed,11/04/2026 09:15:00 AM",
      "e2,DataHacks 2027 Liability Waiver,Sent,Pat Pending,pat@example.com,Sent,",
      "e3,DataHacks 2027 Liability Waiver,Declined,Dee Clined,dee@example.com,Declined,",
      "e4,DataHacks 2027 Liability Waiver,Voided,Vo Ided,vo@example.com,Created,",
    ].join("\n");
    const p = readDocuSignExport(csv, OPTS);
    expect(p.format).toBe("report");
    expect(p.columns.id).toBe(false);
    expect(p.entries.map(e => [e.name, e.completed, e.status])).toEqual([
      ["Siobhán O'Brien", true, "Completed"], ["Pat Pending", false, "Sent"], ["Dee Clined", false, "Declined"], ["Vo Ided", false, "Voided"],
    ]);
    expect(p.entries[0].completedAt).toBe(new Date(2026, 10, 4, 9, 15).toISOString());
  });

  it("groups form data with one row per field by envelope", () => {
    const csv = [
      "Envelope Id,Recipient Name,Recipient Email,Field Name,Value,Envelope Status",
      `e1,José Núñez,jose.nunez@ucsd.edu,Full Name,José Núñez,Completed`,
      `e1,José Núñez,jose.nunez@ucsd.edu,datahacks_id,${ID1},Completed`,
      `e1,José Núñez,jose.nunez@ucsd.edu,Date Signed,11/5/2026,Completed`,
      `e2,Pat,pat@example.com,datahacks_id,,Sent`,
    ].join("\n");
    const p = readDocuSignExport(csv, OPTS);
    expect(p.format).toBe("form-data-fields");
    expect(p.entries).toHaveLength(2);
    expect(p.entries[0]).toMatchObject({ envelopeId: "e1", datahacksId: ID1, completed: true, completedAt: new Date(2026, 10, 5).toISOString() });
    expect(p.entries[1]).toMatchObject({ envelopeId: "e2", completed: false });
  });

  it("refuses a file that isn't a DocuSign export", () => {
    expect(() => readDocuSignExport("foo,bar\n1,2", OPTS)).toThrow(/doesn't look like a DocuSign export/);
    expect(() => readDocuSignExport("", OPTS)).toThrow(/empty/);
  });
});

const entry = (over: Partial<ReturnType<typeof readDocuSignExport>["entries"][number]>) => ({
  line: 2, envelopeId: "env", name: "N", email: "", datahacksId: "", completedAt: "2026-11-05T10:00:00.000Z", completed: true, status: "Completed", ...over,
});

describe("matchWaivers", () => {
  it("matches by datahacks_id first, else by email in any case", () => {
    const m = matchWaivers([
      entry({ line: 2, datahacksId: ID1, email: "someone-else@gmail.com" }),
      entry({ line: 3, email: "SIOBHAN@Example.COM " }),
    ], ROWS);
    expect(m.counts).toEqual({ ready: 2, already: 0, unmatched: 0, not_completed: 0 });
    expect(m.items.map(i => [i.row?.id, i.by])).toEqual([[ID1, "id"], [ID2, "email"]]);
  });

  it("falls back to email when the id isn't one of this event's applications", () => {
    const m = matchWaivers([entry({ datahacksId: "00000000-0000-0000-0000-000000000000", email: "jose.nunez@ucsd.edu" })], ROWS);
    expect(m.items[0]).toMatchObject({ kind: "ready", by: "email" });
    expect(m.items[0].row?.id).toBe(ID1);
  });

  it("sorts out already on file, not accepted, unknown and not completed", () => {
    const m = matchWaivers([
      entry({ line: 2, email: "already@example.com" }),
      entry({ line: 3, datahacksId: ID4 }),
      entry({ line: 4, email: "stranger@example.com" }),
      entry({ line: 5, email: "siobhan@example.com", completed: false, status: "Sent", completedAt: null }),
      entry({ line: 6, email: "" }),
    ], ROWS);
    expect(m.counts).toEqual({ ready: 0, already: 1, unmatched: 3, not_completed: 1 });
    expect(m.items.map(i => [i.entry.line, i.kind, i.reason])).toEqual([
      [2, "already", "Waiver already on file"],
      [3, "unmatched", "Application is waitlisted"],
      [4, "unmatched", "No application with this email"],
      [6, "unmatched", "No email or datahacks_id in the row"],
      [5, "not_completed", "Status: Sent"],
    ]);
  });

  it("keeps the earliest signature when someone signed twice", () => {
    const m = matchWaivers([
      entry({ line: 2, envelopeId: "later", email: "siobhan@example.com", completedAt: "2026-11-06T10:00:00.000Z" }),
      entry({ line: 3, envelopeId: "earlier", datahacksId: ID2, completedAt: "2026-11-04T10:00:00.000Z" }),
    ], ROWS);
    expect(m.counts).toMatchObject({ ready: 1, already: 1 });
    expect(m.items.find(i => i.kind === "ready")?.entry.envelopeId).toBe("earlier");
    expect(m.items.find(i => i.kind === "already")?.reason).toBe("An earlier row in this file");
  });

  it("won't guess when an email belongs to two accepted applications", () => {
    const rows = [...ROWS, row("6f1c2a9e-3b7d-4e8a-9c0f-1a2b3c4d5e66", "Twin", "mentor@example.com")];
    expect(matchWaivers([entry({ email: "mentor@example.com" })], rows).items[0]).toMatchObject({ kind: "unmatched", reason: "Email matches more than one accepted application" });
  });

  it("sends only ready rows, with a clean envelope id and the CSV time", () => {
    const m = matchWaivers([
      entry({ line: 2, datahacksId: ID1, envelopeId: "0f1e2d3c-aaaa-bbbb-cccc-1234567890ab" }),
      entry({ line: 3, email: "siobhan@example.com", envelopeId: "<script>", completedAt: null }),
      entry({ line: 4, email: "already@example.com" }),
    ], ROWS);
    expect(importRows(m.items)).toEqual([
      { application_id: ID1, envelope_id: "0f1e2d3c-aaaa-bbbb-cccc-1234567890ab", signed_at: "2026-11-05T10:00:00.000Z" },
      { application_id: ID2, envelope_id: null, signed_at: null },
    ]);
  });
});
