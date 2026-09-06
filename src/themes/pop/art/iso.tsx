/**
 * Isometric primitive kit for the POP theme.
 *
 * True 2:1-ish isometric projection (30° axes):
 *   screenX = (x - y) * cos30
 *   screenY = (x + y) * sin30 - z
 *
 * +x  -> right & down on screen
 * +y  -> left  & down on screen
 * +z  -> straight up
 *
 * Visible faces of any axis-aligned box from this camera:
 *   top      (z + h)  -> LIGHT
 *   left     (y + d)  -> MID     (this is the "front" of anything facing +y)
 *   right    (x + w)  -> SHADOW
 *
 * Flat fills only. Three tones per volume. No gradients, no shadows.
 */
import React from "react";

export const K = 0.8660254; // cos 30°

export function proj(x: number, y: number, z: number): [number, number] {
  return [(x - y) * K, (x + y) * 0.5 - z];
}

function pt(x: number, y: number, z: number): string {
  const [a, b] = proj(x, y, z);
  return `${a.toFixed(2)},${b.toFixed(2)}`;
}

function poly(points: Array<[number, number, number]>): string {
  return points.map((p) => pt(p[0], p[1], p[2])).join(" ");
}

export interface Shade {
  l: string;
  m: string;
  d: string;
}

export const C = {
  orange: { l: "#FF8B4D", m: "#F26522", d: "#B94510" },
  rust: { l: "#F0763A", m: "#D9541A", d: "#9A3A0C" },
  marigold: { l: "#F9D879", m: "#F0BE3D", d: "#BC8C18" },
  teal: { l: "#74CFC1", m: "#4FB3A5", d: "#2E7D72" },
  grey: { l: "#D9D3C9", m: "#B9B3A9", d: "#857F75" },
  cream: { l: "#FFF8EC", m: "#EFE4D0", d: "#C7BAA2" },
  pink: { l: "#F8C6EE", m: "#EFA0DE", d: "#B96FAA" },
  ink: { l: "#3C3A38", m: "#232120", d: "#000000" },
  skin: { l: "#F4C79C", m: "#DCA877", d: "#A87A4F" },
  white: { l: "#FFFFFF", m: "#F0EDE7", d: "#CFC9BF" },
} satisfies Record<string, Shade>;

interface Common {
  o?: number; // ink outline width, in iso units
}

export interface BoxProps extends Common {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  c: Shade;
  /** per-face colour overrides */
  top?: string;
  front?: string; // the y+d face
  side?: string; // the x+w face
}

export function Box({ x, y, z, w, d, h, c, top, front, side, o = 0 }: BoxProps) {
  const stroke = o ? "#000" : "none";
  return (
    <g stroke={stroke} strokeWidth={o} strokeLinejoin="round">
      {/* x+w face — shadow */}
      <polygon
        fill={side ?? c.d}
        points={poly([
          [x + w, y, z + h],
          [x + w, y + d, z + h],
          [x + w, y + d, z],
          [x + w, y, z],
        ])}
      />
      {/* y+d face — mid (reads as the front) */}
      <polygon
        fill={front ?? c.m}
        points={poly([
          [x, y + d, z + h],
          [x + w, y + d, z + h],
          [x + w, y + d, z],
          [x, y + d, z],
        ])}
      />
      {/* top face — light */}
      <polygon
        fill={top ?? c.l}
        points={poly([
          [x, y, z + h],
          [x + w, y, z + h],
          [x + w, y + d, z + h],
          [x, y + d, z + h],
        ])}
      />
    </g>
  );
}

/** A flat slab lying on the ground / on top of something — top face only, plus thin sides. */
export function Plate(props: BoxProps) {
  return <Box {...props} />;
}

export interface CylProps extends Common {
  x: number; // centre
  y: number; // centre
  z: number; // base
  r: number;
  h: number;
  c: Shade;
}

/** Vertical cylinder. Circle in the ground plane projects to an axis-aligned ellipse. */
export function Cyl({ x, y, z, r, h, c, o = 0 }: CylProps) {
  const [cx, cyTop] = proj(x, y, z + h);
  const [, cyBase] = proj(x, y, z);
  const rx = r * K * Math.SQRT2;
  const ry = r * 0.5 * Math.SQRT2;
  const body = [
    `M ${(cx - rx).toFixed(2)} ${cyTop.toFixed(2)}`,
    `L ${(cx - rx).toFixed(2)} ${cyBase.toFixed(2)}`,
    `A ${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 0 ${(cx + rx).toFixed(2)} ${cyBase.toFixed(2)}`,
    `L ${(cx + rx).toFixed(2)} ${cyTop.toFixed(2)}`,
    `A ${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 1 ${(cx - rx).toFixed(2)} ${cyTop.toFixed(2)}`,
    "Z",
  ].join(" ");
  const leftHalf = [
    `M ${(cx - rx).toFixed(2)} ${cyTop.toFixed(2)}`,
    `L ${(cx - rx).toFixed(2)} ${cyBase.toFixed(2)}`,
    `A ${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 0 ${cx.toFixed(2)} ${(cyBase + ry).toFixed(2)}`,
    `L ${cx.toFixed(2)} ${(cyTop + ry).toFixed(2)}`,
    `A ${rx.toFixed(2)} ${ry.toFixed(2)} 0 0 1 ${(cx - rx).toFixed(2)} ${cyTop.toFixed(2)}`,
    "Z",
  ].join(" ");
  const stroke = o ? "#000" : "none";
  return (
    <g stroke={stroke} strokeWidth={o} strokeLinejoin="round">
      <path d={body} fill={c.d} />
      <path d={leftHalf} fill={c.m} />
      <ellipse cx={cx} cy={cyTop} rx={rx} ry={ry} fill={c.l} />
    </g>
  );
}

export interface PrismProps extends Common {
  x: number;
  y: number;
  z: number;
  t: number; // thickness along x
  d: number; // depth along y (base width of the triangle)
  h: number; // height to the ridge
  c: Shade;
}

/** Triangular plate — thin along x, triangular in the y/z plane. Used for the datasaur's back plates. */
export function Prism({ x, y, z, t, d, h, c, o = 0 }: PrismProps) {
  const stroke = o ? "#000" : "none";
  return (
    <g stroke={stroke} strokeWidth={o} strokeLinejoin="round">
      {/* +y slant — catches light */}
      <polygon
        fill={c.l}
        points={poly([
          [x, y + d / 2, z + h],
          [x + t, y + d / 2, z + h],
          [x + t, y + d, z],
          [x, y + d, z],
        ])}
      />
      {/* x+t triangle face */}
      <polygon
        fill={c.m}
        points={poly([
          [x + t, y, z],
          [x + t, y + d, z],
          [x + t, y + d / 2, z + h],
        ])}
      />
    </g>
  );
}

export interface GroundProps {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  step?: number;
  color?: string;
  opacity?: number;
  width?: number;
}

/** Implied isometric ground plane — a faint diamond grid. Objects cast no shadow. */
export function Ground({
  x0,
  x1,
  y0,
  y1,
  step = 20,
  color = "#000",
  opacity = 0.14,
  width = 1,
}: GroundProps) {
  const lines: React.ReactNode[] = [];
  for (let x = x0; x <= x1 + 0.001; x += step) {
    const [ax, ay] = proj(x, y0, 0);
    const [bx, by] = proj(x, y1, 0);
    lines.push(<line key={`gx${x}`} x1={ax} y1={ay} x2={bx} y2={by} />);
  }
  for (let y = y0; y <= y1 + 0.001; y += step) {
    const [ax, ay] = proj(x0, y, 0);
    const [bx, by] = proj(x1, y, 0);
    lines.push(<line key={`gy${y}`} x1={ax} y1={ay} x2={bx} y2={by} />);
  }
  return (
    <g stroke={color} strokeWidth={width} opacity={opacity} strokeLinecap="round">
      {lines}
    </g>
  );
}

export interface HumanProps {
  x: number;
  y: number;
  z?: number;
  shirt?: Shade;
  pants?: Shade;
  hair?: string;
  /** flip the arm/leg stance so a crowd doesn't look cloned */
  variant?: 0 | 1 | 2;
}

/**
 * Tiny human, ~20 iso units tall — the scale device borrowed from the reference.
 * Faces +y (towards the camera-left), same as everything else.
 */
export function Human({
  x,
  y,
  z = 0,
  shirt = C.teal,
  pants = C.ink,
  hair = "#1B1614",
  variant = 0,
}: HumanProps) {
  const legH = variant === 2 ? 8 : 7;
  return (
    <g>
      {/* legs */}
      <Box x={x} y={y + 1} z={z} w={3.4} d={3.4} h={legH} c={pants} />
      <Box x={x + 4.6} y={y + 1} z={z} w={3.4} d={3.4} h={legH} c={pants} />
      {/* torso */}
      <Box x={x - 0.4} y={y} z={z + legH} w={8.8} d={5} h={8} c={shirt} />
      {/* arms */}
      <Box
        x={x - 2.4}
        y={y + 0.6}
        z={z + legH + (variant === 1 ? 2.5 : 0.5)}
        w={2.2}
        d={3.6}
        h={variant === 1 ? 5 : 7}
        c={shirt}
      />
      <Box
        x={x + 8.6}
        y={y + 0.6}
        z={z + legH + 0.5}
        w={2.2}
        d={3.6}
        h={7}
        c={shirt}
      />
      {/* head */}
      <Box x={x + 1.2} y={y + 0.6} z={z + legH + 8} w={5.6} d={4.2} h={5} c={C.skin} />
      {/* hair */}
      <Box
        x={x + 1}
        y={y + 0.4}
        z={z + legH + 12.6}
        w={6}
        d={4.6}
        h={1.6}
        c={C.ink}
        top={hair}
        front={hair}
        side={hair}
      />
    </g>
  );
}
