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
