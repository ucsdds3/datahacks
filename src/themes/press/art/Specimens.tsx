const INK = "#141210";
const SEPIA = "#B08D5F";
const SEPIA_DEEP = "#8B6B3C";
const PAPER = "#FBF4DE";

type PlateProps = { className?: string };

const box = (className?: string) => ({
  className,
  viewBox: "0 0 240 210",
  role: "img" as const,
  focusable: "false" as const,
});

/** Fig. 2 — an aneroid dial. */
export function PlateDial({ className }: PlateProps) {
  return (
    <svg {...box(className)} aria-label="Engraved plate of a dial instrument">
      <defs>
        <clipPath id="sp-dial">
          <circle cx="120" cy="92" r="62" />
        </clipPath>
      </defs>
      <circle cx="120" cy="92" r="62" fill={PAPER} />
      <g clipPath="url(#sp-dial)">
        <circle cx="120" cy="92" r="62" fill="url(#pz-ht-06)" />
        <path d="M50 108C86 98 156 98 190 110L190 170L50 170Z" fill="url(#pz-ht-40)" />
        <path d="M50 128C86 118 156 118 190 130L190 170L50 170Z" fill="url(#pz-hatch-fine)" opacity="0.6" />
      </g>
      <circle cx="120" cy="92" r="62" fill="none" stroke={INK} strokeWidth="2" />
      <circle cx="120" cy="92" r="52" fill="none" stroke={SEPIA_DEEP} strokeWidth="0.9" />
      {Array.from({ length: 48 }).map((_, i) => {
        const a = (i / 48) * Math.PI * 2 - Math.PI / 2;
        const long = i % 4 === 0;
        const r1 = long ? 40 : 46;
        return (
          <line
            key={i}
            x1={120 + Math.cos(a) * r1}
            y1={92 + Math.sin(a) * r1}
            x2={120 + Math.cos(a) * 52}
            y2={92 + Math.sin(a) * 52}
            stroke={INK}
            strokeWidth={long ? 1.5 : 0.8}
          />
        );
      })}
      <path d="M120 92L112 84L146 52L124 92Z" fill={INK} />
      <path d="M120 92L126 98L100 118L116 92Z" fill={SEPIA_DEEP} />
      <circle cx="120" cy="92" r="7" fill={PAPER} stroke={INK} strokeWidth="1.8" />
      <circle cx="120" cy="92" r="2.4" fill={INK} />
      {/* plinth */}
      <path d="M92 152L148 152L156 178L84 178Z" fill={PAPER} stroke={INK} strokeWidth="1.8" />
      <path d="M92 152L148 152L156 178L84 178Z" fill="url(#pz-hatch)" opacity="0.5" />
      <line x1="70" y1="180" x2="170" y2="180" stroke={INK} strokeWidth="1.4" />
      <g stroke={SEPIA_DEEP} strokeWidth="0.9">
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={i} x1={72 + i * 8.6} y1={182} x2={68 + i * 8.6} y2={190} />
        ))}
      </g>
    </svg>
  );
}

/** Fig. 3 — a stack of punched ledger cards. */
export function PlateCards({ className }: PlateProps) {
  const card = "M30 118L138 78L214 108L104 150Z";
  return (
    <svg {...box(className)} aria-label="Engraved plate of punched ledger cards">
      <defs>
        <clipPath id="sp-card">
          <path d={card} />
        </clipPath>
      </defs>
      {[36, 22, 8].map((dy, i) => (
        <g key={i} transform={`translate(0 ${dy})`}>
          <path d={card} fill={PAPER} stroke={INK} strokeWidth="1.7" strokeLinejoin="round" />
          <path
            d="M30 118L104 150L104 162L30 130Z"
            fill="url(#pz-ht-55)"
            stroke={INK}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M104 150L214 108L214 120L104 162Z"
            fill="url(#pz-ht-25)"
            stroke={INK}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </g>
      ))}
      <g clipPath="url(#sp-card)" transform="translate(0 8)">
        <path d={card} fill="url(#pz-ht-06)" />
        {Array.from({ length: 5 }).map((_, r) =>
          Array.from({ length: 8 }).map((_, c) => {
            const u = 0.1 + c * 0.104;
            const v = 0.16 + r * 0.17;
            const x = 30 + u * 184 + v * 74;
            const y = 118 - u * 40 + v * 32;
            const on = (r * 3 + c * 5) % 4 !== 0;
            return (
              <ellipse
                key={`${r}-${c}`}
                cx={x}
                cy={y}
                rx="5"
                ry="2.4"
                transform={`rotate(-20 ${x} ${y})`}
                fill={on ? INK : "none"}
                stroke={INK}
                strokeWidth="0.9"
              />
            );
          }),
        )}
      </g>
      <line x1="26" y1="196" x2="218" y2="196" stroke={INK} strokeWidth="1.4" />
      <g stroke={SEPIA_DEEP} strokeWidth="0.9">
        {Array.from({ length: 18 }).map((_, i) => (
          <line key={i} x1={28 + i * 10.6} y1={198} x2={24 + i * 10.6} y2={205} />
        ))}
      </g>
    </svg>
  );
}

/** Fig. 4 — a faceted mineral specimen. */
export function PlateCrystal({ className }: PlateProps) {
  return (
    <svg {...box(className)} aria-label="Engraved plate of a faceted mineral">
      <path d="M120 20L64 78L88 158L154 160L182 74Z" fill={PAPER} />
      <path d="M120 20L64 78L88 158L120 150Z" fill="url(#pz-ht-15)" />
      <path d="M120 20L120 150L154 160L182 74Z" fill="url(#pz-ht-55)" />
      <path d="M120 20L120 150L154 160L182 74Z" fill="url(#pz-hatch-fine)" opacity="0.45" />
      <path d="M120 20L64 78L88 158L154 160L182 74Z" fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M120 20L120 150" stroke={INK} strokeWidth="1.5" />
      <path d="M64 78L120 96L182 74" fill="none" stroke={INK} strokeWidth="1.2" />
      <path d="M88 158L120 150L154 160" fill="none" stroke={INK} strokeWidth="1.2" />
      {/* highlight facet left blank on purpose */}
      <path d="M120 20L64 78L120 96Z" fill={PAPER} stroke={INK} strokeWidth="1.2" />
      {/* sparkles */}
      <g stroke={INK} strokeWidth="1.4" strokeLinecap="round">
        <path d="M196 40L196 62M185 51L207 51" />
        <path d="M48 118L48 132M41 125L55 125" />
      </g>
      <ellipse cx="120" cy="172" rx="74" ry="12" fill="none" stroke={INK} strokeWidth="1.3" />
      <ellipse cx="120" cy="172" rx="74" ry="12" fill="url(#pz-hatch)" opacity="0.4" />
      <line x1="30" y1="192" x2="210" y2="192" stroke={INK} strokeWidth="1.4" />
      <g stroke={SEPIA_DEEP} strokeWidth="0.9">
        {Array.from({ length: 17 }).map((_, i) => (
          <line key={i} x1={32 + i * 10.6} y1={194} x2={28 + i * 10.6} y2={201} />
        ))}
      </g>
    </svg>
  );
}

/** Fig. 5 — a cutting under glass. */
export function PlateJar({ className }: PlateProps) {
  const jar = "M74 66L166 66L162 168C162 178 152 184 120 184C88 184 78 178 78 168Z";
  return (
    <svg {...box(className)} aria-label="Engraved plate of a cutting kept under glass">
      <defs>
        <clipPath id="sp-jar">
          <path d={jar} />
        </clipPath>
      </defs>
      <path d={jar} fill={PAPER} />
      <g clipPath="url(#sp-jar)">
        <rect x="70" y="110" width="100" height="90" fill="url(#pz-ht-25)" />
        <rect x="70" y="150" width="100" height="60" fill="url(#pz-ht-55)" />
        <rect x="70" y="60" width="18" height="150" fill="url(#pz-hatch-fine)" opacity="0.5" />
        <rect x="150" y="60" width="22" height="150" fill="url(#pz-hatch-fine)" opacity="0.35" />
        <path d="M70 110L170 110" stroke={SEPIA_DEEP} strokeWidth="1.2" />
      </g>
      {/* the cutting */}
      <g fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round">
        <path d="M120 176C118 140 116 106 122 74" />
        <path d="M121 138C104 136 92 124 90 108C108 108 120 118 122 134" />
        <path d="M122 112C138 108 148 96 148 82C132 84 122 94 121 108" />
        <path d="M122 88C112 80 108 68 110 56C122 62 126 74 124 86" />
      </g>
      <path d="M121 138C104 136 92 124 90 108C108 108 120 118 122 134" fill="url(#pz-ht-25)" />
      <path d="M122 112C138 108 148 96 148 82C132 84 122 94 121 108" fill="url(#pz-ht-40)" />
      <path d={jar} fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M66 54L174 54L174 66L66 66Z" fill={PAPER} stroke={INK} strokeWidth="2" />
      <path d="M66 54L174 54L174 66L66 66Z" fill="url(#pz-hatch)" opacity="0.45" />
      {/* label */}
      <path d="M92 148L148 148L148 168L92 168Z" fill={PAPER} stroke={INK} strokeWidth="1.4" />
      <g stroke={SEPIA_DEEP} strokeWidth="1.5">
        <line x1="100" y1="155" x2="140" y2="155" />
        <line x1="100" y1="161" x2="128" y2="161" />
      </g>
      <line x1="46" y1="192" x2="194" y2="192" stroke={INK} strokeWidth="1.4" />
      <g stroke={SEPIA_DEEP} strokeWidth="0.9">
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={i} x1={48 + i * 10.6} y1={194} x2={44 + i * 10.6} y2={201} />
        ))}
      </g>
    </svg>
  );
}

/** Engraved rosette for the prize block. */
export function Rosette({ className }: PlateProps) {
  return (
    <svg className={className} viewBox="0 0 200 260" aria-hidden="true" focusable="false">
      {/* ribbons */}
      <path d="M74 132L58 246L100 218L142 246L126 132Z" fill={PAPER} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M74 132L58 246L100 218L100 132Z" fill="url(#pz-ht-40)" />
      <path d="M100 132L100 218L142 246L126 132Z" fill="url(#pz-ht-15)" />
      {/* medal */}
      {Array.from({ length: 20 }).map((_, i) => {
        const a = (i / 20) * Math.PI * 2;
        return (
          <ellipse
            key={i}
            cx={100 + Math.cos(a) * 62}
            cy={100 + Math.sin(a) * 62}
            rx="16"
            ry="10"
            transform={`rotate(${(i / 20) * 360} ${100 + Math.cos(a) * 62} ${100 + Math.sin(a) * 62})`}
            fill={PAPER}
            stroke={INK}
            strokeWidth="1.5"
          />
        );
      })}
      <circle cx="100" cy="100" r="62" fill={PAPER} stroke={INK} strokeWidth="2" />
      <circle cx="100" cy="100" r="62" fill="url(#pz-ht-15)" />
      <circle cx="100" cy="100" r="50" fill={PAPER} stroke={INK} strokeWidth="1.4" />
      <circle cx="100" cy="100" r="50" fill="url(#pz-hatch-fine)" opacity="0.35" />
      <circle cx="100" cy="100" r="40" fill={PAPER} stroke={INK} strokeWidth="1" />
      <text x="100" y="118" textAnchor="middle" className="pz-rosette-num">
        I
      </text>
    </svg>
  );
}

/** A manicule — the classic printer's pointing hand. */
export function Manicule({ className }: PlateProps) {
  return (
    <svg className={className} viewBox="0 0 48 32" aria-hidden="true" focusable="false">
      <path
        d="M2 18C8 18 12 17 16 15C12 15 9 14 9 11C9 9 11 8 15 8L28 8C25 6 24 4 26 3C27 2 30 3 33 5C38 8 44 12 46 16C44 21 38 26 32 28C26 30 18 30 12 28C7 26 3 22 2 18Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M18 20C24 20 30 20 36 19" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M20 24C25 24 30 24 34 23" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export const TRACK_PLATES = [PlateDial, PlateCards, PlateCrystal, PlateJar];

export { SEPIA, SEPIA_DEEP };
