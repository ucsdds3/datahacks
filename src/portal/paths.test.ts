import { describe, expect, it } from "vitest";
import { loginWithNext, safeNext, trimSlash } from "./paths";

describe("trimSlash (GitHub Pages adds a slash to loaded links)", () => {
  it("drops trailing slashes but keeps the root", () => {
    expect(trimSlash("/portal/apply/mentor-judge/")).toBe("/portal/apply/mentor-judge");
    expect(trimSlash("/portal/apply/mentor-judge")).toBe("/portal/apply/mentor-judge");
    expect(trimSlash("/portal//")).toBe("/portal");
    expect(trimSlash("/")).toBe("/");
  });
});

describe("safeNext: where to return after sign-in", () => {
  it("allows portal pages only", () => {
    expect(safeNext("/portal/mentor/handbook")).toBe("/portal/mentor/handbook");
    expect(safeNext("/portal/hacker?status=x")).toBe("/portal/hacker?status=x");
    expect(safeNext("/portal/hacker/resources?x=1")).toBe("/portal/hacker/resources?x=1");
  });
  it("refuses other sites and odd paths", () => {
    for (const bad of [null, "", "https://evil.com", "//evil.com/portal/", "/portal\\..\\x", "/login/hacker", "/portal/x\nSet-Cookie", "javascript:alert(1)"]) {
      expect(safeNext(bad), String(bad)).toBeNull();
    }
  });
  it("builds a sign-in link that carries it", () => {
    expect(loginWithNext("mentor", "/portal/mentor/waiver")).toBe("/login/mentor?next=%2Fportal%2Fmentor%2Fwaiver");
    expect(loginWithNext("hacker", "https://evil.com")).toBe("/login/hacker");
    expect(loginWithNext("judge")).toBe("/login/judge");
  });
});
