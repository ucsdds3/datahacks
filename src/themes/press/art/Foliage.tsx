/**
 * A cycad frond: curved rachis with leaflets set at a constant angle to it,
 * tapering toward the tip. Drawn upright from its base in local space, then
 * placed with translate/rotate/scale. Shared by the hero landscape and the
 * Fig. 1 plate so the plant life matches across the page.
 */
export default function Frond({
  x,
  y,
  scale = 1,
  rotate = 0,
  blades = 12,
  stroke = "#141210",
  width = 2.4,
}: {
  x: number;
  y: number;
  scale?: number;
  rotate?: number;
  blades?: number;
  stroke?: string;
  width?: number;
}) {
  const p = (t: number) => ({ x: 16 * t * t - 2 * t, y: -156 * t });
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path d="M0 0C-2 -54 4 -108 14 -156" fill="none" stroke={stroke} strokeWidth={width * 1.4} />
      {Array.from({ length: blades }).map((_, i) => {
        const t = 0.06 + (i / (blades - 1)) * 0.92;
        const { x: px, y: py } = p(t);
        const len = 54 * (1 - 0.7 * t);
        return (
          <g key={i} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round">
            <path
              d={`M${px} ${py}Q${px - len * 0.66} ${py - len * 0.08} ${px - len} ${py - len * 0.34}`}
            />
            <path
              d={`M${px} ${py}Q${px + len * 0.66} ${py - len * 0.08} ${px + len} ${py - len * 0.34}`}
            />
          </g>
        );
      })}
    </g>
  );
}
