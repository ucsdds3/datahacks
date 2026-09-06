import React from "react";
import { IconBot, IconGlobe, IconNet, IconScatter, IconStar } from "../art/Icons";
import { Rise } from "../motion";

const TRACKS = [
  { title: "Track One", tile: "pop-tile--marigold", Icon: IconScatter },
  { title: "Track Two", tile: "pop-tile--teal", Icon: IconNet },
  { title: "Track Three", tile: "pop-tile--orange", Icon: IconGlobe },
  { title: "Track Four", tile: "pop-tile--pink", Icon: IconBot },
];

export default function Tracks() {
  return (
    <section className="pop-band pop-band--pink pop-tracks" id="tracks">
      <div className="pop-wrap">
        <div className="pop-tracks-head">
          <Rise>
            <p className="pop-eyebrow">Challenge tracks</p>
          </Rise>
          <Rise i={1}>
            <h2 className="pop-h2">four tracks. announced closer to the date.</h2>
          </Rise>
        </div>

        <div className="pop-card-grid">
          {TRACKS.map((t, i) => (
            <Rise i={i} key={t.title}>
              <article className="pop-card">
                <span className={"pop-card-tile " + t.tile}>
                  <t.Icon className="pop-card-icon" />
                </span>
                <h3 className="pop-card-title">{t.title}</h3>
                <p className="pop-card-tbd">TBD</p>
                <p className="pop-card-note">
                  Prompt, dataset and judging criteria to be announced.
                </p>
              </article>
            </Rise>
          ))}
        </div>
      </div>

      <div className="pop-badge" aria-hidden="true">
        <IconStar className="pop-badge-star" />
        <span>
          36
          <br />
          hrs
        </span>
      </div>
    </section>
  );
}
