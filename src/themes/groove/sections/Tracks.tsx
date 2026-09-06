import type { ReactNode } from "react";
import { Comet, Mushroom, Planet, Rocket } from "../art/Doodles";
import { LILAC, MARIGOLD, MINT, PINK, SKY, TOMATO } from "../art/palette";
import { Reveal } from "../motion";
import { SectionHead } from "../components";

const TRACKS: { n: string; name: string; art: ReactNode; tint: string }[] = [
  {
    n: "01",
    name: "Track One",
    art: <Rocket colour={TOMATO} accent={SKY} />,
    tint: TOMATO,
  },
  {
    n: "02",
    name: "Track Two",
    art: <Planet colour={SKY} accent={MARIGOLD} />,
    tint: SKY,
  },
  {
    n: "03",
    name: "Track Three",
    art: <Mushroom colour={MARIGOLD} />,
    tint: MARIGOLD,
  },
  {
    n: "04",
    name: "Track Four",
    art: <Comet colour={MINT} />,
    tint: MINT,
  },
];

export function Tracks() {
  return (
    <section className="g-tracks" id="tracks">
      <div className="g-wrap">
        <SectionHead
          eyebrow="Tracks"
          title="Four tracks. Announced closer to the date."
          body="Each track comes with its own prize and its own judges. We are locking the themes with our sponsors now — check back, or get the drop in your inbox with your application."
        />

        <ul className="g-tracks__grid">
          {TRACKS.map((t, i) => (
            <Reveal
              as="li"
              key={t.n}
              delay={0.08 * i}
              className={`g-track g-track--${(i % 2) + 1}`}
            >
              <span className="g-track__n">{t.n}</span>
              <span className="g-track__art" aria-hidden="true">
                {t.art}
              </span>
              <h3 className="g-track__name">{t.name}</h3>
              <p className="g-track__tbd" style={{ color: t.tint }}>
                TBD
              </p>
              <p className="g-track__foot">Theme + prize announced with applications</p>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={0.1}>
          <p className="g-tracks__aside">
            <span className="g-tracks__asidedot" style={{ background: LILAC }} />
            Every project is eligible for the main prize, whatever track it lands in.
            <span className="g-tracks__asidedot" style={{ background: PINK }} />
          </p>
        </Reveal>
      </div>
    </section>
  );
}
