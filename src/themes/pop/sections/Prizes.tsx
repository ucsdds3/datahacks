import React from "react";
import { C } from "../art/iso";
import { Person, Trophy } from "../art/Props";
import { Rise } from "../motion";

const STEPS = [
  { place: "3rd", mod: "pop-step--3", amount: "$X,XXX", shirt: C.pink },
  { place: "2nd", mod: "pop-step--2", amount: "$X,XXX", shirt: C.teal },
  { place: "1st", mod: "pop-step--1", amount: "$XX,XXX", shirt: C.cream },
];

export default function Prizes() {
  return (
    <section className="pop-band pop-band--marigold pop-prizes" id="prizes">
      <div className="pop-wrap">
        <div className="pop-prize-top">
          <div>
            <Rise>
              <p className="pop-eyebrow">Prize pool</p>
            </Rise>
            <Rise i={1}>
              <p className="pop-pool">$XX,XXX</p>
            </Rise>
          </div>
          <Rise i={2}>
            <p className="pop-note pop-prize-note">
              Split across the podium and every track. The pool is confirmed once sponsors are
              signed — the shape below is final, the numbers are not.
            </p>
          </Rise>
        </div>

        <Rise i={3}>
          <div className="pop-ladder">
            {STEPS.map((s) => (
              <div className={"pop-step " + s.mod} key={s.place}>
                <span className="pop-step-fig">
                  {s.place === "1st" ? (
                    <Trophy className="pop-step-trophy" />
                  ) : (
                    <Person shirt={s.shirt} variant={s.place === "2nd" ? 1 : 2} />
                  )}
                </span>
                <div className="pop-step-body">
                  <span className="pop-step-place">{s.place}</span>
                  <span className="pop-step-amt">{s.amount}</span>
                  <span className="pop-step-tbd">TBD</span>
                </div>
              </div>
            ))}
          </div>
        </Rise>

        <Rise i={4}>
          <div className="pop-track-prizes">
            <span className="pop-eyebrow">Track prizes</span>
            <ul>
              {["Track One", "Track Two", "Track Three", "Track Four"].map((t) => (
                <li className="pop-chip" key={t}>
                  {t} <b>TBD</b>
                </li>
              ))}
            </ul>
          </div>
        </Rise>
      </div>
    </section>
  );
}
