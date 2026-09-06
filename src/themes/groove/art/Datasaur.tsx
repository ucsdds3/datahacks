import { CREAM, INK, MARIGOLD, MINT, ORANGE, PINK, SKY, TOMATO } from "./palette";

/**
 * The Datasaur — hand-authored doodle sauropod.
 * Long neck, oversized friendly head, four stubby legs, six rainbow back
 * plates, sunglasses, riding the ribbon. Thick uniform ink stroke, flat fill,
 * zero gradients.
 */

const S = 7; // uniform stroke width, in viewBox units

const PLATES: { x: number; y: number; a: number; c: string }[] = [
  { x: 192, y: 178, a: -26, c: TOMATO },
  { x: 221, y: 170, a: -15, c: ORANGE },
  { x: 250, y: 167, a: -3, c: MARIGOLD },
  { x: 279, y: 171, a: 9, c: MINT },
  { x: 307, y: 182, a: 22, c: SKY },
  { x: 331, y: 199, a: 36, c: PINK },
];

/** four-point sparkle, drawn in local coords around 0,0 */
function Spark({
  x,
  y,
  r,
  colour,
  rotate = 0,
}: {
  x: number;
  y: number;
  r: number;
  colour: string;
  rotate?: number;
}) {
  const w = r * 0.34;
  const d = `M 0 ${-r} C ${w} ${-w} ${w} ${-w} ${r} 0 C ${w} ${w} ${w} ${w} 0 ${r} C ${-w} ${w} ${-w} ${w} ${-r} 0 C ${-w} ${-w} ${-w} ${-w} 0 ${-r} Z`;
  return (
    <path
      d={d}
      transform={`translate(${x} ${y}) rotate(${rotate})`}
      fill={colour}
      stroke={INK}
      strokeWidth={5}
      strokeLinejoin="round"
    />
  );
}

export function Datasaur({
  className,
  title = "The Datasaur, wearing sunglasses, surfing a rainbow ribbon",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 470 390"
      fill="none"
      role="img"
      aria-label={title}
      focusable="false"
    >
      <g
        stroke={INK}
        strokeWidth={S}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(4 0) rotate(-3 235 200)"
      >
        {/* sparkles trailing off the tail */}
        <Spark x={412} y={92} r={20} colour={MARIGOLD} rotate={12} />
        <Spark x={446} y={152} r={12} colour={PINK} rotate={-8} />
        <Spark x={392} y={40} r={11} colour={MINT} rotate={20} />

        {/* --- far legs, behind the body --- */}
        <path
          d="M 232 250 C 214 250 212 268 214 292 C 216 314 218 326 234 326 C 250 326 252 314 254 292 C 256 268 250 250 232 250 Z"
          fill={CREAM}
        />
        <path
          d="M 328 248 C 310 248 308 266 310 290 C 312 312 314 324 330 324 C 346 324 348 312 350 290 C 352 266 346 248 328 248 Z"
          fill={CREAM}
        />

        {/* --- tail --- */}
        <path
          d="M 336 198 C 380 186 414 168 438 128 C 442 152 428 196 396 222 C 372 241 350 248 332 250 Z"
          fill={CREAM}
        />

        {/* --- neck --- */}
        <path
          d="M 150 220 C 106 200 84 158 94 118 L 140 108 C 136 152 174 192 212 204 Z"
          fill={CREAM}
        />

        {/* --- body --- */}
        <path
          d="M 156 234 C 156 193 197 168 251 168 C 307 168 347 193 347 234 C 347 274 307 298 251 298 C 197 298 156 274 156 234 Z"
          fill={CREAM}
        />

        {/* --- back plates, alternating rainbow --- */}
        {PLATES.map((p) => (
          <path
            key={`${p.x}-${p.y}`}
            d="M -17 8 C -14 -22 14 -22 17 8 Z"
            transform={`translate(${p.x} ${p.y}) rotate(${p.a})`}
            fill={p.c}
          />
        ))}

        {/* belly seam — one calm interior line, no fill */}
        <path d="M 186 268 C 214 288 288 288 318 262" fill="none" strokeWidth={5} />

        {/* --- near legs --- */}
        <path
          d="M 202 258 C 182 258 180 278 182 302 C 184 326 186 338 204 338 C 222 338 224 326 226 302 C 228 278 222 258 202 258 Z"
          fill={CREAM}
        />
        <path
          d="M 298 258 C 278 258 276 278 278 302 C 280 326 282 338 300 338 C 318 338 320 326 322 302 C 324 278 318 258 298 258 Z"
          fill={CREAM}
        />
        {/* toe ticks */}
        <path d="M 189 330 h 12 M 209 331 h 12" fill="none" strokeWidth={5} />
        <path d="M 285 330 h 12 M 305 331 h 12" fill="none" strokeWidth={5} />

        {/* --- head --- */}
        <path
          d="M 152 86 C 152 52 124 30 88 30 C 52 30 26 51 26 80 C 26 101 42 116 68 121 C 104 128 142 114 152 86 Z"
          fill={CREAM}
        />
        {/* cheek */}
        <circle cx={54} cy={100} r={9} fill={PINK} strokeWidth={4} />
        {/* nostril */}
        <circle cx={40} cy={72} r={4.5} fill={INK} strokeWidth={0} />
        {/* smile */}
        <path d="M 40 94 C 52 108 76 108 88 96" fill="none" strokeWidth={6} />

        {/* --- sunglasses --- */}
        <path d="M 78 62 C 86 57 96 57 104 61" fill="none" strokeWidth={7} />
        <path d="M 143 56 C 150 58 154 63 155 70" fill="none" strokeWidth={7} />
        <path
          d="M 36 58 C 36 49 46 45 58 46 C 72 47 80 52 79 63 C 78 76 68 82 55 81 C 42 80 36 71 36 58 Z"
          fill={INK}
        />
        <path
          d="M 102 54 C 102 44 113 40 126 41 C 140 42 148 48 146 60 C 144 73 133 79 119 78 C 105 77 102 68 102 54 Z"
          fill={INK}
        />
        {/* flat glints, no gradient */}
        <path d="M 45 56 L 56 68" stroke={CREAM} strokeWidth={5} />
        <path d="M 112 52 L 123 64" stroke={CREAM} strokeWidth={5} />

        {/* eyebrow ticks above the shades */}
        <path d="M 44 36 C 50 30 60 28 68 30" fill="none" strokeWidth={5} />
        <path d="M 112 30 C 120 27 128 28 134 32" fill="none" strokeWidth={5} />
      </g>
    </svg>
  );
}

/** Small head-only mark used in the footer / nav wordmark slot. */
export function DatasaurMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 180 150"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke={INK} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M 66 148 C 40 120 28 92 34 62 L 84 54 C 82 92 100 122 126 140 Z"
          fill={CREAM}
        />
        <path
          d="M 150 52 C 150 26 126 8 94 8 C 58 8 32 27 32 55 C 32 77 50 92 78 96 C 112 101 142 82 150 52 Z"
          fill={CREAM}
        />
        <path
          d="M 42 36 C 42 27 52 23 64 24 C 78 25 86 30 85 41 C 84 54 74 60 61 59 C 48 58 42 49 42 36 Z"
          fill={INK}
        />
        <path
          d="M 108 32 C 108 22 119 18 132 19 C 146 20 154 26 152 38 C 150 51 139 57 125 56 C 111 55 108 46 108 32 Z"
          fill={INK}
        />
        <path d="M 84 38 C 92 33 100 33 107 36" fill="none" />
        <path d="M 46 72 C 58 84 82 84 94 72" fill="none" strokeWidth={6} />
      </g>
    </svg>
  );
}
