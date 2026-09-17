import { describe, expect, it } from "vitest";
import { CHAPTERS, LEGACY_HASHES, chapterAt, chapterIndexOf } from "./chapters";

describe("chapter registry", () => {
  it("runs from the surface down to the End", () => {
    expect(CHAPTERS.map(c => c.id)).toEqual([
      "hero", "about", "tracks", "sponsors", "speakers",
      "prizes", "trials", "faq", "stronghold", "end",
    ]);
  });

  it("gives the hero the bare theme root so /minecraft opens the story", () => {
    expect(CHAPTERS[0].path).toBe("/minecraft");
    expect(CHAPTERS.at(-1)?.path).toBe("/minecraft/apply");
  });

  it("has a unique path for every chapter", () => {
    expect(new Set(CHAPTERS.map(c => c.path)).size).toBe(CHAPTERS.length);
  });

  it("keeps the doors off the spine", () => {
    expect(CHAPTERS.map(c => c.path)).not.toContain("/minecraft/schedule");
    expect(CHAPTERS.map(c => c.path)).not.toContain("/minecraft/mentors");
  });

  it("gives every chapter an exit affordance unless its content carries one", () => {
    // The stronghold's End portal and the hero's own call to action are the way on.
    const carriesItsOwn = ["hero", "stronghold", "end"];
    CHAPTERS.filter(c => !carriesItsOwn.includes(c.id)).forEach(c => expect(c.exit, c.id).not.toBeNull());
    expect(CHAPTERS.find(c => c.id === "stronghold")?.exit).toBeNull();
    expect(CHAPTERS.at(-1)?.exit).toBeNull();
  });

  it("resolves a pathname to its chapter", () => {
    expect(chapterIndexOf("/minecraft/faq")).toBe(7);
    expect(chapterIndexOf("/minecraft")).toBe(0);
    expect(chapterIndexOf("/minecraft/")).toBe(0);
    expect(chapterIndexOf("/minecraft/schedule")).toBe(-1);
  });

  it("looks a chapter up by index", () => {
    expect(chapterAt(7)?.id).toBe("faq");
    expect(chapterAt(99)).toBeUndefined();
    expect(chapterAt(-1)).toBeUndefined();
  });

  it("maps the old in-page hashes onto chapter paths", () => {
    expect(LEGACY_HASHES["#about"]).toBe("/minecraft/about");
    expect(LEGACY_HASHES["#faq"]).toBe("/minecraft/faq");
    expect(LEGACY_HASHES["#top"]).toBe("/minecraft");
  });

  it("points every legacy hash at a real chapter", () => {
    const paths = new Set(CHAPTERS.map(c => c.path));
    Object.entries(LEGACY_HASHES).forEach(([hash, path]) => expect(paths, hash).toContain(path));
  });
});
