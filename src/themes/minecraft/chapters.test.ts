import { describe, expect, it } from "vitest";
import { CHAPTERS, DOOR_PATHS, LEGACY_HASHES, chapterAt, chapterIndexOf } from "./chapters";

describe("chapter registry", () => {
  it("runs from the surface down to the End, one layer per section", () => {
    expect(CHAPTERS.map(c => c.id)).toEqual([
      "hero", "about", "tracks", "challenges", "prizes", "sponsors", "speakers", "faq",
    ]);
    expect(CHAPTERS.map(c => c.name)).toEqual([
      "The Overworld", "Sulfur caves", "Lush caves", "The mineshaft", "The deep dark", "The stronghold", "The End city", "The End",
    ]);
  });

  it("gives the hero the bare theme root so /minecraft opens the story", () => {
    expect(CHAPTERS[0].path).toBe("/datacraft");
    expect(CHAPTERS.at(-1)?.path).toBe("/datacraft/faq");
  });

  it("has a unique path for every chapter", () => {
    expect(new Set(CHAPTERS.map(c => c.path)).size).toBe(CHAPTERS.length);
  });

  it("keeps the door pages off the spine", () => {
    DOOR_PATHS.forEach(path => expect(CHAPTERS.map(c => c.path)).not.toContain(path));
    expect(DOOR_PATHS).toEqual(["/datacraft/schedule", "/datacraft/mentors", "/datacraft/apply"]);
  });

  it("resolves a pathname to its chapter", () => {
    expect(chapterIndexOf("/datacraft/faq")).toBe(7);
    expect(chapterIndexOf("/datacraft/challenges")).toBe(3);
    expect(chapterIndexOf("/datacraft/apply")).toBe(-1);
    expect(chapterIndexOf("/datacraft")).toBe(0);
    expect(chapterIndexOf("/datacraft/")).toBe(0);
    expect(chapterIndexOf("/datacraft/schedule")).toBe(-1);
  });

  it("looks a chapter up by index", () => {
    expect(chapterAt(7)?.id).toBe("faq");
    expect(chapterAt(99)).toBeUndefined();
    expect(chapterAt(-1)).toBeUndefined();
  });

  it("maps the old in-page hashes onto chapter paths", () => {
    expect(LEGACY_HASHES["#about"]).toBe("/datacraft/about");
    expect(LEGACY_HASHES["#faq"]).toBe("/datacraft/faq");
    expect(LEGACY_HASHES["#top"]).toBe("/datacraft");
  });

  it("points every legacy hash at a real chapter or door page", () => {
    const paths = new Set([...CHAPTERS.map(c => c.path), ...DOOR_PATHS]);
    Object.entries(LEGACY_HASHES).forEach(([hash, path]) => expect(paths, hash).toContain(path));
    expect(LEGACY_HASHES["#trial-layer"]).toBe("/datacraft/mentors");
    expect(LEGACY_HASHES["#apply"]).toBe("/datacraft/apply");
  });
});
