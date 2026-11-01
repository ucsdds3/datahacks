import { describe, expect, it } from "vitest";
import {
  PASS_LINK_FALLBACK_DAYS, ROLE_DESIGN, SCHEDULE, buildEmail, oneLine, passLinkSeconds, passPayload, roleBadge, roleOf, whenFor, type PassRole,
} from "../../supabase/functions/send-wallet-passes/passDesign";
import { TIMELINE } from "@/staff-portal/config";

// Like the real events: DH27BETA starts on the day TIMELINE describes, DH26 doesn't.
const dh27 = { name: "DataHacks 2027", starts_at: "2027-01-16T16:00:00+00:00", ends_at: "2027-01-18T04:00:00+00:00" };
const dh26 = { name: "DataHacks 2026", starts_at: "2026-04-18T16:00:00+00:00", ends_at: "2026-04-20T04:00:00+00:00" };

const person = (roles: string[], team: string | null = null) => ({ code: "DH27-X001", name: "Ada Lovelace", roles, team });
const ROLES: Record<PassRole, string[]> = { hacker: ["hacker"], mentor: ["mentor"], judge: ["judge"], hybrid: ["mentor", "judge"] };
const pass = { applePass: "", shareUrl: "https://pass.walletwallet.dev/p/1", googleSaveUrl: "https://pay.google.com/gp/v/save/x" };

describe("roleOf", () => {
  it("reads attendees.roles", () => {
    expect(roleOf(["hacker"])).toBe("hacker");
    expect(roleOf(["mentor"])).toBe("mentor");
    expect(roleOf(["judge"])).toBe("judge");
    expect(roleOf(["mentor", "judge"])).toBe("hybrid");
    expect(roleOf(["judge", "mentor"])).toBe("hybrid");
    expect(roleOf([])).toBe("hacker");
  });
});

describe("the schedule on passes", () => {
  it("is TIMELINE.eventDates word for word", () => {
    expect(SCHEDULE.when).toEqual(TIMELINE.eventDates);
  });

  it("uses each role's own times for the event TIMELINE describes", () => {
    expect(whenFor("mentor", dh27)).toEqual({ long: "Saturday, January 16, 2027 · mentoring 12:30–4:30 PM", short: "Sat, Jan 16" });
    expect(whenFor("judge", dh27)).toEqual({ long: "Sunday, January 17, 2027", short: "Sun, Jan 17" });
  });

  it("falls back to the event's own dates for any other event, with no role times", () => {
    expect(whenFor("mentor", dh26)).toEqual({ long: "Saturday, April 18, 2026 – Sunday, April 19, 2026", short: "Apr 18 – Apr 19" });
    expect(whenFor("hacker", { name: "x", starts_at: "2026-04-18T16:00:00Z", ends_at: "2026-04-18T23:00:00Z" }))
      .toEqual({ long: "Saturday, April 18, 2026", short: "Apr 18" });
    expect(whenFor("judge", { name: "x", starts_at: null })).toBeNull();
  });
});

describe("passPayload", () => {
  it("gives each role its own colour and a big role title", () => {
    const looks = Object.fromEntries((Object.keys(ROLES) as PassRole[]).map(role => {
      const p = passPayload(dh27, person(ROLES[role]));
      return [role, [p.colorPreset, p.primaryFields[0].value]];
    }));
    expect(looks).toEqual({
      hacker: ["green", "HACKER"],
      mentor: ["blue", "MENTOR"],
      judge: ["orange", "JUDGE"],
      hybrid: ["purple", "MENTOR & JUDGE"],
    });
    expect(new Set(Object.values(ROLE_DESIGN).map(d => d.colorPreset)).size).toBe(4);
  });

  it("puts name, code and the date on the front, and the team for hackers only", () => {
    const hacker = passPayload(dh27, person(["hacker"], "Team Rocket"));
    expect(hacker).toMatchObject({
      barcodeValue: "DH27-X001",
      barcodeFormat: "QR",
      barcodeAltText: "DH27-X001",
      logoText: "DataHacks 2027",
      organizationName: "DataHacks",
      headerFields: [{ label: "DATE", value: "Jan 16–17" }],
      secondaryFields: [{ label: "NAME", value: "Ada Lovelace" }, { label: "TEAM", value: "Team Rocket" }, { label: "CODE", value: "DH27-X001" }],
    });
    expect(passPayload(dh27, person(["hacker"])).secondaryFields[1]).toEqual({ label: "TEAM", value: "—" });
    const judge = passPayload(dh27, person(["judge"], "ignored"));
    expect(judge.secondaryFields.map(f => f.label)).toEqual(["NAME", "CODE"]);
    expect(judge.backFields[0]).toEqual({ label: "WHEN", value: "Sunday, January 17, 2027" });
  });

  it("leaves the date off when the event has none", () => {
    const p = passPayload({ name: "x" }, person(["mentor"]));
    expect(p).not.toHaveProperty("headerFields");
    expect(p.backFields.map(f => f.label)).not.toContain("WHEN");
  });

  it("only uses fields the WalletWallet free plan accepts", () => {
    const pro = ["color", "logoURL", "wideLogoURL", "thumbnailURL", "stripURL", "backgroundURL", "iconURL", "footerFields", "featuredActions", "locations", "credentials"];
    for (const roles of Object.values(ROLES)) {
      const keys = Object.keys(passPayload(dh27, person(roles)));
      expect(keys.filter(k => pro.includes(k))).toEqual([]);
    }
  });
});

describe("the pass email", () => {
  it("starts with a role badge in the pass colour", () => {
    expect(roleBadge("mentor")).toContain("background:#1e40af");
    expect(roleBadge("mentor")).toContain(">MENTOR</span>");
    expect(roleBadge("hybrid")).toContain(">MENTOR &amp; JUDGE</span>");
    const { html } = buildEmail(dh27, person(["judge"]), pass);
    expect(html.indexOf(roleBadge("judge"))).toBeGreaterThan(-1);
    expect(html.indexOf(roleBadge("judge"))).toBeLessThan(html.indexOf("Hi Ada"));
  });

  it("says what the role is and when, in the subject and body", () => {
    const mentor = buildEmail(dh27, person(["mentor"]), pass);
    expect(mentor.subject).toBe("Your DataHacks 2027 mentor pass");
    expect(mentor.text).toContain("[MENTOR] Thanks for mentoring at DataHacks 2027!");
    expect(mentor.text).toContain("When: Saturday, January 16, 2027 · mentoring 12:30–4:30 PM");
    expect(mentor.html).toContain("<strong>When:</strong> Saturday, January 16, 2027 · mentoring 12:30–4:30 PM");

    const hybrid = buildEmail(dh27, person(["mentor", "judge"]), pass);
    expect(hybrid.subject).toBe("Your DataHacks 2027 mentor & judge pass");
    expect(hybrid.text).toContain("When: Saturday–Sunday, January 16–17, 2027 (mentoring Saturday, judging Sunday)");

    const hacker = buildEmail(dh26, person(["hacker"]), pass);
    expect(hacker.text).toContain("You're hacking at DataHacks 2026!");
    expect(hacker.text).not.toContain("mentoring");
  });

  it("keeps the wallet buttons and escapes names", () => {
    const { html } = buildEmail(dh27, { ...person(["hacker"]), name: "<b>Eve</b> X" }, pass);
    expect(html).toContain("Hi &lt;b&gt;Eve&lt;/b&gt;,");
    expect(html).toContain("Add to Apple Wallet");
    expect(html).toContain("Add to Google Wallet");
    const noLinks = buildEmail(dh27, person(["hacker"]), { applePass: "", shareUrl: "javascript:alert(1)" });
    expect(noLinks.html).not.toContain("Add to Apple Wallet");
  });
});

describe("the pass email's links", () => {
  const signed = "https://yrxjhrrphhbmqejresvy.supabase.co/storage/v1/object/sign/wallet-passes/e/abc.pkpass?token=t";

  it("has no QR image or inline attachment, and gives the code as text", () => {
    for (const roles of Object.values(ROLES)) {
      const { html, text } = buildEmail(dh27, person(roles), pass, signed);
      expect(html).not.toMatch(/<img/i);
      expect(html).not.toContain("cid:");
      expect(html + text).not.toMatch(/QR/);
      expect(text).toContain("Add your pass to Apple Wallet or Google Wallet and show it at the registration desk. Your check-in code is DH27-X001 if you need it.");
      expect(html).toContain("Your check-in code is <strong>DH27-X001</strong> if you need it.");
    }
  });

  it("links Add to Apple Wallet to the signed .pkpass link when there is one", () => {
    const { html, text } = buildEmail(dh27, person(["mentor"]), pass, signed);
    expect(html).toContain(`href="${signed}"`);
    expect(html).not.toContain(pass.shareUrl);
    expect(text).toContain(`Add to Apple Wallet: ${signed}`);
    expect(html.indexOf("Add to Apple Wallet")).toBeLessThan(html.indexOf("Add to Google Wallet"));
    expect(html).toContain(`href="${pass.googleSaveUrl}"`);
  });

  it("falls back to WalletWallet's page when the upload failed or the link isn't https", () => {
    for (const link of [undefined, "", "http://example.com/x.pkpass", "javascript:alert(1)"]) {
      const { html, text } = buildEmail(dh27, person(["judge"]), pass, link);
      expect(html).toContain(`href="${pass.shareUrl}"`);
      expect(text).toContain(`Add to Apple Wallet: ${pass.shareUrl}`);
    }
  });

  it("escapes the signed link", () => {
    const { html } = buildEmail(dh27, person(["hacker"]), pass, `${signed}&download="x"`);
    expect(html).toContain("&amp;download=&quot;x&quot;");
  });
});

describe("passLinkSeconds", () => {
  const day = 24 * 60 * 60;
  const now = Date.parse("2026-11-01T00:00:00Z");

  it("lasts until 30 days after the event ends", () => {
    expect(passLinkSeconds("2027-01-18T04:00:00Z", now)).toBe((Date.parse("2027-02-17T04:00:00Z") - now) / 1000);
  });

  it("falls back to 120 days with no end date, a bad one, or one long past", () => {
    expect(PASS_LINK_FALLBACK_DAYS).toBe(120);
    for (const end of [null, undefined, "", "not a date", "2026-04-20T04:00:00Z"]) {
      expect(passLinkSeconds(end, now)).toBe(120 * day);
    }
  });
});

describe("oneLine", () => {
  it("turns line breaks and other control characters into spaces", () => {
    expect(oneLine(" Ada\r\nBcc: x@y.z\t\x7f ")).toBe("Ada Bcc: x@y.z");
  });
});
