import "./groove.css";

import { RainbowRibbon } from "./art/Ribbon";
import { Hero } from "./sections/Hero";
import { MarqueeStrip } from "./sections/Marquee";
import { About } from "./sections/About";
import { Stats } from "./sections/Stats";
import { Tracks } from "./sections/Tracks";
import { Prizes } from "./sections/Prizes";
import { Schedule } from "./sections/Schedule";
import { Sponsors } from "./sections/Sponsors";
import { Faq } from "./sections/Faq";
import { Footer } from "./sections/Footer";

export default function Groove() {
  return (
    <div className="groove-root">
      <Hero />

      {/* hard cut from ink to cream */}
      <MarqueeStrip tone="cream" speed={30} className="g-strip--cut" />

      <About />

      <div className="g-divider" aria-hidden="true">
        <RainbowRibbon variant="divider" className="g-divider__ribbon" />
      </div>

      <Stats />
      <Tracks />
      <Prizes />
      <Schedule />
      <Sponsors />
      <Faq />
      <Footer />
    </div>
  );
}
