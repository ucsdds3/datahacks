import React from "react";
import Machine from "../art/Machine";
import { Drift, Rise } from "../motion";

const META: Array<[string, string]> = [
  ["Format", "36 hours, in person"],
  ["Dates", "Sat 16 – Sun 17 Jan 2027"],
  ["Teams", "Up to 4 people"],
  ["Level", "All of them, including none"],
];

export default function About() {
  return (
    <section className="pop-band pop-band--marigold pop-about" id="about">
      <div className="pop-wrap pop-about-grid">
        <Drift className="pop-about-art" amount={46}>
          <Machine className="pop-machine" />
        </Drift>

        <div className="pop-about-copy">
          <Rise>
            <p className="pop-eyebrow">What it is</p>
          </Rise>
          <Rise i={1}>
            <h2 className="pop-h2">a machine for building things in a weekend</h2>
          </Rise>
          <Rise i={2}>
            <p className="pop-body">
              DataHacks is a weekend-long data science and machine learning hackathon, built and
              run entirely by students. Thirty-six hours, one room, and whatever you can ship
              inside it.
            </p>
          </Rise>
          <Rise i={3}>
            <p className="pop-body">
              Open to every skill level. Bring a team of up to four, or turn up on your own and
              find one at team formation on Saturday morning.
            </p>
          </Rise>
          <Rise i={4}>
            <dl className="pop-meta">
              {META.map(([k, v]) => (
                <div className="pop-meta-row" key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </Rise>
        </div>
      </div>
    </section>
  );
}
