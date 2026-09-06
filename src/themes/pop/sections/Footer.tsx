import React from "react";
import { IconStar } from "../art/Icons";
import { Rise } from "../motion";

const COLS: Array<{ head: string; links: string[] }> = [
  { head: "Event", links: ["About", "Tracks", "Prizes", "Schedule", "FAQ"] },
  { head: "Get involved", links: ["Apply to hack", "Become a sponsor", "Mentor", "Volunteer"] },
  { head: "Connect", links: ["Instagram", "LinkedIn", "GitHub", "Discord"] },
];

export default function Footer() {
  return (
    <footer className="pop-foot">
      <div className="pop-wrap">
        <div className="pop-foot-top">
          <Rise>
            <p className="pop-foot-mark">
              datahacks<em>2.0</em>
            </p>
          </Rise>
          <Rise i={1}>
            <p className="pop-foot-dates">
              January 16–17, 2027
              <IconStar className="pop-foot-star" />
              36 hours
            </p>
          </Rise>
        </div>

        <div className="pop-foot-cols">
          {COLS.map((c, i) => (
            <Rise i={i} key={c.head}>
              <div className="pop-foot-col">
                <h3>{c.head}</h3>
                <ul>
                  {c.links.map((l) => (
                    <li key={l}>
                      <a href="#top">{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </Rise>
          ))}
          <Rise i={3}>
            <div className="pop-foot-col pop-foot-col--org">
              <h3>Organised by</h3>
              <p>
                DS3 — Data Science Student Society. A student-run organisation. DataHacks 2.0 is
                not affiliated with, or endorsed by, any university.
              </p>
              <a className="pop-foot-mail" href="mailto:hello@ds3ucsd.com">
                hello@ds3ucsd.com
              </a>
            </div>
          </Rise>
        </div>

        <div className="pop-foot-fine">
          <p>
            All attendees, sponsors, mentors and volunteers are required to follow the event code
            of conduct. Report anything to any organiser in a black staff shirt, or by email.
          </p>
          <p>
            Schedule, prizes, tracks and travel policy are provisional and subject to change.
            © 2027 DS3. Mockup — not a live registration page.
          </p>
        </div>
      </div>
    </footer>
  );
}
