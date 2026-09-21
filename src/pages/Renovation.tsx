import { useEffect } from "react";
import "./renovation.css";

/**
 * The public holding page.
 *
 * Deliberately not the themed site: the world under /datacraft is unfinished and
 * should not be the first thing a sponsor or a hacker sees. This says the one true
 * thing we have and gives people a way to reach us.
 */
export default function Renovation() {
  useEffect(() => {
    const previous = document.title;
    document.title = "DataHacks — back soon";
    return () => { document.title = previous; };
  }, []);

  return <main className="dh-hold">
    <div className="dh-hold-inner">
      <p className="dh-hold-org">DS3 · UC SAN DIEGO</p>
      <h1>DATAHACKS</h1>
      <p className="dh-hold-lead">The site is under renovation. We’ll be back soon.</p>
      <dl className="dh-hold-facts">
        <div><dt>Next event</dt><dd>January 16–17, 2027</dd></div>
        <div><dt>Applications</dt><dd>Opening October 2026</dd></div>
      </dl>
      <p className="dh-hold-contact">
        Sponsors and questions: <a href="mailto:info@ds3.club">info@ds3.club</a>
      </p>
    </div>
  </main>;
}
