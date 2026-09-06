import React from "react";
import { Coffee, Laptop, Server } from "../art/Props";
import { Drift, Rise } from "../motion";

type Row = { time: string; title: string; note?: string };

const SAT: Row[] = [
  { time: "09:00", title: "Check-in opens", note: "Coffee, stickers, wristbands" },
  { time: "10:30", title: "Opening ceremony" },
  { time: "11:15", title: "Team formation", note: "Come solo, leave with three friends" },
  { time: "12:30", title: "Workshops begin", note: "Beginner track runs all afternoon" },
  { time: "18:30", title: "Dinner" },
  { time: "00:00", title: "Midnight event", note: "TBD, historically loud" },
];

const SUN: Row[] = [
  { time: "08:30", title: "Breakfast" },
  { time: "11:00", title: "Submissions close", note: "Hard stop. Really." },
  { time: "11:30", title: "Judging expo", note: "Two rounds, live demos" },
  { time: "15:00", title: "Closing + awards" },
  { time: "16:00", title: "Teardown" },
];

function Day({
  label,
  date,
  rows,
  index,
}: {
  label: string;
  date: string;
  rows: Row[];
  index: number;
}) {
  return (
    <div className="pop-day">
      <div className="pop-day-head">
        <span className="pop-day-label">{label}</span>
        <span className="pop-day-date">{date}</span>
      </div>
      <ul className="pop-day-rows">
        {rows.map((r, i) => (
          <Rise as="li" i={Math.min(i, 4)} y={16} key={r.title} className="pop-row">
            <span className="pop-row-time">{r.time}</span>
            <span className="pop-row-body">
              <span className="pop-row-title">{r.title}</span>
              {r.note && <span className="pop-row-note">{r.note}</span>}
            </span>
          </Rise>
        ))}
      </ul>
      <p className="pop-day-foot">
        {index === 0 ? "Doors stay open overnight." : "Times are indicative — final schedule TBD."}
      </p>
    </div>
  );
}

export default function Schedule() {
  return (
    <section className="pop-band pop-band--cream pop-sched" id="schedule">
      <div className="pop-wrap">
        <div className="pop-sched-head">
          <Rise>
            <p className="pop-eyebrow">Two days</p>
          </Rise>
          <Rise i={1}>
            <h2 className="pop-h2">saturday to sunday, without stopping</h2>
          </Rise>
        </div>

        <div className="pop-sched-grid">
          <Day label="Saturday" date="Jan 16" rows={SAT} index={0} />
          <Day label="Sunday" date="Jan 17" rows={SUN} index={1} />
        </div>

        <div className="pop-sched-props" aria-hidden="true">
          <Drift amount={26} className="pop-prop pop-prop--laptop">
            <Laptop />
          </Drift>
          <Drift amount={-20} className="pop-prop pop-prop--coffee">
            <Coffee />
          </Drift>
          <Drift amount={32} className="pop-prop pop-prop--server">
            <Server />
          </Drift>
        </div>
      </div>
    </section>
  );
}
