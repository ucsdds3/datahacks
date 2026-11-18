import { describe, expect, it, vi } from "vitest";
import { applyPatches, counter, parseCsv, patchPath, planPatches, wantedFromRows } from "./dh26-logistics-plan.mjs";

const ID = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const dh26 = {
  ec_name: "Pat Example", ec_phone: "8585550100.0", ec_rel: "Parent", allergies: "Peanuts",
  shirt: "M", overnight: "Maybe", team: "Yes, I am looking for a team.",
};
const empty = {
  applicant_type: "hacker", logistics_source: null,
  emergency_contact_name: null, emergency_contact_phone: null, emergency_contact_relation: null,
  dietary_restrictions: null, shirt_size: null, overnight_stay: null, team_matching: null,
};
const plan = (rows, current) => {
  const { count, bump } = counter();
  const patches = planPatches(wantedFromRows(rows, {}, bump), new Map(Object.entries(current)), bump);
  return { patches, count };
};

describe("planPatches", () => {
  it("fills an untouched application and marks it as imported", () => {
    const { patches, count } = plan([{ app_id: ID(1), match: "email", ...dh26 }], { [ID(1)]: empty });
    expect(patches).toEqual([[ID(1), {
      emergency_contact_name: "Pat Example", emergency_contact_phone: "(858) 555-0100", emergency_contact_relation: "Parent",
      dietary_restrictions: "Peanuts", shirt_size: "M", overnight_stay: "maybe", team_matching: "looking_for_team",
      logistics_source: "dh26_import",
    }]]);
    expect(count["applications to fill"]).toBe(1);
  });

  it("skips a row the applicant answered for DH27, even where they left a column null (no dietary restrictions)", () => {
    const answered = {
      ...empty, logistics_source: "applicant", emergency_contact_name: "Sam", emergency_contact_phone: "(858) 555-0101",
      emergency_contact_relation: "Friend", shirt_size: "L", overnight_stay: "no", team_matching: "have_full_team",
    };
    const { patches, count } = plan([{ app_id: ID(2), match: "email", ...dh26 }], { [ID(2)]: answered });
    expect(patches).toEqual([]);
    expect(count["skipped: answered for DH27"]).toBe(1);
    expect(count["applications to fill"]).toBe(0);
  });

  it("skips a row an earlier run imported, so a re-run changes nothing", () => {
    const { patches, count } = plan([{ app_id: ID(3), match: "email", ...dh26 }], { [ID(3)]: { ...empty, logistics_source: "dh26_import" } });
    expect(patches).toEqual([]);
    expect(count["skipped: already imported"]).toBe(1);
  });

  it("never overwrites a column that has a value, and skips name matches by default", () => {
    const { patches } = plan(
      [{ app_id: ID(4), match: "email", ...dh26 }, { app_id: ID(5), match: "name", ...dh26 }],
      { [ID(4)]: { ...empty, shirt_size: "S" }, [ID(5)]: empty },
    );
    expect(patches.map(([id]) => id)).toEqual([ID(4)]);
    expect(patches[0][1]).not.toHaveProperty("shirt_size");
  });

  it("always shows the summary counters, at zero too", () => {
    const { count } = plan([], {});
    expect(count).toEqual({ "rows in the CSV": 0, "skipped: answered for DH27": 0, "skipped: already imported": 0, "applications to fill": 0 });
  });
});

describe("applyPatches", () => {
  const patch = { shirt_size: "M", dietary_restrictions: "Peanuts", logistics_source: "dh26_import" };

  it("only writes where the row still has no source and every column being set is still null, and asks for the row back", async () => {
    const call = vi.fn().mockResolvedValue([{ id: ID(1) }]);
    await applyPatches([[ID(1), patch]], call);
    expect(call).toHaveBeenCalledWith(
      `/rest/v1/applications?id=eq.${ID(1)}&shirt_size=is.null&dietary_restrictions=is.null&logistics_source=is.null&select=id`,
      { method: "PATCH", body: patch, prefer: "return=representation" },
    );
    expect(patchPath(ID(1), patch)).toContain("logistics_source=is.null");
  });

  it("counts exactly one updated row as filled; zero rows or an error is a failure, and the rest still run", async () => {
    const call = vi.fn()
      .mockResolvedValueOnce([])                       // 0 rows matched (deleted, or changed since it was read)
      .mockRejectedValueOnce(new Error("HTTP 500"))    // the request failed
      .mockResolvedValueOnce(null)                     // an empty 204, as return=minimal would give
      .mockResolvedValueOnce([{ id: ID(4) }]);         // updated
    const { count, bump } = counter(["applications filled", "failed: not updated"]);
    const failed = await applyPatches([[ID(1), patch], [ID(2), patch], [ID(3), patch], [ID(4), patch]], call, bump);
    expect(failed).toEqual([ID(1), ID(2), ID(3)]);
    expect(count).toEqual({ "applications filled": 1, "failed: not updated": 3 });
    expect(call).toHaveBeenCalledTimes(4);
  });
});

describe("parseCsv", () => {
  it("reads quoted fields with commas, quotes and line breaks", () => {
    expect(parseCsv('﻿app_id,allergies\r\n1,"Nuts, ""tree"" ones\nand dairy"\r\n')).toEqual([{ app_id: "1", allergies: 'Nuts, "tree" ones\nand dairy' }]);
  });
});
