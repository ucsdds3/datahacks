import { useState } from "react";
import type { Bucket } from "./checkin";
import { niceMax, useWidth } from "./chart";

/**
 * Check-ins per time bucket (bars, left axis) and the running total (line,
 * right axis), in plain SVG sized to its box so labels stay readable on a
 * phone. Hovering or tapping a bar shows its numbers above the chart; the
 * same numbers are in a table under "Show as a table".
 */

const HEIGHT = 200;
const M = { top: 12, right: 40, bottom: 26, left: 34 };

const clock = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export default function ArrivalsChart({ buckets, minutes }: { buckets: Bucket[]; minutes: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const size = minutes * 60_000;

  if (buckets.length === 0) return <div className="og-ci-chart" ref={ref}><p className="og-empty">Nobody has checked in yet.</p></div>;

  const shown = active !== null && active < buckets.length ? active : buckets.length - 1;
  const b = buckets[shown];
  const total = buckets[buckets.length - 1].cumulative;
  const peak = buckets.reduce((best, x) => (x.count > best.count ? x : best), buckets[0]);

  const innerW = Math.max(width - M.left - M.right, 10);
  const innerH = HEIGHT - M.top - M.bottom;
  const slot = innerW / buckets.length;
  const barW = Math.max(Math.min(slot * 0.72, 28), 1);
  const leftMax = niceMax(peak.count);
  const rightMax = niceMax(total);
  const y = (v: number, max: number) => M.top + innerH - (v / max) * innerH;
  const x = (i: number) => M.left + i * slot + slot / 2;
  const labelEvery = Math.max(1, Math.ceil(52 / slot));
  const line = buckets.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.cumulative, rightMax).toFixed(1)}`).join(" ");

  const pick = (clientX: number, svg: SVGSVGElement) => {
    const left = svg.getBoundingClientRect().left;
    const i = Math.floor((clientX - left - M.left) / slot);
    setActive(Math.max(0, Math.min(buckets.length - 1, i)));
  };

  return (
    <div className="og-ci-chart" ref={ref}>
      <p className="og-ci-readout">
        <strong>{clock(b.start)}–{clock(b.start + size)}</strong>
        <span><span className="og-ci-swatch bars" aria-hidden /> {b.count} checked in</span>
        <span><span className="og-ci-swatch line" aria-hidden /> {b.cumulative} total by then</span>
      </p>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Check-ins per ${minutes} minutes from ${clock(buckets[0].start)} to ${clock(buckets[buckets.length - 1].start + size)}: ${total} in all, busiest ${clock(peak.start)} with ${peak.count}.`}
          onPointerMove={e => pick(e.clientX, e.currentTarget)}
          onPointerDown={e => pick(e.clientX, e.currentTarget)}
          onPointerLeave={e => { if (e.pointerType === "mouse") setActive(null); }}
        >
          {[0, 0.5, 1].map(f => (
            <g key={f}>
              <line className="og-ci-gridline" x1={M.left} x2={M.left + innerW} y1={y(f, 1)} y2={y(f, 1)} />
              <text className="og-ci-axis" x={M.left - 6} y={y(f, 1) + 4} textAnchor="end">{Math.round(leftMax * f)}</text>
              <text className="og-ci-axis line" x={M.left + innerW + 6} y={y(f, 1) + 4}>{Math.round(rightMax * f)}</text>
            </g>
          ))}
          {buckets.map((d, i) => (
            <rect
              key={d.start}
              className={`og-ci-bar${i === shown ? " active" : ""}`}
              x={x(i) - barW / 2}
              y={y(d.count, leftMax)}
              width={barW}
              height={Math.max(innerH - (y(d.count, leftMax) - M.top), 0)}
            />
          ))}
          <path className="og-ci-line" d={line} />
          <circle className="og-ci-dot" cx={x(shown)} cy={y(b.cumulative, rightMax)} r={4} />
          {buckets.map((d, i) => (i % labelEvery === 0 ? (
            <text key={d.start} className="og-ci-axis" x={x(i)} y={HEIGHT - 6} textAnchor="middle">{clock(d.start).replace(/\s?[AP]M$/i, "")}</text>
          ) : null))}
        </svg>
      )}
      <p className="og-hint">
        Bars: check-ins per {minutes} minutes (left). Line: total so far (right). Busiest: {clock(peak.start)} with {peak.count}.
      </p>
      <details className="og-ci-table-toggle">
        <summary>Show as a table</summary>
        <div className="sp-table-wrap">
          <table className="sp-table og-ci-plain">
            <thead><tr><th>From</th><th>Checked in</th><th>Total</th></tr></thead>
            <tbody>
              {buckets.filter(d => d.count > 0).map(d => (
                <tr key={d.start}><td>{clock(d.start)}</td><td>{d.count}</td><td>{d.cumulative}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
