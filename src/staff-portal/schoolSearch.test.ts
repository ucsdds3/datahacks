import { describe, expect, it } from "vitest";
import SCHOOLS from "./schools.json";
import { indexSchools, searchSchools } from "./schoolSearch";

const index = indexSchools(SCHOOLS);
const top = (query: string) => searchSchools(index, query)[0];

describe("school search", () => {
  it("knows nicknames", () => {
    expect(top("UCSD")).toBe("University of California, San Diego");
    expect(top("ucla")).toBe("University of California, Los Angeles");
    expect(top("SDSU")).toBe("San Diego State University");
    expect(top("UBC")).toBe("University of British Columbia");
  });

  it("reads UC as University of California, in any word order", () => {
    expect(top("uc san diego")).toBe("University of California, San Diego");
    expect(top("san diego uc")).toBe("University of California, San Diego");
    expect(top("university of california san diego")).toBe("University of California, San Diego");
  });

  it("forgives a typo", () => {
    expect(top("standford")).toBe("Stanford University");
    expect(searchSchools(index, "univeristy of san diego")).toContain("University of San Diego");
  });

  it("still finds plain partial names", () => {
    expect(searchSchools(index, "miramar")).toContain("San Diego Miramar College");
    expect(searchSchools(index, "toronto")).toContain("University of Toronto");
  });

  it("returns nothing for an empty query", () => {
    expect(searchSchools(index, "  ")).toEqual([]);
  });
});
