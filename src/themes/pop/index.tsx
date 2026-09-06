import React from "react";
import "./pop.css";

import TopBar from "./sections/TopBar";
import Hero from "./sections/Hero";
import Marquee from "./sections/Marquee";
import About from "./sections/About";
import Stats from "./sections/Stats";
import Tracks from "./sections/Tracks";
import Prizes from "./sections/Prizes";
import Schedule from "./sections/Schedule";
import Sponsors from "./sections/Sponsors";
import Faq from "./sections/Faq";
import Footer from "./sections/Footer";

export default function Pop() {
  return (
    <div className="pop-root">
      <TopBar />
      <main>
        <Hero />
        <Marquee />
        <About />
        <Stats />
        <Tracks />
        <Prizes />
        <Schedule />
        <Sponsors />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
