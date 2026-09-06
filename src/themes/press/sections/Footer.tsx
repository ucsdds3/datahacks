import { DatasaurSilhouette } from "../art/Datasaur";

export default function Footer() {
  return (
    <footer className="press-footer">
      <div className="press-footer__cta">
        <p className="press-footer__cta-text">
          Applications open soon.
          <em> Bring a laptop.</em>
        </p>
        <a className="press-pill press-pill--invert" href="#apply" id="apply">
          Apply to hack
        </a>
      </div>

      <div className="press-footer__masthead" aria-hidden="true">
        <span>DATAHACKS 2.0</span>
        <svg className="press-footer__saur" viewBox="24 46 592 350" focusable="false">
          <DatasaurSilhouette fill="#F5E9C8" opacity={0.9} />
        </svg>
      </div>

      <div className="press-footer__cols">
        <div className="press-footer__col">
          <h4>Colophon</h4>
          <p>
            Presented by DS3 — the Data Science Student Society. Organised, judged and staffed
            entirely by students.
          </p>
          <p className="press-footer__set">
            Set in Playfair Display, Anton and EB Garamond. All illustration drawn as vector
            engraving.
          </p>
        </div>

        <div className="press-footer__col">
          <h4>Elsewhere</h4>
          <ul className="press-footer__links">
            <li>
              <a href="#top">Instagram</a>
            </li>
            <li>
              <a href="#top">LinkedIn</a>
            </li>
            <li>
              <a href="#top">Discord</a>
            </li>
            <li>
              <a href="mailto:sponsorship@ds3ucsd.com">sponsorship@ds3ucsd.com</a>
            </li>
          </ul>
        </div>

        <div className="press-footer__col press-footer__col--fine">
          <h4>Small print</h4>
          <p>
            All attendees agree to the event Code of Conduct. Harassment of any kind ends your
            weekend. Report anything to an organiser in a black shirt or at the front desk.
          </p>
          <p>
            Dates, prizes, tracks and schedule are provisional and subject to change until
            applications open.
          </p>
        </div>
      </div>

      <div className="press-footer__rule">
        <span>DataHacks 2.0</span>
        <span>January 16–17, 2027</span>
        <span>Made by students, in a room, overnight.</span>
      </div>
    </footer>
  );
}
