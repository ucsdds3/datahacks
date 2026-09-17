import { describe, expect, it } from "vitest";
import { BEDROCK, depthAt, depthOf, formatDepth } from "./depth";
import { CHAPTERS } from "./chapters";

describe("depthOf", () => {
  it("reads a height above sea level", () => {
    expect(depthOf("+80")).toBe(80);
    expect(depthOf("+08")).toBe(8);
  });

  it("reads the typographic minus the chapter data uses", () => {
    expect(depthOf("−28")).toBe(-28);
    expect(depthOf("−08")).toBe(-8);
  });

  it("places the End at bedrock, since it has no depth of its own", () => {
    expect(depthOf("—")).toBe(BEDROCK);
  });

  it("reads every chapter in the story", () => {
    const depths = CHAPTERS.map(chapter => depthOf(chapter.y));
    expect(depths.every(Number.isFinite)).toBe(true);
    expect(depths[0]).toBe(80);
    expect(depths.at(-1)).toBe(BEDROCK);
  });
});

describe("depthAt", () => {
  const depths = [80, 48, 24];

  it("starts at the surface and ends at the last chapter", () => {
    expect(depthAt(0, depths)).toBe(80);
    expect(depthAt(1, depths)).toBe(24);
  });

  it("interpolates between chapters rather than jumping at each one", () => {
    expect(depthAt(0.25, depths)).toBe(64);
    expect(depthAt(0.5, depths)).toBe(48);
    expect(depthAt(0.75, depths)).toBe(36);
  });

  it("falls the whole way without ever rising", () => {
    const readings = Array.from({ length: 40 }, (_, i) => depthAt(i / 39, CHAPTERS.map(c => depthOf(c.y))));
    readings.forEach((reading, i) => i && expect(reading).toBeLessThanOrEqual(readings[i - 1]));
  });

  it("clamps rather than running past either end", () => {
    expect(depthAt(-3, depths)).toBe(80);
    expect(depthAt(9, depths)).toBe(24);
  });

  it("survives an empty or single-chapter story", () => {
    expect(depthAt(0.5, [])).toBe(BEDROCK);
    expect(depthAt(0.5, [12])).toBe(12);
  });
});

describe("formatDepth", () => {
  it("signs the reading the way the game's own readout does", () => {
    expect(formatDepth(80)).toBe("+80");
    expect(formatDepth(-27.6)).toBe("−28");
    expect(formatDepth(0)).toBe("+0");
  });
});
