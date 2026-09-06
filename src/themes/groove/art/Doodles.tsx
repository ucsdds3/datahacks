import type { ReactNode } from "react";
import { CREAM, INK, LILAC, MARIGOLD, MINT, ORANGE, PINK, SKY, TOMATO } from "./palette";

/**
 * The doodle ecosystem: rockets, ringed planets, four-point sparkles, smiling
 * daisies, mushrooms, worms and wide-eyed characters. Every shape carries the
 * same ink outline, flat fill only.
 */

type DoodleProps = {
  className?: string;
  colour?: string;
  accent?: string;
};

const base = {
  stroke: INK,
  strokeWidth: 6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Frame({
  children,
  className,
  vb = "0 0 100 100",
}: {
  children: ReactNode;
  className?: string;
  vb?: string;
}) {
  return (
    <svg className={className} viewBox={vb} fill="none" aria-hidden="true" focusable="false">
      <g {...base}>{children}</g>
    </svg>
  );
}

export function Sparkle({ className, colour = MARIGOLD }: DoodleProps) {
  return (
    <Frame className={className}>
      <path
        d="M 50 6 C 56 38 62 44 94 50 C 62 56 56 62 50 94 C 44 62 38 56 6 50 C 38 44 44 38 50 6 Z"
        fill={colour}
      />
    </Frame>
  );
}

export function Planet({ className, colour = SKY, accent = TOMATO }: DoodleProps) {
  return (
    <Frame className={className}>
      <ellipse cx={50} cy={54} rx={44} ry={12} transform="rotate(-18 50 54)" fill={CREAM} />
      <circle cx={50} cy={50} r={28} fill={colour} />
      <path d="M 30 40 C 40 46 58 46 70 39" fill="none" stroke={INK} strokeWidth={5} />
      <path
        d="M 6 58 C 22 66 40 68 56 64"
        fill="none"
        stroke={INK}
        strokeWidth={6}
        transform="rotate(-18 50 54)"
      />
      <path
        d="M 46 44 C 62 50 82 50 94 44"
        fill="none"
        stroke={INK}
        strokeWidth={6}
        transform="rotate(-18 50 54)"
      />
      <circle cx={62} cy={58} r={5} fill={accent} strokeWidth={4} />
    </Frame>
  );
}

export function Rocket({ className, colour = TOMATO, accent = SKY }: DoodleProps) {
  return (
    <Frame className={className}>
      <path d="M 30 62 C 14 68 12 82 16 92 C 28 90 38 82 42 70 Z" fill={MARIGOLD} />
      <path d="M 66 46 C 82 40 88 26 86 10 C 70 12 58 22 52 36 Z" fill={ORANGE} />
      <path
        d="M 40 76 C 26 62 26 40 40 24 C 50 12 62 6 74 4 C 78 18 76 34 68 48 C 60 62 50 70 40 76 Z"
        fill={colour}
      />
      <circle cx={56} cy={34} r={10} fill={accent} />
      <path d="M 32 78 C 26 88 20 94 12 98" fill="none" stroke={INK} strokeWidth={6} />
    </Frame>
  );
}

export function Daisy({ className, colour = CREAM, accent = MARIGOLD }: DoodleProps) {
  const petals = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Frame className={className}>
      {petals.map((a) => (
        <ellipse
          key={a}
          cx={50}
          cy={20}
          rx={13}
          ry={19}
          fill={colour}
          transform={`rotate(${a} 50 50)`}
        />
      ))}
      <circle cx={50} cy={50} r={19} fill={accent} />
      <circle cx={44} cy={46} r={3} fill={INK} strokeWidth={0} />
      <circle cx={57} cy={46} r={3} fill={INK} strokeWidth={0} />
      <path d="M 43 56 C 47 61 54 61 58 56" fill="none" stroke={INK} strokeWidth={4} />
    </Frame>
  );
}

export function Mushroom({ className, colour = TOMATO }: DoodleProps) {
  return (
    <Frame className={className}>
      <path
        d="M 34 54 C 34 76 34 88 38 94 L 62 94 C 66 86 66 74 66 54 Z"
        fill={CREAM}
      />
      <path
        d="M 12 54 C 12 30 29 12 50 12 C 71 12 88 30 88 54 C 76 60 24 60 12 54 Z"
        fill={colour}
      />
      <circle cx={32} cy={38} r={7} fill={CREAM} strokeWidth={4} />
      <circle cx={60} cy={31} r={5} fill={CREAM} strokeWidth={4} />
      <circle cx={70} cy={45} r={4} fill={CREAM} strokeWidth={4} />
      <circle cx={43} cy={72} r={3} fill={INK} strokeWidth={0} />
      <circle cx={57} cy={72} r={3} fill={INK} strokeWidth={0} />
      <path d="M 44 80 C 47 84 53 84 56 80" fill="none" stroke={INK} strokeWidth={4} />
    </Frame>
  );
}

export function Worm({ className, colour = MINT }: DoodleProps) {
  return (
    <Frame className={className} vb="0 0 120 80">
      <path
        d="M 14 62 C 4 40 22 22 40 30 C 56 37 52 56 66 60 C 82 65 92 50 88 34"
        fill="none"
        stroke={INK}
        strokeWidth={22}
        strokeLinecap="round"
      />
      <path
        d="M 14 62 C 4 40 22 22 40 30 C 56 37 52 56 66 60 C 82 65 92 50 88 34"
        fill="none"
        stroke={colour}
        strokeWidth={14}
        strokeLinecap="round"
      />
      <circle cx={84} cy={26} r={13} fill={colour} />
      <circle cx={80} cy={24} r={3} fill={INK} strokeWidth={0} />
      <circle cx={90} cy={23} r={3} fill={INK} strokeWidth={0} />
      <path d="M 79 33 C 83 36 89 36 92 32" fill="none" stroke={INK} strokeWidth={4} />
    </Frame>
  );
}

export function Buddy({ className, colour = LILAC, accent = CREAM }: DoodleProps) {
  return (
    <Frame className={className}>
      <path
        d="M 22 46 C 22 22 34 8 50 8 C 66 8 78 22 78 46 C 78 70 68 84 50 84 C 32 84 22 70 22 46 Z"
        fill={colour}
      />
      <circle cx={40} cy={42} r={11} fill={accent} />
      <circle cx={64} cy={42} r={11} fill={accent} />
      <circle cx={41} cy={44} r={4} fill={INK} strokeWidth={0} />
      <circle cx={65} cy={44} r={4} fill={INK} strokeWidth={0} />
      <path d="M 40 64 C 45 70 55 70 60 64" fill="none" stroke={INK} strokeWidth={5} />
      <path d="M 36 84 L 33 96 M 64 84 L 67 96" fill="none" stroke={INK} strokeWidth={6} />
      <path d="M 20 40 L 8 30 M 80 40 L 92 30" fill="none" stroke={INK} strokeWidth={6} />
    </Frame>
  );
}

export function Swirl({ className, colour = PINK }: DoodleProps) {
  return (
    <Frame className={className}>
      <path
        d="M 50 92 C 22 92 8 72 12 50 C 16 28 36 14 58 18 C 76 21 86 36 82 52 C 78 66 64 74 52 70 C 42 67 38 57 42 49"
        fill="none"
        stroke={INK}
        strokeWidth={16}
      />
      <path
        d="M 50 92 C 22 92 8 72 12 50 C 16 28 36 14 58 18 C 76 21 86 36 82 52 C 78 66 64 74 52 70 C 42 67 38 57 42 49"
        fill="none"
        stroke={colour}
        strokeWidth={9}
      />
    </Frame>
  );
}

export function Comet({ className, colour = MARIGOLD }: DoodleProps) {
  return (
    <Frame className={className} vb="0 0 120 80">
      <path d="M 8 66 L 44 44 M 14 26 L 48 34 M 30 74 L 56 60" fill="none" stroke={INK} strokeWidth={7} />
      <circle cx={80} cy={40} r={24} fill={colour} />
      <path d="M 70 32 C 76 38 86 38 92 31" fill="none" stroke={INK} strokeWidth={5} />
    </Frame>
  );
}

/** A tiny ink-only star used as a bullet / marker glyph. */
export function StarGlyph({ className, colour = MARIGOLD }: DoodleProps) {
  return (
    <Frame className={className}>
      <path
        d="M 50 10 C 55 40 60 45 90 50 C 60 55 55 60 50 90 C 45 60 40 55 10 50 C 40 45 45 40 50 10 Z"
        fill={colour}
        strokeWidth={7}
      />
    </Frame>
  );
}
