import "./press.css";

import PressDefs from "./art/Defs";
import Marquee from "./sections/Marquee";
import Nav from "./sections/Nav";
import Hero from "./sections/Hero";
import Questions from "./sections/Questions";
import About from "./sections/About";
import Stats from "./sections/Stats";
import Tracks from "./sections/Tracks";
import Prizes from "./sections/Prizes";
import Schedule from "./sections/Schedule";
import Sponsors from "./sections/Sponsors";
import Faq from "./sections/Faq";
import Footer from "./sections/Footer";

export default function Press() {
  return (
    <div className="press-root">
      <PressDefs />
      <div className="press-paper" aria-hidden="true" />

      <Marquee tone="forest" />
      <Nav />
      <Hero />
      <Questions />
      <About />
      <Stats />
      <Tracks />
      <Prizes />
      <Marquee tone="brick" reverse />
      <Schedule />
      <Sponsors />
      <Faq />
      <Footer />
    </div>
  );
}
