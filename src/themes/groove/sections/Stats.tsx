import { MARIGOLD, MINT, PINK, TOMATO } from "../art/palette";
import { Sparkle } from "../art/Doodles";
import { DriftingDoodle, Reveal } from "../motion";

const STATS = [
  { value: "XXX", label: "hackers", note: "on the floor", colour: TOMATO },
  { value: "XXX", label: "projects shipped", note: "in 36 hours", colour: MARIGOLD },
  { value: "$XX,XXX", label: "awarded", note: "in prizes", colour: MINT },
  { value: "XX", label: "schools", note: "represented", colour: PINK },
];

export function Stats() {
  return (
    <section className="g-stats" id="stats">
      <div className="g-wrap">
        <Reveal>
          <p className="g-label g-stats__eyebrow">Last year, in numbers</p>
        </Reveal>
        <Reveal delay={0.06}>
          <p className="g-stats__note">
            Final figures are still being counted. The shape of the weekend, though, is exactly
            this.
          </p>
        </Reveal>

        <ol className="g-stats__list">
          {STATS.map((s, i) => (
            <Reveal as="li" key={s.label} delay={0.07 * i} className="g-stats__item">
              <span className="g-stats__value" style={{ color: s.colour }}>
                {s.value}
              </span>
              <span className="g-stats__label">{s.label}</span>
              <span className="g-stats__sub">{s.note}</span>
            </Reveal>
          ))}
        </ol>
      </div>

      <DriftingDoodle className="g-doodle g-doodle--statspark" speed={-42} spin={14}>
        <Sparkle colour={MARIGOLD} />
      </DriftingDoodle>
    </section>
  );
}
