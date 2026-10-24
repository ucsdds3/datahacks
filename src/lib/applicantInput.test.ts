import { describe, expect, it } from "vitest";
import {
  applicationErrorMessage, birthdateBounds, cleanLine, cleanText, isHttpsLink, isValidEmail, safeHref, safeMailto,
} from "./applicantInput";

describe("isHttpsLink (mirrors the database's link rule)", () => {
  it("accepts ordinary https profile and file links", () => {
    expect(isHttpsLink("https://www.linkedin.com/in/jane-doe/")).toBe(true);
    expect(isHttpsLink("https://github.com/jane")).toBe(true);
    expect(isHttpsLink("https://drive.google.com/file/d/1AbC_-x/view?usp=sharing")).toBe(true);
    expect(isHttpsLink("https://a.com:8443/r.pdf#page=2")).toBe(true);
    expect(isHttpsLink("HTTPS://LinkedIn.com/in/x")).toBe(true);
  });

  it("rejects other schemes, including http", () => {
    expect(isHttpsLink("http://linkedin.com/in/x")).toBe(false);
    expect(isHttpsLink("javascript:alert(1)")).toBe(false);
    expect(isHttpsLink("JaVaScRiPt:alert(1)//https://x.com")).toBe(false);
    expect(isHttpsLink("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isHttpsLink("linkedin.com/in/x")).toBe(false);
  });

  it("rejects a user@ part, whitespace, quotes, brackets and control characters", () => {
    expect(isHttpsLink("https://linkedin.com@evil.com/")).toBe(false);
    expect(isHttpsLink("https://a.com/x y")).toBe(false);
    expect(isHttpsLink(" https://a.com")).toBe(false);
    expect(isHttpsLink('https://a.com/"onmouseover=alert(1)')).toBe(false);
    expect(isHttpsLink("https://a.com/<b>")).toBe(false);
    expect(isHttpsLink("https://a.com/x\\y")).toBe(false);
    expect(isHttpsLink("https://a.com/x\u0007")).toBe(false);
    expect(isHttpsLink("https://")).toBe(false);
  });

  it("caps links at 500 characters", () => {
    expect(isHttpsLink(`https://a.com/${"x".repeat(486)}`)).toBe(true);
    expect(isHttpsLink(`https://a.com/${"x".repeat(487)}`)).toBe(false);
  });
});

describe("isValidEmail (mirrors the database's email rule)", () => {
  it("accepts plain addresses", () => {
    expect(isValidEmail("a.b+c@ucsd.edu")).toBe(true);
    expect(isValidEmail("o'brien@example.com")).toBe(true);
  });

  it("rejects anything that could add recipients, headers or mailto parameters", () => {
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a@b.com, c@d.com")).toBe(false);
    expect(isValidEmail("a@b.com\r\nBcc: c@d.com")).toBe(false);
    expect(isValidEmail("<a@b.com>")).toBe(false);
    expect(isValidEmail('"x"@b.com')).toBe(false);
    expect(isValidEmail("a?cc=x@b.com")).toBe(false);
    expect(isValidEmail(`${"a".repeat(250)}@b.com`)).toBe(false);
  });
});

describe("safeHref (links shown in the organizer console)", () => {
  it("keeps http and https links", () => {
    expect(safeHref("https://github.com/jane")).toBe("https://github.com/jane");
    expect(safeHref("http://example.com/x")).toBe("http://example.com/x");
    expect(safeHref("  https://example.com  ")).toBe("https://example.com/");
  });

  it("refuses script and data links, however they're written", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref(" JavaScript:alert(document.cookie)")).toBeNull();
    expect(safeHref("java\tscript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeHref("vbscript:msgbox(1)")).toBeNull();
    expect(safeHref("/relative/path")).toBeNull();
    expect(safeHref("not a link")).toBeNull();
    expect(safeHref(null)).toBeNull();
    expect(safeHref("")).toBeNull();
  });
});

describe("safeMailto", () => {
  it("links a plain address", () => {
    expect(safeMailto("jane@ucsd.edu")).toBe("mailto:jane@ucsd.edu");
  });

  it("doesn't link an address that would prefill other fields", () => {
    expect(safeMailto("jane@ucsd.edu?bcc=x@y.com")).toBeNull();
    expect(safeMailto(null)).toBeNull();
  });
});

describe("cleanLine and cleanText", () => {
  it("turns pasted tabs and line breaks in one-line answers into spaces", () => {
    expect(cleanLine("  Ann\r\nBcc: x@y.com\t ")).toBe("Ann  Bcc: x@y.com");
    expect(cleanLine("José María")).toBe("José María");
  });

  it("keeps line breaks in long answers but drops other control characters", () => {
    expect(cleanText(" Line one\nLine two\r\n\tindented\u0007\u001b ")).toBe("Line one\nLine two\r\n\tindented");
  });
});

describe("birthdateBounds", () => {
  it("is 1900-01-01 to 18 years before today", () => {
    expect(birthdateBounds(new Date(2026, 9, 23))).toEqual({ min: "1900-01-01", max: "2008-10-23" });
  });

  it("counts Feb 29 back to Feb 28, as Postgres does", () => {
    expect(birthdateBounds(new Date(2028, 1, 29)).max).toBe("2010-02-28");
  });
});

describe("applicationErrorMessage", () => {
  it("explains a duplicate application", () => {
    expect(applicationErrorMessage({ code: "23505", message: "duplicate key" })).toMatch(/already applied/);
  });

  it("names the field a database check rejected", () => {
    const message = applicationErrorMessage({
      code: "23514",
      message: 'new row for relation "applications" violates check constraint "application_linkedin_url_check"',
    });
    expect(message).toMatch(/LinkedIn link/);
  });

  it("falls back to a general message for other checks", () => {
    const message = applicationErrorMessage({
      code: "23514",
      message: 'new row for relation "applications" violates check constraint "applications_staff_fields_check"',
    });
    expect(message).toMatch(/format we can't accept/);
  });

  it("passes other errors through", () => {
    expect(applicationErrorMessage({ code: "42501", message: "permission denied" })).toBe("permission denied");
  });
});
