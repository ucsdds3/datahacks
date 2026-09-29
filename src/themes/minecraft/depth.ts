/** The descent, as numbers. Kept apart from the DOM so the story's spine is testable. */

/** Bedrock. The End has no Y of its own, so it reads as the bottom of the world. */
export const BEDROCK = -64;

/** Parses a chapter's display reading ("+48", "−28", "—") into a number.
 * Note the U+2212 minus in the data, which Number() will not accept. */
export function depthOf(y: string): number {
  const parsed = Number(y.replace("−", "-"));
  return Number.isNaN(parsed) ? BEDROCK : parsed;
}

/**
 * Y at a point in the descent, 0 at the surface and 1 at the End.
 *
 * Chapters are evenly spaced along the scroll, so the reading is interpolated
 * between the two the camera sits between rather than jumping at each boundary —
 * a depth meter that ticks continuously is what makes the scroll read as falling
 * rather than as paging.
 */
export function depthAt(progress: number, depths: number[]): number {
  if (depths.length === 0) return BEDROCK;
  if (depths.length === 1) return depths[0];
  const position = Math.max(0, Math.min(1, progress)) * (depths.length - 1);
  const index = Math.min(Math.floor(position), depths.length - 2);
  const ratio = position - index;
  return depths[index] + (depths[index + 1] - depths[index]) * ratio;
}

/** The meter shows whole blocks, signed, the way Minecraft's own readout does. */
export function formatDepth(y: number): string {
  const rounded = Math.round(y);
  return rounded < 0 ? `−${Math.abs(rounded)}` : `+${rounded}`;
}
