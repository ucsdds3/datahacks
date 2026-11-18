import { describe, expect, it } from "vitest";
import { dietaryRestrictions, logisticsFromDh26, oneLine, overnightStay, phone, shirtSize, teamMatching } from "./dh26-logistics-normalize.mjs";

describe("DH26 logistics normalizers", () => {
  it("shirt sizes", () => {
    expect(shirtSize("M")).toEqual({ value: "M", unmapped: false });
    expect(shirtSize(" xxl ").value).toBe("XXL");
    expect(shirtSize("3XL (or 2XL)").value).toBe("3XL");
    expect(shirtSize("XXS").value).toBe("XXS");
    expect(shirtSize("")).toEqual({ value: null, unmapped: false });
    expect(shirtSize("Medium")).toEqual({ value: null, unmapped: true });
  });

  it("overnight stay", () => {
    expect(overnightStay("Yes").value).toBe("yes");
    expect(overnightStay("No").value).toBe("no");
    expect(overnightStay("Maybe").value).toBe("maybe");
    expect(overnightStay("")).toEqual({ value: null, unmapped: false });
    expect(overnightStay("Only Saturday")).toEqual({ value: null, unmapped: true });
  });

  it("team matching", () => {
    expect(teamMatching("Yes, I am looking for a team.").value).toBe("looking_for_team");
    expect(teamMatching("Yes, I have a team that is still looking for members.").value).toBe("team_needs_members");
    expect(teamMatching("No, I already have a team and we're set.").value).toBe("have_full_team");
    expect(teamMatching("No, I already have a team and we’re set.").value).toBe("have_full_team");
    expect(teamMatching("")).toEqual({ value: null, unmapped: false });
    expect(teamMatching("Not sure")).toEqual({ value: null, unmapped: true });
  });

  it("dietary restrictions: none-ish answers are null, others kept on one line", () => {
    for (const none of ["", "No", "none", "None.", "N/A", "na", "Nope", "No allergies", "no allergies!"]) {
      expect(dietaryRestrictions(none)).toEqual({ value: null, unmapped: false });
    }
    expect(dietaryRestrictions("  Peanuts,\nshellfish ").value).toBe("Peanuts, shellfish");
    expect(dietaryRestrictions("Vegetarian").value).toBe("Vegetarian");
  });

  it("phones", () => {
    expect(phone("8585342230.0").value).toBe("(858) 534-2230");
    expect(phone("858-534-2230").value).toBe("(858) 534-2230");
    expect(phone("+1 (858) 534-2230").value).toBe("(858) 534-2230");
    expect(phone("1 (858) 534-2230").value).toBe("(858) 534-2230");
    expect(phone("(858) 534-2230‬").value).toBe("(858) 534-2230");
    expect(phone("+91 98765 43210").value).toBe("+919876543210");
    expect(phone("919876543210").value).toBe("+919876543210");
    expect(phone("")).toEqual({ value: null, unmapped: false });
    expect(phone("Mom")).toEqual({ value: null, unmapped: true });
    expect(phone("12345")).toEqual({ value: null, unmapped: true });
  });

  it("oneLine strips control characters and caps length", () => {
    expect(oneLine("Pat\tExample\r\n")).toBe("Pat Example");
    expect(oneLine("x".repeat(300))).toHaveLength(200);
  });

  it("a whole row", () => {
    const row = { ec_name: "Pat Example", ec_phone: "8585342230.0", ec_rel: "Parent", allergies: "None", shirt: "M", overnight: "Maybe", team: "Yes, I am looking for a team." };
    expect(logisticsFromDh26(row)).toEqual({
      values: {
        emergency_contact_name: "Pat Example", emergency_contact_phone: "(858) 534-2230", emergency_contact_relation: "Parent",
        shirt_size: "M", overnight_stay: "maybe", team_matching: "looking_for_team",
      },
      unmapped: [],
    });
  });

  it("no contact name means no emergency contact; bad answers are reported, not stored", () => {
    expect(logisticsFromDh26({ ec_name: "", ec_phone: "8585342230", ec_rel: "Parent", shirt: "Large-ish" })).toEqual({
      values: {}, unmapped: ["shirt_size"],
    });
    expect(logisticsFromDh26({ ec_name: "Pat", ec_phone: "Mom", ec_rel: "Parent" })).toEqual({
      values: { emergency_contact_name: "Pat", emergency_contact_relation: "Parent" }, unmapped: ["emergency_contact_phone"],
    });
  });
});
