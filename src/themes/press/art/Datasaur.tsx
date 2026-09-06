import {
  D_BODY,
  D_NECK,
  D_HEAD,
  D_TAIL,
  D_LEG_FAR_A,
  D_LEG_FAR_B,
  D_LEG_NEAR_A,
  D_LEG_NEAR_B,
  D_PLATE,
  D_BACK_PLATES,
  D_NECK_PLATES,
  type PlatePlacement,
} from "./paths";
import Frond from "./Foliage";

const INK = "#141210";
const PAPER = "#FBF4DE";

function Plates({
  list,
  tone,
  outline = INK,
}: {
  list: PlatePlacement[];
  tone: string;
  outline?: string;
}) {
  return (
    <g>
      {list.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.r}) scale(${p.s})`}>
          <path d={D_PLATE} fill={PAPER} />
          <path d={D_PLATE} fill={tone} />
          <path d={D_PLATE} fill="none" stroke={outline} strokeWidth={1.5 / p.s} strokeLinejoin="round" />
        </g>
      ))}
    </g>
  );
}

/** Flat one-colour version, for distant animals in the hero landscape. */
export function DatasaurSilhouette({ fill, opacity = 1 }: { fill: string; opacity?: number }) {
  return (
    <g fill={fill} opacity={opacity}>
      <path d={D_LEG_FAR_A} />
      <path d={D_LEG_FAR_B} />
      <path d={D_TAIL} />
      <path d={D_BODY} />
      {D_BACK_PLATES.map((p, i) => (
        <path
          key={i}
          d={D_PLATE}
          transform={`translate(${p.x} ${p.y}) rotate(${p.r}) scale(${p.s})`}
        />
      ))}
      <path d={D_LEG_NEAR_A} />
      <path d={D_LEG_NEAR_B} />
      <path d={D_NECK} />
      {D_NECK_PLATES.map((p, i) => (
        <path
          key={i}
          d={D_PLATE}
          transform={`translate(${p.x} ${p.y}) rotate(${p.r}) scale(${p.s})`}
        />
      ))}
      <path d={D_HEAD} />
    </g>
  );
}

/**
 * Fig. 1 — the full natural-history plate.
 * Halftone screen for mass, line hatching for volume, sepia on cream.
 */
export default function Datasaur({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 620 470"
      role="img"
      aria-label="Engraved plate of the Datasaur, a long-necked sauropod"
    >
      <defs>
        <clipPath id="dz-body">
          <path d={D_BODY} />
        </clipPath>
        <clipPath id="dz-neck">
          <path d={D_NECK} />
        </clipPath>
        <clipPath id="dz-head">
          <path d={D_HEAD} />
        </clipPath>
        <clipPath id="dz-tail">
          <path d={D_TAIL} />
        </clipPath>
        <clipPath id="dz-legfa">
          <path d={D_LEG_FAR_A} />
        </clipPath>
        <clipPath id="dz-legfb">
          <path d={D_LEG_FAR_B} />
        </clipPath>
        <clipPath id="dz-legna">
          <path d={D_LEG_NEAR_A} />
        </clipPath>
        <clipPath id="dz-legnb">
          <path d={D_LEG_NEAR_B} />
        </clipPath>
      </defs>

      <rect width="620" height="470" fill={PAPER} />

      {/* ————— far legs ————— */}
      {[
        [D_LEG_FAR_A, "dz-legfa"],
        [D_LEG_FAR_B, "dz-legfb"],
      ].map(([d, clip], i) => (
        <g key={i}>
          <path d={d} fill={PAPER} />
          <g clipPath={`url(#${clip})`}>
            <rect x="180" y="280" width="300" height="120" fill="url(#pz-ht-55)" />
            <rect x="180" y="280" width="300" height="120" fill="url(#pz-hatch-fine)" opacity="0.5" />
          </g>
          <path d={d} fill="none" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
        </g>
      ))}

      {/* ————— tail ————— */}
      <path d={D_TAIL} fill={PAPER} />
      <g clipPath="url(#dz-tail)">
        <rect x="430" y="140" width="190" height="150" fill="url(#pz-ht-15)" />
        <path d="M430 250C490 246 545 220 610 168L610 300L430 300Z" fill="url(#pz-ht-40)" />
        <path d="M430 262C490 258 545 234 610 184L610 300L430 300Z" fill="url(#pz-hatch-fine)" opacity="0.6" />
      </g>
      <path d={D_TAIL} fill="none" stroke={INK} strokeWidth="1.7" strokeLinejoin="round" />

      {/* ————— body ————— */}
      <path d={D_BODY} fill={PAPER} />
      <g clipPath="url(#dz-body)">
        <rect x="170" y="160" width="310" height="200" fill="url(#pz-ht-06)" />
        <path d="M160 246C250 232 400 232 480 254L480 400L160 400Z" fill="url(#pz-ht-25)" />
        <path d="M160 284C250 270 400 272 480 294L480 400L160 400Z" fill="url(#pz-ht-40)" />
        <path d="M160 314C255 302 400 304 480 326L480 400L160 400Z" fill="url(#pz-ht-70)" />
        <path d="M160 330C255 318 400 322 480 342L480 400L160 400Z" fill="url(#pz-hatch)" opacity="0.75" />
        {/* haunch — crosshatch turning the rear volume */}
        <circle cx="424" cy="272" r="54" fill="url(#pz-cross)" opacity="0.5" />
        {/* two contour lines describing the barrel of the ribcage */}
        <path
          d="M258 182C244 226 246 286 268 336"
          fill="none"
          stroke={INK}
          strokeWidth="0.9"
          opacity="0.3"
        />
        <path
          d="M300 172C286 220 288 288 308 344"
          fill="none"
          stroke={INK}
          strokeWidth="0.9"
          opacity="0.16"
        />
      </g>
      <path d={D_BODY} fill="none" stroke={INK} strokeWidth="1.9" strokeLinejoin="round" />

      {/* ————— dorsal plates ————— */}
      <Plates list={D_BACK_PLATES} tone="url(#pz-ht-40)" />

      {/* ————— near legs ————— */}
      {[
        [D_LEG_NEAR_A, "dz-legna"],
        [D_LEG_NEAR_B, "dz-legnb"],
      ].map(([d, clip], i) => (
        <g key={i}>
          <path d={d} fill={PAPER} />
          <g clipPath={`url(#${clip})`}>
            <rect x="180" y="300" width="300" height="120" fill="url(#pz-ht-15)" />
            <rect x="180" y="356" width="300" height="60" fill="url(#pz-ht-40)" />
            <rect x={i === 0 ? 240 : 402} y="300" width="24" height="120" fill="url(#pz-hatch)" opacity="0.6" />
          </g>
          <path d={d} fill="none" stroke={INK} strokeWidth="1.9" strokeLinejoin="round" />
        </g>
      ))}
      {/* toes */}
      <g fill="none" stroke={INK} strokeWidth="1.3">
        <path d="M212 380C220 372 228 372 236 380" />
        <path d="M236 380C244 372 250 372 258 380" />
        <path d="M374 380C382 372 390 372 398 380" />
        <path d="M398 380C406 372 412 372 420 380" />
      </g>

      {/* ————— neck ————— */}
      <path d={D_NECK} fill={PAPER} />
      <g clipPath="url(#dz-neck)">
        <rect x="100" y="100" width="170" height="150" fill="url(#pz-ht-15)" />
        <path d="M150 250C124 214 106 168 104 118L140 112C144 168 168 210 200 244Z" fill="url(#pz-ht-40)" />
        <rect x="100" y="100" width="170" height="150" fill="url(#pz-hatch-neck)" opacity="0.35" />
      </g>
      <path d={D_NECK} fill="none" stroke={INK} strokeWidth="1.9" strokeLinejoin="round" />
      <Plates list={D_NECK_PLATES} tone="url(#pz-ht-25)" />

      {/* ————— head ————— */}
      <path d={D_HEAD} fill={PAPER} />
      <g clipPath="url(#dz-head)">
        <rect x="30" y="50" width="145" height="90" fill="url(#pz-ht-06)" />
        <path d="M20 98C60 116 130 118 180 104L180 150L20 150Z" fill="url(#pz-ht-40)" />
        <path d="M20 112C60 128 130 130 180 118L180 150L20 150Z" fill="url(#pz-hatch-fine)" opacity="0.7" />
      </g>
      <path d={D_HEAD} fill="none" stroke={INK} strokeWidth="1.9" strokeLinejoin="round" />

      {/* face */}
      <g>
        <path d="M42 100C58 110 78 113 96 108" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
        <ellipse cx="46" cy="86" rx="4.5" ry="3.2" fill={INK} transform="rotate(-14 46 86)" />
        <circle cx="98" cy="83" r="10.5" fill={PAPER} stroke={INK} strokeWidth="1.5" />
        <circle cx="98" cy="83" r="6" fill={INK} />
        <circle cx="95" cy="80" r="2.1" fill={PAPER} />
        <path d="M84 68C92 62 106 62 114 68" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        {/* cheek hatch */}
        <path d="M120 96C128 100 138 101 148 99" fill="none" stroke={INK} strokeWidth="0.8" opacity="0.5" />
        <path d="M122 104C130 108 140 109 150 107" fill="none" stroke={INK} strokeWidth="0.8" opacity="0.4" />
      </g>

      {/* ————— ground ————— */}
      <g>
        <path d="M92 392C210 386 430 386 546 393" fill="none" stroke={INK} strokeWidth="1.2" />
        <g stroke="#8B6B3C" strokeWidth="0.9" opacity="0.8">
          {Array.from({ length: 34 }).map((_, i) => {
            const x = 96 + i * 13.4;
            const h = 5 + ((i * 7) % 9);
            return <line key={i} x1={x} y1={394} x2={x - 5} y2={394 + h} />;
          })}
        </g>
        {/* tufts */}
        <g fill="none" stroke={INK} strokeWidth="1.1">
          <path d="M120 391C118 382 114 376 108 372" />
          <path d="M124 391C126 382 130 377 137 374" />
          <path d="M126 391C127 384 125 378 122 373" />
          <path d="M498 392C496 383 492 377 486 373" />
          <path d="M502 392C504 384 509 379 516 376" />
        </g>
      </g>

      {/* ————— foliage ————— */}
      <Frond x={42} y={396} scale={0.62} rotate={-16} blades={11} width={1.7} />
      <Frond x={96} y={398} scale={0.4} rotate={12} blades={9} width={1.5} />
      <Frond x={578} y={396} scale={0.5} rotate={14} blades={10} width={1.6} />

      {/* ————— scale bar + plate number ————— */}
      <g transform="translate(430 424)">
        <line x1="0" y1="10" x2="120" y2="10" stroke={INK} strokeWidth="1" />
        <rect x="0" y="6" width="30" height="8" fill={INK} />
        <rect x="60" y="6" width="30" height="8" fill={INK} />
        <rect x="0" y="6" width="120" height="8" fill="none" stroke={INK} strokeWidth="1" />
        <text x="0" y="32" className="dz-tick">0</text>
        <text x="56" y="32" className="dz-tick">5</text>
        <text x="110" y="32" className="dz-tick">10 m</text>
      </g>
      <text x="34" y="446" className="dz-note">
        drawn from life, ex coll. DS3
      </text>

      {/* press grain */}
      <rect
        width="620"
        height="470"
        filter="url(#pz-grain)"
        opacity="0.16"
        style={{ mixBlendMode: "multiply" }}
      />
    </svg>
  );
}
