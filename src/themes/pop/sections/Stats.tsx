import React from "react";
import { C, Shade } from "../art/iso";
import { Person } from "../art/Props";
import { Rise } from "../motion";

const STATS: Array<{ n: string; label: string; long?: boolean }> = [
  { n: "XXX", label: "hackers" },
  { n: "XXX", label: "projects shipped" },
  { n: "$XX,XXX", label: "awarded", long: true },
  { n: "XX", label: "schools" },
];

const CROWD: Array<{ left: string; shirt: Shade; variant: 0 | 1 | 2 }> = [
  { left: "6%", shirt: C.orange, variant: 0 },
  { left: "29%", shirt: C.teal, variant: 1 },
  { left: "54%", shirt: C.pink, variant: 2 },
  { left: "61%", shirt: C.marigold, variant: 0 },
  { left: "86%", shirt: C.ink, variant: 1 },
];

export default function Stats() {
  return (
    <section className="pop-band pop-band--cream pop-stats" id="stats">
      <div className="pop-wrap">
        <div className="pop-stats-head">
          <Rise>
            <h2 className="pop-h2">last year, in numbers</h2>
          </Rise>
          <Rise i={1}>
            <p className="pop-note">
              Final counts land with applications. Until then, the placeholders stand in.
            </p>
          </Rise>
        </div>
      </div>

      <Rise i={2}>
        <div className="pop-stats-rail">
          <div className="pop-wrap pop-stats-inner">
            <div className="pop-stats-grid">
              {STATS.map((s) => (
                <div className="pop-stat" key={s.label}>
                  <span className={"pop-stat-num" + (s.long ? " pop-stat-num--long" : "")}>
                    {s.n}
                  </span>
                  <span className="pop-stat-label">{s.label}</span>
                </div>
              ))}
            </div>
            <div className="pop-crowd" aria-hidden="true">
              {CROWD.map((p, i) => (
                <span className="pop-crowd-fig" style={{ left: p.left }} key={i}>
                  <Person shirt={p.shirt} variant={p.variant} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </Rise>
    </section>
  );
}
