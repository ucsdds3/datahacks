import { describe, expect, it } from "vitest";
import { powerFormLink, powerFormOpen } from "./powerForm";
import { DOCUSIGN } from "./config";

const BASE = "https://www.docusign.net/Member/PowerFormSigning.aspx?PowerFormId=bed6ac13-bb24-44ef-84b1-1ede0ce183c1&env=na1&acct=6371e373-11ff-4359-aa24-bf2ccbddc944&v=2";
const config = { powerFormUrl: BASE, roleName: "Participant", idFieldLabel: "datahacks_id" };
const ID = "6f1c2a9e-3b7d-4e8a-9c0f-1a2b3c4d5e6f";

const params = (link: string) => new URL(link).searchParams;

describe("powerFormLink", () => {
  it("adds the role's name and email and the id field to DocuSign's link", () => {
    const link = powerFormLink({ name: "Jane Doe", email: "jane@ucsd.edu", id: ID }, config)!;
    expect(link.startsWith(`${BASE}&`)).toBe(true);
    const p = params(link);
    expect(p.get("PowerFormId")).toBe("bed6ac13-bb24-44ef-84b1-1ede0ce183c1");
    expect(p.get("Participant_UserName")).toBe("Jane Doe");
    expect(p.get("Participant_Email")).toBe("jane@ucsd.edu");
    expect(p.get("Participant_datahacks_id")).toBe(ID);
    expect(p.get("datahacks_id")).toBe(ID);
    // Spaces as %20, like DocuSign's examples, not "+".
    expect(link).toContain("Participant_UserName=Jane%20Doe");
  });

  it("encodes accents, apostrophes and other punctuation so they come back exactly", () => {
    const names = ["José Núñez-O'Brien", "Zoë D'Angelo (Zo)", "Siobhán Ó Briain", "Nguyễn Thị Minh Khai", "Renée & Co!", "李小龙", "Ana*Lucía"];
    for (const name of names) {
      const link = powerFormLink({ name, email: "a.b+dh27@example.com", id: ID }, config)!;
      // Only unreserved characters left in the query we add.
      const added = link.slice(BASE.length + 1);
      expect(added).toMatch(/^[A-Za-z0-9_.~%=&-]+$/);
      expect(params(link).get("Participant_UserName")).toBe(name.normalize("NFC"));
      expect(params(link).get("Participant_Email")).toBe("a.b+dh27@example.com");
    }
    expect(powerFormLink({ name: "O'Brien", email: "", id: "" }, config)).toContain("Participant_UserName=O%27Brien");
    expect(powerFormLink({ name: "a+b", email: "x+y@z.com", id: "" }, config)).toContain("Participant_Email=x%2By%40z.com");
  });

  it("normalizes decomposed accents and extra spaces in the name", () => {
    const link = powerFormLink({ name: "  Jose\u0301   Nu\u0301n\u0303ez ", email: "", id: "" }, config)!;
    expect(params(link).get("Participant_UserName")).toBe("Jos\u00e9 N\u00fa\u00f1ez");
    expect(link).toContain("Participant_UserName=Jos%C3%A9%20N%C3%BA%C3%B1ez");
  });

  it("encodes a role name with a space", () => {
    const link = powerFormLink({ name: "Howard Getz", email: "", id: "" }, { ...config, roleName: "Tax Filer" })!;
    expect(link).toContain("Tax%20Filer_UserName=Howard%20Getz");
  });

  it("leaves out what it doesn't have", () => {
    const p = params(powerFormLink({ name: "", email: "x@y.z", id: "" }, config)!);
    expect(p.has("Participant_UserName")).toBe(false);
    expect(p.has("datahacks_id")).toBe(false);
    expect(powerFormLink({ name: "", email: "", id: "" }, config)).toBe(BASE);
  });

  it("works with a link that has no query, or ends in ? or &", () => {
    expect(powerFormLink({ name: "A", email: "", id: "" }, { ...config, powerFormUrl: "https://powerforms.docusign.net/abc" })).toBe("https://powerforms.docusign.net/abc?Participant_UserName=A");
    expect(powerFormLink({ name: "A", email: "", id: "" }, { ...config, powerFormUrl: "https://x.test/p?" })).toBe("https://x.test/p?Participant_UserName=A");
    expect(powerFormLink({ name: "A", email: "", id: "" }, { ...config, powerFormUrl: "https://x.test/p?a=1&" })).toBe("https://x.test/p?a=1&Participant_UserName=A");
  });

  it("is null without a PowerForm link", () => {
    expect(powerFormLink({ name: "A", email: "a@b.c", id: ID }, { ...config, powerFormUrl: "  " })).toBeNull();
  });
});

describe("powerFormOpen", () => {
  it("needs PowerForm mode, a link and the waiver published", () => {
    expect(powerFormOpen({ mode: "powerform", powerFormUrl: BASE, waiverPublished: true })).toBe(true);
    expect(powerFormOpen({ mode: "powerform", powerFormUrl: BASE, waiverPublished: false })).toBe(false);
    expect(powerFormOpen({ mode: "powerform", powerFormUrl: "", waiverPublished: true })).toBe(false);
    expect(powerFormOpen({ mode: "embedded", powerFormUrl: BASE, waiverPublished: true })).toBe(false);
  });

  it("ships in PowerForm mode with the UC San Diego link, open for signing", () => {
    expect(DOCUSIGN.mode).toBe("powerform");
    expect(DOCUSIGN.powerFormUrl).toBe(BASE);
    expect(DOCUSIGN.roleName).toBe("Participant");
    expect(DOCUSIGN.idFieldLabel).toBe("datahacks_id");
    expect(DOCUSIGN.waiverPublished).toBe(true);
  });
});
