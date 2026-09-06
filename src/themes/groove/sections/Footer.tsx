import { DatasaurMark } from "../art/Datasaur";
import { RainbowRibbon } from "../art/Ribbon";
import { Reveal } from "../motion";
import { Pill } from "../components";

const SOCIALS = [
  ["Instagram", "https://instagram.com"],
  ["Discord", "https://discord.com"],
  ["LinkedIn", "https://linkedin.com"],
  ["Email", "mailto:hello@ds3ucsd.com"],
];

export function Footer() {
  return (
    <footer className="g-footer" id="apply">
      <RainbowRibbon variant="footer" className="g-footer__ribbon" />

      <div className="g-wrap g-footer__inner">
        <Reveal className="g-footer__cta">
          <p className="g-footer__kicker">Applications open soon</p>
          <h2 className="g-footer__big">See you in January</h2>
          <div className="g-footer__ctas">
            <Pill href="#apply" tone="cream" size="lg">
              Apply to hack
            </Pill>
            <Pill href="mailto:sponsorship@ds3ucsd.com" tone="cream" size="lg">
              Become a sponsor
            </Pill>
          </div>
        </Reveal>

        <div className="g-footer__meta">
          <div className="g-footer__org">
            <DatasaurMark className="g-footer__mark" />
            <p>
              DataHacks 2.0 — organised by <strong>DS3</strong>, the Data Science Student Society.
              January 16–17, 2027.
            </p>
          </div>

          <ul className="g-footer__socials">
            {SOCIALS.map(([name, href]) => (
              <li key={name}>
                <a href={href}>{name}</a>
              </li>
            ))}
          </ul>
        </div>

        <p className="g-footer__fine">
          A student-run event. All attendees, sponsors and volunteers agree to the DataHacks code
          of conduct. Applications, prizes and schedule are subject to change until announced.
          Mockup content — dates and figures are placeholders.
        </p>
      </div>
    </footer>
  );
}
