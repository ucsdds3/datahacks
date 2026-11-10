import { useState } from "react";
import { niceMax, useWidth } from "./chart";
import type { Day } from "./stats";

/**
 * Applications submitted per day (bars, left axis) and the running total
 * (line, right axis), drawn like the check-in arrivals chart (ArrivalsChart)
 * and styled by the same classes. A dashed line marks the end of the
 * priority batch. Hovering or tapping a day shows its numbers above the chart.
 */

const HEIGHT = 200;
const M = { top: 18, right: 44, bottom: 26, left: 34 };

/** Days are Pacific calendar dates stored at 00:00 UTC, so they're labelled in UTC. */
const dateLabel = (t: number, weekday = false) =>
  new Date(t).toLocaleDateString(undefined, { ...(weekday ? { weekday: "short" } : {}), month: "short", day: "numeric", timeZone: "UTC" });

export default function DailyChart({ days, markDay, markLabel }: { days: Day[]; markDay?: string; markLabel?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  if (days.length === 0) return <div className="og-ci-chart" ref={ref}><p className="og-empty">No applications submitted yet.</p></div>;

  const shown = active !== null && active < days.length ? active : days.length - 1;
  const d = days[shown];
  const total = days[days.length - 1].cumulative;
  const peak = days.reduce((best, x) => (x.count > best.count ? x : best), days[0]);

  const innerW = Math.max(width - M.left - M.right, 10);
  const innerH = HEIGHT - M.top - M.bottom;
  const slot = innerW / days.length;
  const barW = Math.max(Math.min(slot * 0.72, 28), 1);
  const leftMax = niceMax(peak.count);
  const rightMax = niceMax(total);
  const y = (v: number, max: number) => M.top + innerH - (v / max) * innerH;
  const x = (i: number) => M.left + i * slot + slot / 2;
  const labelEvery = Math.max(1, Math.ceil(56 / slot));
  const line = days.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.cumulative, rightMax).toFixed(1)}`).join(" ");
  const mark = markDay ? days.findIndex(p => p.day === markDay) : -1;
  // After the marked day: the line sits between it and the next.
  const markX = mark >= 0 ? M.left + (mark + 1) * slot : null;

  const pick = (clientX: number, svg: SVGSVGElement) => {
    const left = svg.getBoundingClientRect().left;
    const i = Math.floor((clientX - left - M.left) / slot);
    setActive(Math.max(0, Math.min(days.length - 1, i)));
  };

  return (
    <div className="og-ci-chart" ref={ref}>
      <p className="og-ci-readout">
        <strong>{dateLabel(d.start, true)}</strong>
        <span><span className="og-ci-swatch bars" aria-hidden /> {d.count} submitted</span>
        <span><span className="og-ci-swatch line" aria-hidden /> {d.cumulative} total by then</span>
      </p>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Hacker applications per day from ${dateLabel(days[0].start)} to ${dateLabel(days[days.length - 1].start)}: ${total} in all, busiest ${dateLabel(peak.start)} with ${peak.count}.`}
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
          {markX !== null && (
            <g>
              <line className="og-st-mark" x1={markX} x2={markX} y1={M.top - 6} y2={M.top + innerH} />
              {markLabel && (
                // Left of the line, unless that would run off the chart.
                <text className="og-st-mark-label" x={markX < 120 ? markX + 4 : markX - 4} y={M.top - 8} textAnchor={markX < 120 ? "start" : "end"}>{markLabel}</text>
              )}
            </g>
          )}
          {days.map((p, i) => (
            <rect
              key={p.day}
              className={`og-ci-bar${i === shown ? " active" : ""}`}
              x={x(i) - barW / 2}
              y={y(p.count, leftMax)}
              width={barW}
              height={Math.max(innerH - (y(p.count, leftMax) - M.top), 0)}
            />
          ))}
          <path className="og-ci-line" d={line} />
          <circle className="og-ci-dot" cx={x(shown)} cy={y(d.cumulative, rightMax)} r={4} />
          {days.map((p, i) => (i % labelEvery === 0 ? (
            <text key={p.day} className="og-ci-axis" x={x(i)} y={HEIGHT - 6} textAnchor="middle">{dateLabel(p.start)}</text>
          ) : null))}
        </svg>
      )}
      <p className="og-hint">
        Bars: hacker applications submitted each day, Pacific time (left). Line: total so far (right). Busiest: {dateLabel(peak.start)} with {peak.count}.
      </p>
      <details className="og-ci-table-toggle">
        <summary>Show as a table</summary>
        <div className="sp-table-wrap">
          <table className="sp-table og-ci-plain">
            <thead><tr><th>Day</th><th>Submitted</th><th>Total</th></tr></thead>
            <tbody>
              {days.filter(p => p.count > 0).map(p => (
                <tr key={p.day}><td>{dateLabel(p.start, true)}</td><td>{p.count}</td><td>{p.cumulative}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
