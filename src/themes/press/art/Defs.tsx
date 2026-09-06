/**
 * One hidden SVG holding every pattern + filter used by the Press theme's
 * engraving system. Ids are prefixed `pz-` so they can never collide with the
 * other two theme mockups.
 *
 * All patterns use patternUnits="userSpaceOnUse" so the halftone screen stays
 * aligned across separate shapes — exactly like a real screened plate.
 */

const SEPIA = "#B08D5F";
const SEPIA_DEEP = "#8B6B3C";
const INK = "#141210";
const CREAM = "#F5E9C8";

/** dot radius per tonal step, on a 6px screen pitch rotated 45deg */
const TONES: Array<[string, number]> = [
  ["06", 0.5],
  ["15", 0.85],
  ["25", 1.15],
  ["40", 1.5],
  ["55", 1.85],
  ["70", 2.2],
  ["85", 2.55],
];

function DotFamily({ prefix, color }: { prefix: string; color: string }) {
  return (
    <>
      {TONES.map(([k, r]) => (
        <pattern
          key={prefix + k}
          id={`${prefix}-${k}`}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <circle cx="3" cy="3" r={r} fill={color} />
        </pattern>
      ))}
    </>
  );
}

export default function PressDefs() {
  return (
    <svg className="press-defs" aria-hidden="true" focusable="false" width="0" height="0">
      <defs>
        <DotFamily prefix="pz-ht" color={SEPIA} />
        <DotFamily prefix="pz-hd" color={SEPIA_DEEP} />
        <DotFamily prefix="pz-hi" color={INK} />
        <DotFamily prefix="pz-hc" color={CREAM} />

        {/* line hatching — the other half of an engraving */}
        <pattern
          id="pz-hatch"
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="5" stroke={SEPIA_DEEP} strokeWidth="0.9" />
        </pattern>
        <pattern
          id="pz-hatch-fine"
          width="3.4"
          height="3.4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="3.4" stroke={SEPIA_DEEP} strokeWidth="0.6" />
        </pattern>
        <pattern
          id="pz-hatch-neck"
          width="4.2"
          height="4.2"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(52)"
        >
          <line x1="0" y1="0" x2="0" y2="4.2" stroke={SEPIA_DEEP} strokeWidth="0.75" />
        </pattern>
        <pattern
          id="pz-cross"
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="5" stroke={SEPIA_DEEP} strokeWidth="0.7" />
          <line x1="0" y1="0" x2="5" y2="0" stroke={SEPIA_DEEP} strokeWidth="0.7" />
        </pattern>
        <pattern id="pz-sky" width="7" height="7" patternUnits="userSpaceOnUse">
          <line x1="0" y1="3.5" x2="7" y2="3.5" stroke={SEPIA} strokeWidth="0.7" />
        </pattern>
        <pattern id="pz-sky-fine" width="5" height="5" patternUnits="userSpaceOnUse">
          <line x1="0" y1="2.5" x2="5" y2="2.5" stroke={SEPIA} strokeWidth="0.45" />
        </pattern>
        <pattern id="pz-cross-ink" width="6" height="6" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke={INK} strokeWidth="0.6" />
          <line x1="0" y1="0" x2="6" y2="0" stroke={INK} strokeWidth="0.6" />
        </pattern>

        {/* press grain */}
        <filter id="pz-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.6" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
