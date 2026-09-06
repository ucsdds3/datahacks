import React from "react";
import { IconDiamond } from "../art/Icons";
import { CubeStack } from "../art/Props";
import { Drift, Rise } from "../motion";

const TIERS = [
  { tier: "Diamond", slots: 2, mod: "pop-slot--xl" },
  { tier: "Gold", slots: 3, mod: "pop-slot--lg" },
  { tier: "Silver", slots: 4, mod: "" },
];

export default function Sponsors() {
  return (
    <section className="pop-band pop-band--pink pop-spon" id="sponsors">
      <div className="pop-wrap">
        <div className="pop-spon-head">
          <div>
            <Rise>
              <p className="pop-eyebrow">Sponsors</p>
            </Rise>
            <Rise i={1}>
              <h2 className="pop-h2">these frames are empty on purpose</h2>
            </Rise>
            <Rise i={2}>
              <p className="pop-body pop-spon-lead">
                Every slot below is open for 2027. Put a logo in one and a few hundred students
                will spend a weekend looking at it.
              </p>
            </Rise>
            <Rise i={3}>
              <p className="pop-spon-mail">
                Sponsor inquiries →{" "}
                <a href="mailto:sponsorship@ds3ucsd.com">sponsorship@ds3ucsd.com</a>
              </p>
            </Rise>
          </div>
          <Drift className="pop-spon-art" amount={30}>
            <CubeStack />
          </Drift>
        </div>

        <div className="pop-tiers">
          {TIERS.map((t, i) => (
            <Rise i={i} key={t.tier}>
              <div className="pop-tier">
                <div className="pop-tier-label">
                  <span>{t.tier}</span>
                  <span className="pop-tier-count">
                    {t.slots} slot{t.slots > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="pop-slots">
                  {Array.from({ length: t.slots }).map((_, s) => (
                    <div className={"pop-slot " + t.mod} key={s}>
                      <IconDiamond className="pop-slot-glyph" />
                      <span>Available</span>
                    </div>
                  ))}
                </div>
              </div>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  );
}
