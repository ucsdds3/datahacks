import { INK, MARIGOLD, MINT, PINK, SKY, TOMATO } from "./palette";

/**
 * The schedule section's Rube-Goldberg "data pipeline": hopper, gears, valve,
 * bellows tube, holding tank, paddle wheel, chute, trophy. Line art only —
 * no fill anywhere except the six coloured data pellets travelling through it.
 */

const W = 3.5;

function Gear({ cx, cy, r, teeth = 10 }: { cx: number; cy: number; r: number; teeth?: number }) {
  const spikes = Array.from({ length: teeth }, (_, i) => (i * 360) / teeth);
  return (
    <g>
      {spikes.map((a) => (
        <line
          key={a}
          x1={cx}
          y1={cy - r}
          x2={cx}
          y2={cy - r - 11}
          transform={`rotate(${a} ${cx} ${cy})`}
        />
      ))}
      <circle cx={cx} cy={cy} r={r} />
      <circle cx={cx} cy={cy} r={r * 0.3} />
      <line x1={cx - r * 0.72} y1={cy} x2={cx + r * 0.72} y2={cy} />
      <line
        x1={cx - r * 0.72}
        y1={cy}
        x2={cx + r * 0.72}
        y2={cy}
        transform={`rotate(90 ${cx} ${cy})`}
      />
    </g>
  );
}

export function DataPipeline({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1400 300"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g
        stroke={INK}
        strokeWidth={W}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* --- 1 · hopper, raw data going in --- */}
        <circle cx={52} cy={20} r={7} fill={TOMATO} />
        <circle cx={84} cy={8} r={5} fill={SKY} />
        <circle cx={110} cy={24} r={6} fill={MINT} />
        <path d="M 26 46 L 140 46 L 104 108 L 62 108 Z" />
        <path d="M 40 46 L 40 30 M 126 46 L 126 30" />
        <path d="M 62 108 L 62 130 L 104 130 L 104 108" />
        <path d="M 83 130 L 83 168" />

        {/* --- 2 · first horizontal run --- */}
        <path d="M 83 168 C 83 190 100 196 128 196 L 236 196" />
        <path d="M 128 182 L 128 210 M 176 182 L 176 210" />

        {/* --- 3 · gear cluster --- */}
        <Gear cx={286} cy={196} r={44} teeth={12} />
        <Gear cx={372} cy={150} r={26} teeth={9} />
        <path d="M 330 196 L 400 196" />
        <path d="M 372 176 L 372 196" />

        {/* --- 4 · rise, elbow and valve --- */}
        <path d="M 400 196 C 434 196 442 178 442 152 L 442 108 C 442 84 456 74 484 74 L 560 74" />
        <path d="M 424 132 L 460 132" />
        <circle cx={600} cy={74} r={30} />
        <path d="M 570 74 L 630 74" />
        <path d="M 600 44 L 600 20 M 584 20 L 616 20" />
        <path d="M 630 74 L 686 74" />
        <circle cx={600} cy={74} r={11} fill={MARIGOLD} />

        {/* --- 5 · bellows tube --- */}
        <path d="M 686 56 L 700 92 L 714 56 L 728 92 L 742 56 L 756 92 L 770 56 L 784 92 L 798 56" />
        <path d="M 686 74 L 686 56 M 798 56 L 812 56" />
        <path d="M 798 74 C 812 74 820 84 820 104 L 820 128" />

        {/* --- 6 · holding tank --- */}
        <rect x={758} y={128} width={128} height={104} rx={18} />
        <path d="M 758 194 C 786 178 812 210 842 194 C 862 184 876 190 886 198" />
        <path d="M 806 128 L 806 108 L 838 108 L 838 128" />
        <circle cx={822} cy={98} r={13} />
        <path d="M 822 98 L 830 90" />
        <path d="M 886 176 L 950 176" />

        {/* --- 7 · paddle wheel --- */}
        <circle cx={1006} cy={176} r={50} />
        <path d="M 1006 126 L 1006 226 M 956 176 L 1056 176" />
        <path d="M 971 141 L 1041 211 M 1041 141 L 971 211" />
        <circle cx={1006} cy={176} r={9} fill={PINK} />
        <path d="M 950 176 L 956 176" />

        {/* --- 8 · exit chute, pouring into the trophy --- */}
        <path d="M 1056 176 C 1122 176 1158 156 1158 116 C 1158 88 1178 74 1212 74 L 1268 74" />
        <path d="M 1268 62 C 1288 62 1298 70 1298 90" />
        <path d="M 1268 86 L 1290 86" />
        <circle cx={1290} cy={110} r={7} fill={MINT} />

        {/* trophy / shipped project */}
        <path d="M 1236 128 L 1330 128 C 1330 186 1308 214 1283 214 C 1258 214 1236 186 1236 128 Z" />
        <path d="M 1236 142 C 1210 142 1206 178 1232 186" />
        <path d="M 1330 142 C 1356 142 1360 178 1334 186" />
        <path d="M 1283 214 L 1283 244 M 1252 258 L 1314 258 C 1314 248 1306 244 1283 244 C 1260 244 1252 248 1252 258 Z" />
        <path
          d="M 1283 148 C 1288 168 1292 172 1312 177 C 1292 182 1288 186 1283 206 C 1278 186 1274 182 1254 177 C 1274 172 1278 168 1283 148 Z"
          fill={MARIGOLD}
        />
      </g>
    </svg>
  );
}

/** Small pipe-and-valve connector used beside each timeline beat. */
export function BeatValve({ className, colour = MARIGOLD }: { className?: string; colour?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
      <g stroke={INK} strokeWidth={3.5} strokeLinecap="round">
        <circle cx={24} cy={24} r={15} fill={colour} />
        <path d="M 24 9 L 24 2 M 9 24 L 2 24 M 39 24 L 46 24 M 24 39 L 24 46" />
      </g>
    </svg>
  );
}
