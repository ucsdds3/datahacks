import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";
import "./minecraft.css";
import { About, Tracks, Prizes, Schedule, Sponsors, Faq, Apply } from "./WorldSections";

const links = [["About", "about"], ["Tracks", "tracks"], ["Schedule", "schedule"], ["FAQ", "faq"]];

export default function Minecraft() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="minecraft-root" id="top">
      <a className="mc-skip" href="#main">Skip to content</a>
      <header className="mc-nav">
        <a href="#top" className="mc-brand" aria-label="DataHacks home"><span className="mc-brand-icon" aria-hidden="true">D</span><span>DATAHACKS<span className="mc-brand-version"> 2.0</span></span></a>
        <nav aria-label="Main navigation" className={menuOpen ? "mc-links is-open" : "mc-links"} id="mc-navigation">
          {links.map(([label, id]) => <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>{label}</a>)}
        </nav>
        <a href="#apply" className="mc-button mc-button-small">Join the adventure <ArrowUpRight size={16} /></a>
        <button className="mc-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="mc-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      </header>
      <main id="main">
        <section className="mc-hero" aria-labelledby="mc-title">
          <div className="mc-hero-image" />
          <div className="mc-hero-shade" />
          <div className="mc-hero-content">
            <p className="mc-eyebrow mc-hero-eyebrow">DS3 PRESENTS · A NEW WORLD OF POSSIBILITIES</p>
            <div className="mc-title-wrap"><h1 id="mc-title">DATA<span>HACKS</span></h1><span className="mc-edition">THE 2.0 UPDATE</span><span className="mc-splash">Now with more data!</span></div>
            <p className="mc-hero-tagline">Big ideas. Infinite possibilities. One world to build.</p>
            <p className="mc-hero-date">JANUARY 16–17, 2027 <span>✦</span> 36 HOURS <span>✦</span> IN PERSON</p>
            <div className="mc-hero-actions"><a href="#apply" className="mc-button">Start your adventure <ArrowUpRight size={19} /></a><a href="#about" className="mc-button mc-button-stone">Explore the world <ArrowDown size={17} /></a></div>
            <p className="mc-hero-note">All experience levels. No diamonds required.</p>
          </div>
          <div className="mc-hero-bottom"><span>WORLD: DATAHACKS 2027<br />GAME MODE: COLLABORATIVE</span><a href="#about">SCROLL TO EXPLORE <ArrowDown size={16} /></a><span>SEED: 01162027<br />DIFFICULTY: YOUR CHOICE</span></div>
        </section>
        <div className="mc-world-strip"><span>CREATE.</span><span>COLLABORATE.</span><span>CRAFT SOMETHING GREAT.</span><span aria-hidden="true">✦</span><span>YOUR NEXT ADVENTURE STARTS HERE.</span></div>
        <About />
        <Tracks />
        <Prizes />
        <Schedule />
        <Sponsors />
        <Faq />
        <Apply />
      </main>
      <footer className="mc-footer"><div className="mc-container"><div className="mc-footer-top"><a href="#top" className="mc-brand">DATAHACKS 2.0</a><p>A world of ideas, crafted together.</p><a href="#top" className="mc-back-top">Back to spawn ↑</a></div><div className="mc-footer-links"><p>Organized by DS3<br /><span>Data Science Student Society</span></p><nav aria-label="Footer navigation"><a href="#about">About</a><a href="#tracks">Tracks</a><a href="#prizes">Prizes</a><a href="#schedule">Schedule</a><a href="#faq">FAQ</a></nav><a href="mailto:hello@ds3ucsd.com">hello@ds3ucsd.com</a></div><div className="mc-footer-fine"><p>© 2027 DS3 · Concept preview · Not a live registration page.<br />Unofficial Minecraft-inspired design. Not affiliated with Mojang or Microsoft.</p><Link to="/themes">← All theme mockups</Link></div></div></footer>
    </div>
  );
}
