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

/** The story spine, surface to bedrock. The Nether and Trial Chambers are doors off
 * it (chapters "tracks" and "trials"), not entries here. */
export const CHAPTERS: Chapter[] = [
  { id: "hero", path: "/minecraft", name: "Cherry grove", y: "+80", color: "#f0b9d0", art: null,
    title: "DataHacks 2.0 — the surface" },
  { id: "about", path: "/minecraft/about", name: "Stone, coal & copper", y: "+48", color: "#d5aa87", art: `${relief}/01-about.webp`,
    title: "About DataHacks" },
  { id: "tracks", path: "/minecraft/tracks", name: "Iron & redstone", y: "+24", color: "#cfae9c", art: `${relief}/02-tracks.webp`,
    title: "Tracks" },
  { id: "sponsors", path: "/minecraft/sponsors", name: "Sulfur cavern", y: "+08", color: "#e7d88b", art: `${relief}/03-sponsors.webp`,
    title: "Sponsors" },
  { id: "speakers", path: "/minecraft/speakers", name: "The mineshaft", y: "−08", color: "#cfa873", art: `${relief}/04-speakers.webp`,
    title: "Speakers" },
  { id: "prizes", path: "/minecraft/prizes", name: "Deepslate ores", y: "−28", color: "#98d4d8", art: `${relief}/05-prizes.webp`,
    title: "Prizes" },
  { id: "trials", path: "/minecraft/trials", name: "Trial chambers", y: "−36", color: "#b57853", art: `${dimensions}/trial-chamber-entrance.webp`,
    title: "The trial chambers" },
  { id: "faq", path: "/minecraft/faq", name: "Ancient city", y: "−44", color: "#8acbc4", art: `${relief}/06-faq.webp`,
    title: "Frequently asked questions" },
  { id: "stronghold", path: "/minecraft/stronghold", name: "The stronghold", y: "−56", color: "#f0b175", art: `${relief}/07-stronghold.webp`,
    title: "The stronghold" },
  { id: "end", path: "/minecraft/apply", name: "The End", y: "—", color: "#d9d0a0", art: `${dimensions}/end-application.webp`,
    title: "Apply to DataHacks 2.0" },
];

/** Hashes the old scrolling page used, so existing links keep working. */
export const LEGACY_HASHES: Record<string, string> = {
  "#top": "/minecraft",
  "#about": "/minecraft/about",
  "#emerald-layer": "/minecraft/about",
  "#tracks": "/minecraft/tracks",
  "#iron-layer": "/minecraft/tracks",
  "#gold-layer": "/minecraft/sponsors",
  "#mineshaft-layer": "/minecraft/speakers",
  "#diamond-layer": "/minecraft/prizes",
  "#trial-layer": "/minecraft/trials",
  "#faq": "/minecraft/faq",
  "#sculk-layer": "/minecraft/faq",
  "#lava-layer": "/minecraft/stronghold",
  "#apply": "/minecraft/apply",
};

export const chapterAt = (index: number): Chapter | undefined =>
  index < 0 ? undefined : CHAPTERS[index];

/** -1 when the pathname is not a chapter — the Nether and Trial Chambers doors. */
export const chapterIndexOf = (pathname: string): number => {
  const path = pathname.replace(/\/+$/, "") || "/minecraft";
  return CHAPTERS.findIndex(c => c.path === path);
};
