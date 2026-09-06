import { INK, RAINBOW } from "./palette";

/**
 * The signature move: one continuous S-curved ribbon built from six stroked
 * bands. Each band is painted ink-first then colour-on-top, back to front, so
 * every band ends up carrying the same ink outline and the bands read as a
 * single stacked ribbon rather than six loose lines.
 */

const BAND = 22; // colour stroke width
const OUTLINE = 28; // ink stroke width -> 3px of ink on each side
const STEP = 25; // perpendicular offset between band centres

type Variant = "hero" | "divider" | "footer";

const PATHS: Record<Variant, { d: string; viewBox: string }> = {
  // long lazy S across the hero: dips low left, crests centre, dives right
  hero: {
    d: "M -80 250 C 150 250 175 84 396 84 C 604 84 648 322 872 322 C 1076 322 1128 128 1520 104",
    viewBox: "0 0 1440 520",
  },
  // shallower double wave, used once again lower down the page as a divider
  divider: {
    d: "M -80 96 C 210 96 250 24 520 60 C 760 92 800 168 1060 150 C 1250 137 1330 92 1520 70",
    viewBox: "0 0 1440 300",
  },
  footer: {
    d: "M -80 60 C 260 60 300 150 620 132 C 900 116 980 44 1520 52",
    viewBox: "0 0 1440 250",
  },
};

export function RainbowRibbon({
  variant = "hero",
  className,
  ariaHidden = true,
}: {
  variant?: Variant;
  className?: string;
  ariaHidden?: boolean;
}) {
  const { d, viewBox } = PATHS[variant];

  return (
    <svg
      className={className}
      viewBox={viewBox}
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden={ariaHidden}
      focusable="false"
    >
      {RAINBOW.map((colour, i) => (
        <g key={colour} transform={`translate(0 ${i * STEP})`}>
          <path d={d} stroke={INK} strokeWidth={OUTLINE} strokeLinecap="round" />
          <path d={d} stroke={colour} strokeWidth={BAND} strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

/** Compact rainbow rule — same band logic, straight, used as a small accent. */
export function RibbonRule({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 96"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {RAINBOW.map((colour, i) => (
        <g key={colour} transform={`translate(0 ${i * 15})`}>
          <path d="M 8 12 H 212" stroke={INK} strokeWidth={17} strokeLinecap="round" />
          <path d="M 8 12 H 212" stroke={colour} strokeWidth={11} strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}
