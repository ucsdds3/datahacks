import { MARIGOLD, MINT, SKY } from "../art/palette";
import { Reveal } from "../motion";
import { Pill } from "../components";

const TIERS = [
  { name: "Diamond", slots: 2, colour: SKY, note: "Naming rights + keynote slot" },
  { name: "Gold", slots: 3, colour: MARIGOLD, note: "Track sponsorship + workshop" },
  { name: "Silver", slots: 4, colour: MINT, note: "Logo, table, resume book" },
];

export function Sponsors() {
  return (
    <section className="g-sponsors" id="sponsors">
      <div className="g-wrap">
        <div className="g-sponsors__head">
          <Reveal>
            <p className="g-label">Sponsors</p>
            <h2 className="g-sponsors__title">Your logo, this space</h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="g-sponsors__copy">
              Sponsorship keeps DataHacks free for every student who walks in. Three tiers, all
              open, all for the 2027 edition.
            </p>
            <Pill href="mailto:sponsorship@ds3ucsd.com" tone="cream" size="md">
              sponsorship@ds3ucsd.com
            </Pill>
          </Reveal>
        </div>

        <div className="g-sponsors__tiers">
          {TIERS.map((tier, ti) => (
            <div className="g-tier" key={tier.name}>
              <Reveal delay={0.06 * ti}>
                <div className="g-tier__head">
                  <span className="g-tier__name" style={{ color: tier.colour }}>
                    {tier.name}
                  </span>
                  <span className="g-tier__note">{tier.note}</span>
                  <span className="g-tier__count">
                    {tier.slots} {tier.slots === 1 ? "slot" : "slots"}
                  </span>
                </div>
              </Reveal>

              <ul className={`g-tier__slots g-tier__slots--${tier.slots}`}>
                {Array.from({ length: tier.slots }).map((_, i) => (
                  <Reveal
                    as="li"
                    key={`${tier.name}-${i}`}
                    delay={0.06 * ti + 0.05 * i}
                    className="g-slot"
                  >
                    <span className="g-slot__mark" style={{ borderColor: tier.colour }} />
                    <span className="g-slot__label">Open</span>
                  </Reveal>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
