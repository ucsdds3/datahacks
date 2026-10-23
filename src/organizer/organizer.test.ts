import { describe, expect, it } from "vitest";
import { csvCell, csvFilename, toCsv } from "./csv";
import { DEFAULT_TEMPLATES, fillTemplate } from "./templates";

describe("csv", () => {
  it("leaves plain values alone", () => {
    expect(csvCell("Jane")).toBe("Jane");
    expect(csvCell(42)).toBe("42");
  });

  it("quotes commas, quotes and line breaks, doubling quotes", () => {
    expect(csvCell("Doe, Jane")).toBe('"Doe, Jane"');
    expect(csvCell('She said "hi"')).toBe('"She said ""hi"""');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("writes empty cells for null and joins arrays", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(["Social Media", "Other"])).toBe("Social Media; Other");
  });

  it("defuses applicant text that a spreadsheet would run as a formula", () => {
    expect(csvCell('=HYPERLINK("https://evil.example","Click")')).toBe(`"'=HYPERLINK(""https://evil.example"",""Click"")"`);
    expect(csvCell("+1 joke")).toBe("'+1 joke");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("\tx")).toBe("'\tx");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell("(858) 555-0123")).toBe("(858) 555-0123");
  });

  it("joins rows with CRLF", () => {
    expect(toCsv([["a", "b,c"], ["d", null]])).toBe('a,"b,c"\r\nd,');
  });

  it("names files by table, tab and day", () => {
    expect(csvFilename("hackers", "accepted", new Date("2026-10-22T12:00:00Z"))).toBe("dh-hackers-accepted-2026-10-22.csv");
  });
});

describe("templates", () => {
  it("fills placeholders, tolerating spaces", () => {
    expect(fillTemplate("Hi {{first_name}}, code {{ code }}", { first_name: "Jane", code: "DH26-H001" })).toBe("Hi Jane, code DH26-H001");
  });

  it("empties unknown or missing placeholders", () => {
    expect(fillTemplate("{{first_name}}|{{nope}}|{{code}}", { first_name: "Jane" })).toBe("Jane||");
  });

  it("puts the check-in code in acceptance emails", () => {
    expect(DEFAULT_TEMPLATES["accepted:hacker"].body).toContain("{{code}}");
    expect(DEFAULT_TEMPLATES["accepted:staff"].body).toContain("{{code}}");
  });
});

describe("console tabs", () => {
  it("moves a row to its tab as soon as a decision is picked", async () => {
    const { placeOf } = await import("./types");
    const row = (status: string, decision: string | null) => ({ status, decision }) as never;
    expect(placeOf(row("submitted", null))).toBe("applied");
    expect(placeOf(row("submitted", "waitlisted"))).toBe("waitlisted");
    expect(placeOf(row("accepted", "rejected"))).toBe("rejected");
    expect(placeOf(row("accepted", null))).toBe("accepted");
  });
});

describe("ready-made emails", () => {
  it("won't send while [[blanks]] are left", async () => {
    const { BLASTS, hasBlanks } = await import("./blasts");
    expect(hasBlanks("Hi [[Sponsor 1]]")).toBe(true);
    expect(hasBlanks("Hi {{first_name}}")).toBe(false);
    expect(BLASTS.find(b => b.id === "sponsors") && hasBlanks(BLASTS.find(b => b.id === "sponsors")!.body)).toBe(true);
  });

  it("the QR email asks for the QR code and goes to accepted people", async () => {
    const { BLASTS } = await import("./blasts");
    const qr = BLASTS.find(b => b.id === "qr")!;
    expect(qr.body).toContain("{{qr}}");
    expect(qr.status).toBe("accepted");
  });
});
