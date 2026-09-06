/**
 * Hand-authored path data for the Datasaur.
 * Shared between the full engraved plate (Fig. 1) and the distant
 * silhouettes used in the hero landscape, so the animal reads as
 * one character everywhere on the page.
 *
 * Local coordinate space: 0 0 620 460, ground line at y = 388.
 */

export const D_BODY =
  "M176 268C176 200 232 166 316 166C404 166 462 202 464 262C466 316 404 346 318 346C232 346 176 322 176 268Z";

export const D_NECK =
  "M198 236C148 216 116 178 110 122L168 108C176 166 214 194 258 208Z";

export const D_HEAD =
  "M110 130C78 130 46 120 34 104C24 92 30 74 48 66C64 58 88 54 112 56C146 58 168 74 168 94C168 116 146 132 110 130Z";

export const D_TAIL =
  "M448 226C500 222 548 200 596 156C601 151 608 158 603 165C560 215 508 252 452 270Z";

const leg = (x: number, w: number, top: number, bottom: number) =>
  `M${x} ${top}L${x} ${bottom - 16}C${x} ${bottom} ${x + w} ${bottom} ${x + w} ${bottom - 16}L${x + w} ${top}Z`;

export const D_LEG_FAR_A = leg(240, 42, 300, 366);
export const D_LEG_FAR_B = leg(384, 42, 302, 366);
export const D_LEG_NEAR_A = leg(204, 56, 312, 388);
export const D_LEG_NEAR_B = leg(366, 56, 314, 388);

/** One dorsal plate, drawn around its own origin so it can be placed + rotated. */
export const D_PLATE = "M-17 9C-12 -17 -5 -27 0 -27C5 -27 12 -17 17 9Z";

export type PlatePlacement = { x: number; y: number; s: number; r: number };

export const D_BACK_PLATES: PlatePlacement[] = [
  { x: 236, y: 182, s: 0.92, r: -26 },
  { x: 276, y: 172, s: 1.08, r: -14 },
  { x: 320, y: 168, s: 1.2, r: -2 },
  { x: 364, y: 174, s: 1.08, r: 11 },
  { x: 404, y: 186, s: 0.94, r: 23 },
  { x: 436, y: 204, s: 0.76, r: 37 },
  { x: 457, y: 226, s: 0.58, r: 51 },
];

export const D_NECK_PLATES: PlatePlacement[] = [
  { x: 170, y: 130, s: 0.46, r: 76 },
  { x: 181, y: 158, s: 0.52, r: 68 },
  { x: 195, y: 186, s: 0.58, r: 58 },
];
