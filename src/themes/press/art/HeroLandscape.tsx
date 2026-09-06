import { DatasaurSilhouette } from "./Datasaur";
import Frond from "./Foliage";

const INK = "#141210";
const SEPIA = "#B08D5F";
const SEPIA_DEEP = "#8B6B3C";

/** ground of the mascot's local box sits at y = 388 */
const stand = (x: number, groundY: number, s: number) =>
  `translate(${x} ${groundY - 388 * s}) scale(${s})`;

/**
 * The hero's stand-in for the reference's vintage photograph:
 * a screened natural-history landscape — hatched sky, three tonal ridges,
 * a distant herd of datasaurs and engraved foreground foliage.
 */
export default function HeroLandscape({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1440 640"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      {/* sky */}
      <rect width="1440" height="640" fill="#F5E9C8" />
      <rect y="120" width="1440" height="140" fill="url(#pz-sky-fine)" opacity="0.28" />
      <rect y="240" width="1440" height="80" fill="url(#pz-sky-fine)" opacity="0.5" />
      <rect y="300" width="1440" height="70" fill="url(#pz-sky)" opacity="0.5" />

      {/* sun */}
      <g>
        <circle cx="1136" cy="196" r="112" fill="#F5E9C8" />
        <circle cx="1136" cy="196" r="112" fill="url(#pz-ht-06)" />
        <circle cx="1136" cy="196" r="112" fill="none" stroke={SEPIA_DEEP} strokeWidth="1.6" />
        <circle cx="1136" cy="196" r="96" fill="none" stroke={SEPIA} strokeWidth="0.9" />
        {Array.from({ length: 48 }).map((_, i) => {
          const a = (i / 48) * Math.PI * 2;
          const r1 = 118;
          const r2 = 118 + (i % 3 === 0 ? 34 : i % 2 === 0 ? 22 : 13);
          return (
            <line
              key={i}
              x1={1136 + Math.cos(a) * r1}
              y1={196 + Math.sin(a) * r1}
              x2={1136 + Math.cos(a) * r2}
              y2={196 + Math.sin(a) * r2}
              stroke={SEPIA}
              strokeWidth="1.1"
            />
          );
        })}
      </g>

      {/* engraved cloud band, kept clear of the headline */}
      <g opacity="0.9">
        <path
          d="M604 108C628 90 664 92 680 108C706 90 750 98 756 122C784 122 790 146 764 150L616 150C592 146 588 118 604 108Z"
          fill="#F5E9C8"
          stroke={SEPIA}
          strokeWidth="1.2"
        />
        <path
          d="M604 108C628 90 664 92 680 108C706 90 750 98 756 122C784 122 790 146 764 150L616 150C592 146 588 118 604 108Z"
          fill="url(#pz-sky-fine)"
          opacity="0.7"
        />
      </g>

      {/* birds */}
      <g fill="none" stroke={SEPIA_DEEP} strokeWidth="1.6" strokeLinecap="round">
        <path d="M876 150C884 142 890 142 897 149C904 142 910 142 918 150" />
        <path d="M948 118C954 112 959 112 964 118C969 112 974 112 980 118" />
        <path d="M840 196C845 190 850 190 855 196C860 190 865 190 870 196" />
      </g>

      {/* far ridge */}
      <g>
        <path
          d="M0 372C180 344 320 356 470 340C620 324 760 352 900 336C1040 320 1200 344 1440 322L1440 640L0 640Z"
          fill="#F5E9C8"
        />
        <path
          d="M0 372C180 344 320 356 470 340C620 324 760 352 900 336C1040 320 1200 344 1440 322L1440 640L0 640Z"
          fill="url(#pz-ht-15)"
        />
        <path
          d="M0 372C180 344 320 356 470 340C620 324 760 352 900 336C1040 320 1200 344 1440 322"
          fill="none"
          stroke={SEPIA_DEEP}
          strokeWidth="1.5"
        />
      </g>

      {/* distant herd, kept to the right of the headline */}
      <g transform={stand(1264, 336, 0.1)}>
        <DatasaurSilhouette fill={SEPIA_DEEP} />
      </g>
      <g transform={stand(1364, 332, 0.072)}>
        <DatasaurSilhouette fill={SEPIA_DEEP} opacity={0.8} />
      </g>

      {/* mid ridge */}
      <g>
        <path
          d="M0 432C200 406 380 424 560 404C740 384 900 418 1080 400C1240 384 1340 400 1440 392L1440 640L0 640Z"
          fill="#F5E9C8"
        />
        <path
          d="M0 432C200 406 380 424 560 404C740 384 900 418 1080 400C1240 384 1340 400 1440 392L1440 640L0 640Z"
          fill="url(#pz-ht-25)"
        />
        <path
          d="M0 432C200 406 380 424 560 404C740 384 900 418 1080 400C1240 384 1340 400 1440 392"
          fill="none"
          stroke={SEPIA_DEEP}
          strokeWidth="1.6"
        />
      </g>

      {/* near ridge */}
      <g>
        <path
          d="M0 522C240 488 420 514 640 498C860 482 1060 514 1240 496C1330 488 1390 496 1440 492L1440 640L0 640Z"
          fill="#F5E9C8"
        />
        <path
          d="M0 522C240 488 420 514 640 498C860 482 1060 514 1240 496C1330 488 1390 496 1440 492L1440 640L0 640Z"
          fill="url(#pz-ht-40)"
        />
        <path
          d="M0 566C240 532 420 558 640 542C860 526 1060 558 1240 540C1330 532 1390 540 1440 536L1440 640L0 640Z"
          fill="url(#pz-cross)"
          opacity="0.4"
        />
        <path
          d="M0 522C240 488 420 514 640 498C860 482 1060 514 1240 496C1330 488 1390 496 1440 492"
          fill="none"
          stroke={INK}
          strokeWidth="1.7"
        />
      </g>

      {/* the near animal — the one figure large enough to read */}
      <g transform={stand(1128, 508, 0.3)}>
        <DatasaurSilhouette fill={INK} opacity={0.9} />
      </g>

      {/* foreground foliage */}
      <Frond x={64} y={664} scale={1.15} rotate={-14} blades={13} />
      <Frond x={182} y={676} scale={0.82} rotate={17} blades={11} />
      <Frond x={1398} y={656} scale={1.2} rotate={15} blades={13} />
      <Frond x={1290} y={678} scale={0.76} rotate={-17} blades={11} />

      <rect
        width="1440"
        height="640"
        filter="url(#pz-grain)"
        opacity="0.2"
        style={{ mixBlendMode: "multiply" }}
      />
    </svg>
  );
}
