import { Daisy, Mushroom, Worm } from "../art/Doodles";
import { MARIGOLD, MINT, PINK, TOMATO } from "../art/palette";
import { DriftingDoodle, Reveal } from "../motion";
import { SectionHead } from "../components";

const FACTS = [
  ["36", "hours, start to finish"],
  ["4", "hackers per team, max"],
  ["0", "experience required"],
];

export function About() {
  return (
    <section className="g-about" id="about">
      <div className="g-wrap">
        <SectionHead
          eyebrow="What it is"
          title="A hackathon run by students, for anyone curious about data"
          rule
          body="DataHacks is a weekend-long data science and machine learning hackathon, organised end to end by students. Every skill level is welcome — first-timers included — in teams of up to four. Bring an idea or find one here; you leave with something you actually built."
        />

        <div className="g-about__facts">
          {FACTS.map(([n, copy], i) => (
            <Reveal key={n + copy} delay={0.08 * i} className="g-about__fact">
              <span className="g-about__factnum">{n}</span>
              <span className="g-about__factcopy">{copy}</span>
            </Reveal>
          ))}
        </div>
      </div>

      <div className="g-about__garden" aria-hidden="true">
        <DriftingDoodle className="g-doodle g-doodle--daisy" speed={26} spin={-8}>
          <Daisy accent={MARIGOLD} />
        </DriftingDoodle>
        <DriftingDoodle className="g-doodle g-doodle--shroom" speed={-30} spin={6}>
          <Mushroom colour={TOMATO} />
        </DriftingDoodle>
        <DriftingDoodle className="g-doodle g-doodle--worm" speed={34} spin={0}>
          <Worm colour={MINT} />
        </DriftingDoodle>
        <DriftingDoodle className="g-doodle g-doodle--daisy2" speed={-22} spin={12}>
          <Daisy accent={PINK} />
        </DriftingDoodle>
      </div>
    </section>
  );
}
