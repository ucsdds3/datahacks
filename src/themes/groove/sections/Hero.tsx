import { HeroWordmark } from "../art/Headline";
import { Datasaur, DatasaurMark } from "../art/Datasaur";
import { RainbowRibbon } from "../art/Ribbon";
import { Buddy, Comet, Planet, Rocket, Sparkle, Swirl } from "../art/Doodles";
import { MARIGOLD, MINT, PINK, SKY, TOMATO } from "../art/palette";
import { DriftingDoodle } from "../motion";
import { MarqueeStrip } from "./Marquee";
import { Pill } from "../components";

export function Hero() {
  return (
    <section className="g-hero" id="top">
      <MarqueeStrip tone="ink" speed={38} className="g-hero__strip" />

      <nav className="g-nav" aria-label="Primary">
        <div className="g-nav__cluster g-nav__cluster--left">
          <a className="g-nav__link" href="#about">
            About
          </a>
          <a className="g-nav__link" href="#tracks">
            Tracks
          </a>
          <a className="g-nav__link" href="#schedule">
            Schedule
          </a>
        </div>

        <a className="g-nav__mark" href="#top">
          <DatasaurMark className="g-nav__markicon" />
          <span>DataHacks</span>
        </a>

        <div className="g-nav__cluster g-nav__cluster--right">
          <a className="g-nav__link" href="#faq">
            FAQ
          </a>
          <Pill href="#apply" tone="cream" size="sm">
            Apply
          </Pill>
        </div>
      </nav>

      <div className="g-hero__stage">
        <RainbowRibbon variant="hero" className="g-hero__ribbon" />

        <div className="g-hero__doodles">
          <DriftingDoodle className="g-doodle g-doodle--rocket" speed={-58} spin={8}>
            <Rocket colour={TOMATO} accent={SKY} />
          </DriftingDoodle>
          <DriftingDoodle className="g-doodle g-doodle--planet" speed={44} spin={-6}>
            <Planet colour={SKY} accent={MARIGOLD} />
          </DriftingDoodle>
          <DriftingDoodle className="g-doodle g-doodle--spark1" speed={70} spin={12}>
            <Sparkle colour={MARIGOLD} />
          </DriftingDoodle>
          <DriftingDoodle className="g-doodle g-doodle--spark2" speed={-34} spin={-14}>
            <Sparkle colour={PINK} />
          </DriftingDoodle>
          <DriftingDoodle className="g-doodle g-doodle--comet" speed={52} spin={-4}>
            <Comet colour={MINT} />
          </DriftingDoodle>
          <DriftingDoodle className="g-doodle g-doodle--buddy" speed={-46} spin={-8}>
            <Buddy />
          </DriftingDoodle>
          <DriftingDoodle className="g-doodle g-doodle--swirl" speed={38} spin={10}>
            <Swirl colour={PINK} />
          </DriftingDoodle>
        </div>

        <HeroWordmark className="g-hero__wordmark" />

        <div className="g-hero__base">
          <div className="g-hero__copy">
            <p className="g-label g-hero__date">January 16–17, 2027 · Sat + Sun</p>
            <p className="g-hero__lede">
              Thirty-six hours to turn a dataset into something that actually works. Free, in
              person, and open to every skill level.
            </p>
            <div className="g-hero__ctas">
              <Pill href="#apply" tone="cream" size="md">
                Apply to hack
              </Pill>
              <Pill href="#sponsors" tone="cream" size="md">
                Become a sponsor
              </Pill>
            </div>
          </div>

          <div className="g-hero__saurwrap">
            <Datasaur className="g-hero__saur" />
          </div>
        </div>
      </div>
    </section>
  );
}
