export type Chapter = {
  id: string;
  /** URL that opens this chapter. */
  path: string;
  /** Depth-meter name, e.g. "Stone, coal & copper". */
  name: string;
  /** Depth-meter reading, e.g. "+48". */
  y: string;
  /** Depth-meter swatch. */
  color: string;
  /** Scene backdrop under /public, or null for chapters that draw their own. */
  art: string | null;
  /** Accessible name for the chapter region. */
  title: string;
};

const relief = "/images/minecraft/relief";
const dimensions = "/images/minecraft/dimensions";

/**
 * The story spine, surface to the End: one layer of the world per section, with
 * the footer as bedrock underneath. Mentors & judges, the run of show and the
 * application are their own pages (DOOR_PATHS), not stops on the way down.
 *
 * Backdrops are reused from the earlier descent until the design team draws the
 * new layers. TODO(design): Lush caves and the End city use basic generated
 * placeholders (scripts/generate-basic-layer-art.py) until they get real art.
 */
export const CHAPTERS: Chapter[] = [
  { id: "hero", path: "/datacraft", name: "The Overworld", y: "+80", color: "#7fb35a", art: null,
    title: "DataHacks 2.0 — the surface" },
  { id: "about", path: "/datacraft/about", name: "Sulfur caves", y: "+48", color: "#e7d88b", art: `${relief}/03-sponsors.webp`,
    title: "About DataHacks" },
  // Placeholder art: moss, clay and glow berries from scripts/generate-basic-layer-art.py.
  { id: "tracks", path: "/datacraft/tracks", name: "Lush caves", y: "+24", color: "#7fbf6a", art: `${relief}/08-lush-caves.webp`,
    title: "Tracks" },
  { id: "challenges", path: "/datacraft/challenges", name: "The mineshaft", y: "+08", color: "#cfa873", art: `${relief}/04-speakers.webp`,
    title: "Challenges" },
  { id: "prizes", path: "/datacraft/prizes", name: "The deep dark", y: "−20", color: "#5fa39b", art: `${relief}/06-faq.webp`,
    title: "Prizes" },
  { id: "sponsors", path: "/datacraft/sponsors", name: "The stronghold", y: "−36", color: "#c8b48a", art: `${relief}/07-stronghold.webp`,
    title: "Sponsors" },
  // Placeholder art: end stone and purpur from scripts/generate-basic-layer-art.py; needs an End ship.
  { id: "speakers", path: "/datacraft/speakers", name: "The End city", y: "−52", color: "#c9a6d8", art: `${relief}/09-end-city.webp`,
    title: "Speakers" },
  // The End island; it has no Y of its own, so the meter reads bedrock. The bedrock footer follows.
  { id: "faq", path: "/datacraft/faq", name: "The End", y: "—", color: "#d9d0a0", art: `${dimensions}/end-application.webp`,
    title: "Frequently asked questions" },
];

/** Pages that open on their own rather than as a chapter of the descent. */
export const DOOR_PATHS = ["/datacraft/schedule", "/datacraft/mentors", "/datacraft/apply"];

/** Hashes the old scrolling page used, so existing links keep working. */
export const LEGACY_HASHES: Record<string, string> = {
  "#top": "/datacraft",
  "#about": "/datacraft/about",
  "#emerald-layer": "/datacraft/about",
  "#tracks": "/datacraft/tracks",
  "#iron-layer": "/datacraft/tracks",
  "#challenges": "/datacraft/challenges",
  "#gold-layer": "/datacraft/sponsors",
  "#mineshaft-layer": "/datacraft/speakers",
  "#diamond-layer": "/datacraft/prizes",
  "#trial-layer": "/datacraft/mentors",
  "#faq": "/datacraft/faq",
  "#sculk-layer": "/datacraft/faq",
  "#lava-layer": "/datacraft/apply",
  "#apply": "/datacraft/apply",
};

export const chapterAt = (index: number): Chapter | undefined =>
  index < 0 ? undefined : CHAPTERS[index];

/** -1 when the pathname is not a chapter: the door pages (DOOR_PATHS) and anything unknown. */
export const chapterIndexOf = (pathname: string): number => {
  const path = pathname.replace(/\/+$/, "") || "/datacraft";
  return CHAPTERS.findIndex(c => c.path === path);
};
