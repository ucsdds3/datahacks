import { CREAM, INK, TOMATO } from "./palette";

/**
 * Hero wordmark: Shrikhand, cream fill, thick ink outline, offset tomato drop
 * shadow. Line one rides a gentle arc via textPath; line two sits beneath it
 * at 0.82-ish leading so the two lines nearly touch.
 */

const ARC = "M 34 258 C 320 168 880 168 1166 258";

function Word({
  dx,
  dy,
  fill,
  strokeWidth,
}: {
  dx: number;
  dy: number;
  fill: string;
  strokeWidth: number;
}) {
  return (
    <g transform={`translate(${dx} ${dy})`} fill={fill} stroke={INK} strokeWidth={strokeWidth}>
      <text className="g-wordmark__t" fontSize={186} style={{ paintOrder: "stroke" }}>
        <textPath
          href="#g-arc"
          startOffset="50%"
          textAnchor="middle"
          textLength={1046}
          lengthAdjust="spacingAndGlyphs"
        >
          DataHacks
        </textPath>
      </text>
      <text
        className="g-wordmark__t"
        x={600}
        y={452}
        fontSize={228}
        textAnchor="middle"
        textLength={392}
        lengthAdjust="spacingAndGlyphs"
        style={{ paintOrder: "stroke" }}
      >
        2.0
      </text>
    </g>
  );
}

export function HeroWordmark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 500"
      fill="none"
      role="img"
      aria-label="DataHacks 2.0"
      focusable="false"
    >
      <defs>
        <path id="g-arc" d={ARC} />
      </defs>
      {/* offset drop shadow, then the face */}
      <Word dx={17} dy={19} fill={TOMATO} strokeWidth={20} />
      <Word dx={0} dy={0} fill={CREAM} strokeWidth={20} />
    </svg>
  );
}
