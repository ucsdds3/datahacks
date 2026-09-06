import React from "react";
import Datasaur from "../art/Datasaur";
import { Drift, Rise } from "../motion";

export default function Hero() {
  return (
    <section className="pop-band pop-band--pink pop-hero" id="top">
      <div className="pop-wrap">
        <Rise>
          <p className="pop-eyebrow">DS3 — Data Science Student Society</p>
        </Rise>

        <Rise i={1}>
          <h1 className="pop-hero-type">
            <span className="pop-hero-sm">hello,</span>
            <span className="pop-hero-lg">
              datahacks<em>2.0</em>
            </span>
          </h1>
        </Rise>

        <div className="pop-hero-lower">
          <div className="pop-hero-copy">
            <Rise i={2}>
              <p className="pop-hero-lead">January 16–17, 2027 · 36 hours, in person.</p>
            </Rise>
            <Rise i={3}>
              <p className="pop-hero-sub">
                A student-run data science and machine learning hackathon. Bring an idea, leave
                with something that runs.
              </p>
            </Rise>
            <Rise i={4}>
              <div className="pop-hero-cta">
                <a className="pop-btn" href="#apply">
                  Apply to hack
                </a>
                <a className="pop-btn pop-btn--ghost" href="#sponsors">
                  Become a sponsor
                </a>
              </div>
            </Rise>
          </div>

          <Drift className="pop-hero-art" amount={30}>
            <Datasaur className="pop-saur" />
          </Drift>
        </div>
      </div>
    </section>
  );
}
