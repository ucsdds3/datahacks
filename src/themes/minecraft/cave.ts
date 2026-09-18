/**
 * The shaft wall, composed from real block textures rather than drawn.
 *
 * A Minecraft cave wall is a grid of 16x16 tiles, so it is built as one — every
 * block is a genuine vanilla texture from public/images/minecraft/textures. That
 * buys three things a painted backdrop cannot: the pixels are exact instead of
 * approximated, the wall is continuous by construction so there is no seam to
 * hide, and one stratum can give way to the next block by block the way terrain
 * generation does it.
 *
 * Pure geometry and material choice here; the drawing lives in CaveWall.tsx.
 */

/** Blocks down the wall that one chapter occupies. Sets both how far the wall
 * travels while a chapter is on screen and, with it, how strong the parallax is. */
export const STRATUM_ROWS = 18;
/** Blocks over which one stratum gives way to the next. */
export const BLEND_ROWS = 7;

export type Stratum = {
  /** Fills most of the wall. */
  base: string;
  /** Occasional blocks broken into the base, for texture. */
  mix: string[];
  /** Rare finds. Rarity is the chance per block, so keep it small. */
  ore: { name: string; rarity: number }[];
  /** Ambient tint of the open cave at this depth, as an rgb triple. */
  air: [number, number, number];
};

/** Surface to bedrock, one per chapter below the hero. */
export const STRATA: Stratum[] = [
  { base: "stone", mix: ["cobbled_deepslate", "andesite", "diorite", "granite", "gravel"],
    ore: [{ name: "coal_ore", rarity: .035 }, { name: "copper_ore", rarity: .025 }], air: [26, 30, 34] },
  { base: "stone", mix: ["andesite", "granite", "cobbled_deepslate", "diorite"],
    ore: [{ name: "iron_ore", rarity: .03 }, { name: "redstone_ore", rarity: .02 }], air: [24, 27, 32] },
  { base: "stone", mix: ["sulfur", "andesite", "sulfur", "gravel"],
    ore: [{ name: "cinnabar", rarity: .03 }, { name: "sulfur", rarity: .05 }], air: [28, 27, 20] },
  { base: "stone", mix: ["cobbled_deepslate", "oak_planks", "andesite", "gravel"],
    ore: [{ name: "oak_log", rarity: .022 }, { name: "iron_ore", rarity: .015 }, { name: "cobweb", rarity: .012 }], air: [22, 22, 24] },
  { base: "deepslate", mix: ["cobbled_deepslate", "deepslate", "andesite"],
    ore: [{ name: "deepslate_diamond_ore", rarity: .016 }, { name: "deepslate_lapis_ore", rarity: .018 }, { name: "deepslate_redstone_ore", rarity: .018 }], air: [16, 19, 23] },
  { base: "deepslate_bricks", mix: ["cracked_deepslate_bricks", "deepslate_tiles", "cobbled_deepslate"],
    ore: [{ name: "copper_ore", rarity: .014 }, { name: "deepslate_iron_ore", rarity: .014 }], air: [17, 17, 19] },
  { base: "deepslate_tiles", mix: ["deepslate_bricks", "sculk", "cracked_deepslate_bricks", "sculk"],
    ore: [{ name: "sculk_vein", rarity: .04 }, { name: "sculk", rarity: .05 }], air: [11, 17, 19] },
  { base: "cracked_deepslate_bricks", mix: ["deepslate_bricks", "cobbled_deepslate", "deepslate_tiles"],
    ore: [{ name: "obsidian", rarity: .02 }, { name: "lava_still", rarity: .012 }], air: [20, 14, 11] },
  { base: "obsidian", mix: ["bedrock", "obsidian", "cobbled_deepslate"],
    ore: [{ name: "end_portal_surface", rarity: .015 }], air: [14, 11, 20] },
];

/** Every texture the wall can ask for, so they can be preloaded in one pass. */
export const TEXTURES = [...new Set(STRATA.flatMap(s => [s.base, ...s.mix, ...s.ore.map(o => o.name)]))];

/** Deterministic value hash. Same block, same material, on every device and reload. */
export function hash(x: number, y: number, seed: number): number {
  let h = (seed * 2654435761) ^ (x * 374761393) ^ (y * 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const ease = (t: number) => t * t * (3 - 2 * t);

/** Smoothed 1-D noise, used to wander the cave edges down the shaft. */
function wave(row: number, period: number, seed: number): number {
  const p = row / period;
  const i = Math.floor(p);
  return hash(i, 0, seed) * (1 - ease(p - i)) + hash(i + 1, 0, seed) * ease(p - i);
}

/** Irregular but never jagged. The short period is what puts visible steps in the
 * silhouette within a single window; the long one keeps the cave wandering. */
function contour(row: number, seed: number): number {
  return wave(row, 3, seed) * .24 + wave(row, 9, seed + 91) * .33 + wave(row, 26, seed + 173) * .43;
}

/**
 * How far in the cave mouth sits on each side of a given row, as a fraction of the
 * width. The opening runs the whole height of the shaft, which is what keeps the
 * middle clear for text without anything having to be masked over it.
 */
export function mouth(row: number): { left: number; right: number } {
  return {
    left: .04 + contour(row, 11) * .19,
    right: 1 - (.04 + contour(row, 47) * .19),
  };
}

/**
 * Whether a cell is solid rock rather than open cave. Rows are rounded to whole
 * blocks so the silhouette steps like Minecraft terrain instead of sloping.
 */
export function isRock(col: number, row: number, cols: number): boolean {
  const { left, right } = mouth(row);
  return col < Math.round(left * cols) || col >= Math.round(right * cols);
}

/** Which stratum a row belongs to, and how far into it we are. */
export function strataAt(row: number): { index: number; into: number } {
  const place = row / STRATUM_ROWS;
  const index = Math.max(0, Math.min(STRATA.length - 1, Math.floor(place)));
  return { index, into: place - Math.floor(place) };
}

/**
 * The block at a cell. Near the top of a stratum some blocks are still drawn from
 * the one above, with the odds shifting over BLEND_ROWS, so the changeover is a
 * scatter of one material into the other rather than a line across the wall.
 */
export function blockAt(col: number, row: number): string {
  const { index, into } = strataAt(row);
  const overlap = BLEND_ROWS / STRATUM_ROWS;
  let which = index;
  if (index > 0 && into < overlap && hash(col, row, 7) > into / overlap) which = index - 1;

  const stratum = STRATA[Math.max(0, Math.min(STRATA.length - 1, which))];
  for (let i = 0; i < stratum.ore.length; i++) {
    if (hash(col, row, 31 + i * 17) < stratum.ore[i].rarity) return stratum.ore[i].name;
  }
  return hash(col, row, 3) < .24
    ? stratum.mix[Math.floor(hash(col, row, 5) * stratum.mix.length) % stratum.mix.length]
    : stratum.base;
}

/** The colour of the open air at a row, eased between strata. */
export function airAt(row: number): [number, number, number] {
  const { index, into } = strataAt(row);
  const next = STRATA[Math.min(STRATA.length - 1, index + 1)].air;
  const here = STRATA[index].air;
  const t = ease(Math.max(0, Math.min(1, (into - .6) / .4)));
  return [0, 1, 2].map(i => here[i] + (next[i] - here[i]) * t) as [number, number, number];
}
