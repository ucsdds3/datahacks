import { Sparkle, StarGlyph } from "../art/Doodles";
import { CREAM, MINT, SKY, TOMATO } from "../art/palette";
import { DriftingDoodle, Reveal } from "../motion";
import { Pill } from "../components";

const PODIUM = [
  { place: "2nd", height: "g-podium__col--2", colour: SKY },
  { place: "1st", height: "g-podium__col--1", colour: TOMATO },
  { place: "3rd", height: "g-podium__col--3", colour: MINT },
];

const EXTRAS = [
  ["Track One winner", "TBD"],
  ["Track Two winner", "TBD"],
  ["Track Three winner", "TBD"],
  ["Track Four winner", "TBD"],
  ["Best first-time hack", "TBD"],
  ["Sponsor challenge", "TBD"],
];

export function Prizes() {
  return (
    <section className="g-prizes" id="prizes">
      <div className="g-wrap">
        <div className="g-prizes__top">
          <Reveal className="g-prizes__intro">
            <p className="g-label">Prize pool</p>
            <p className="g-prizes__pool">$XX,XXX</p>
            <p className="g-prizes__copy">
              The total pool is still being finalised with our sponsors. Splits below are the
              shape it will take.
            </p>
          </Reveal>

          <DriftingDoodle className="g-doodle g-doodle--prizespark" speed={-30} spin={-10}>
            <Sparkle colour={CREAM} />
          </DriftingDoodle>
        </div>

        <div className="g-podium">
          {PODIUM.map((p, i) => (
            <Reveal key={p.place} delay={0.08 * i} className={`g-podium__col ${p.height}`}>
              <span className="g-podium__place" style={{ color: p.colour }}>
                {p.place}
              </span>
              <span className="g-podium__amount">TBD</span>
              <span className="g-podium__block" style={{ background: p.colour }}>
                <StarGlyph className="g-podium__star" colour={CREAM} />
              </span>
            </Reveal>
          ))}
        </div>

        <ul className="g-prizes__extras">
          {EXTRAS.map((row, i) => (
            <Reveal as="li" key={row[0]} delay={0.05 * i} className="g-prizes__row">
              <span className="g-prizes__rowname">{row[0]}</span>
              <span className="g-prizes__rowdots" aria-hidden="true" />
              <span className="g-prizes__rowval">{row[1]}</span>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={0.1} className="g-prizes__cta">
          <Pill href="#sponsors" tone="ink" size="lg">
            Add a prize to the pool
          </Pill>
        </Reveal>
      </div>
    </section>
  );
}
