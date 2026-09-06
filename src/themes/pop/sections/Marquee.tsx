import React from "react";
import { IconStar } from "../art/Icons";

const ITEMS = [
  "DATAHACKS 2.0",
  "JAN 16–17",
  "36 HOURS",
  "BUILD SOMETHING",
  "APPLICATIONS OPEN SOON",
];

function Sequence() {
  return (
    <div className="pop-marquee-seq">
      {ITEMS.map((item) => (
        <React.Fragment key={item}>
          <span className="pop-marquee-item">{item}</span>
          <IconStar className="pop-marquee-star" />
        </React.Fragment>
      ))}
    </div>
  );
}

export default function Marquee() {
  return (
    <section className="pop-marquee" aria-label="Event highlights">
      <p className="pop-sr">
        DataHacks 2.0 — January 16 to 17 — 36 hours — build something — applications open soon.
      </p>
      <div className="pop-marquee-track" aria-hidden="true">
        <Sequence />
        <Sequence />
      </div>
    </section>
  );
}
