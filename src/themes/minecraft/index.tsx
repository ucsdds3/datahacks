import { Link, Route, Routes, useLocation } from "react-router-dom";
import { ArrowDown, ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { About, Tracks, Prizes, Schedule, Sponsors } from "./WorldSections";
import { PortalFrame } from "./PortalFrame";
import TrialChambersPage, { TrialEntrance } from "./TrialChambers";
import { Speakers, SculkFaq, LavaApply } from "./DescentSections";
import { PickaxeCursor } from "./WorldMotion";
import { WorldLink, WorldTravel } from "./WorldTravel";
import ApplicationPage from "./ApplicationPage";
import { NetherEntrance } from "./Exploration";
import { Story, useStory } from "./Story";
import { SceneDepth } from "./SceneDepth";
import { chapterIndexOf, type Chapter } from "./chapters";
import "./minecraft.css";
import "./descent.css";
import "./layers.css";
import "./dimensions.css";
import "./exploration.css";
import "./story.css";
import "./scene-depth.css";

const home = "/minecraft";

function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setMenuOpen(false); }, [location]);
  return <header className="mc-nav">
    <Link to={home} className="mc-brand" aria-label="DataHacks home"><span className="mc-brand-icon" aria-hidden="true">D</span><span>DATAHACKS<span className="mc-brand-version"> 2.0</span></span></Link>
    <nav aria-label="Main navigation" className={menuOpen ? "mc-links is-open" : "mc-links"} id="mc-navigation">
      <Link to={`${home}/about`} onClick={() => setMenuOpen(false)}>The world</Link>
      <Link to={`${home}/tracks`} onClick={() => setMenuOpen(false)}>Tracks</Link>
      <WorldLink to={`${home}/mentors`} kind="trial" onClick={() => setMenuOpen(false)} aria-current={location.pathname.endsWith("mentors") ? "page" : undefined}>Mentors & judges</WorldLink>
      <WorldLink to={`${home}/schedule`} kind="portal" onClick={() => setMenuOpen(false)} aria-current={location.pathname.endsWith("schedule") ? "page" : undefined}>Run of show <span className="mc-nav-portal" aria-hidden="true">↗</span></WorldLink>
      <Link to={`${home}/faq`} onClick={() => setMenuOpen(false)}>FAQ</Link>
    </nav>
    <WorldLink to={`${home}/apply`} kind="end" className="mc-button mc-button-small" onClick={() => setMenuOpen(false)}>Join the adventure <ArrowUpRight size={16} /></WorldLink>
    <button className="mc-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="mc-navigation" onClick={() => setMenuOpen(!menuOpen)} onKeyDown={event => { if (event.key === "Escape") setMenuOpen(false); }}>{menuOpen ? <X /> : <Menu />}</button>
  </header>;
}


function Hero() {
  const { go } = useStory();
  const next = () => go(1);
  return <div className="mc-hero mc-cherry-hero">
    <div className="mc-hero-image mc-hero-cherry-image" aria-hidden="true" /><div className="mc-hero-shade" aria-hidden="true" />
    <div className="mc-hero-content">
      <p className="mc-eyebrow mc-hero-eyebrow">DS3 PRESENTS · A NEW WORLD OF POSSIBILITIES</p>
      <div className="mc-title-wrap"><h1 id="mc-title">DATA<span>HACKS</span></h1><span className="mc-edition">THE 2.0 UPDATE</span></div>
      <p className="mc-hero-tagline">Big ideas. Infinite possibilities. One world to build.</p>
      <p className="mc-hero-date">JANUARY 16–17, 2027 <span>✦</span> 36 HOURS <span>✦</span> IN PERSON</p>
      <div className="mc-hero-actions"><WorldLink to={`${home}/apply`} kind="end" className="mc-button">Start your adventure <ArrowUpRight size={19} /></WorldLink><button type="button" className="mc-button mc-button-stone" onClick={next}>About the event <ArrowDown size={17} /></button></div>
      <p className="mc-hero-note">All experience levels. No diamonds required.</p>
    </div>
    <div className="mc-hero-bottom"><span>BIOME: CHERRY GROVE<br />Y: +80 · THE SURFACE</span><span>SEED: 01162027<br />GAME MODE: COLLABORATIVE</span></div>
  </div>;
}

/** What each chapter shows. Order, routing and depth labels live in chapters.ts. */
const BODIES: Record<string, ReactNode> = {
  hero: <Hero />,
  about: <About />,
  tracks: <Tracks />,
  sponsors: <Sponsors />,
  speakers: <Speakers />,
  prizes: <Prizes />,
  trials: <TrialEntrance />,
  faq: <SculkFaq />,
  stronghold: <LavaApply />,
  end: <ApplicationPage />,
};

/** Side trips. They anchor to the chapter, not its content, so they never push the
 * chapter past the viewport. */
const DOORS: Record<string, ReactNode> = {
  tracks: <NetherEntrance />,
};

function HomePage() {
  return <Story>{chapter => <ChapterFrame chapter={chapter} />}</Story>;
}

/** The backdrop is now one continuous shaft owned by Story, and the depth rail
 * replaces the per-chapter label, so a chapter is just its content. */
function ChapterFrame({ chapter }: { chapter: Chapter }) {
  return <>
    <div className="mc-chapter-body">{BODIES[chapter.id]}</div>
    {chapter.id === "hero" && <SceneDepth chapter={chapter} />}
    {DOORS[chapter.id]}
    {chapter.id === "end" && <Credits />}
  </>;
}

function NetherPage() {
  return <div className="mc-nether-page">
    <img className="mc-dimension-art" src="/images/minecraft/dimensions/nether-schedule.webp" alt="" width="1536" height="1024" {...{ fetchpriority: "high" }} />
    <div className="mc-container mc-nether-heading"><div><Link to={home} className="mc-dimension-back">← Return to the overworld</Link><p className="mc-eyebrow">DIMENSION 02 / THE NETHER</p><h1 tabIndex={-1}>Things are<br />heating <em>up.</em></h1><p>Your run of show. Two days of building, learning,<br className="mc-desktop-break" /> and making something worth staying up for.</p><span className="mc-nether-date">JANUARY 16–17, 2027 · PACIFIC TIME</span></div><a href="#schedule" className="mc-nether-portal-link" aria-label="Step through to the run of show"><PortalFrame /><span>Explore the run of show ↓</span></a></div>
    <Schedule />
    <div className="mc-nether-residents" aria-label="Zombified piglins guarding the Nether"><img src="/images/minecraft/exploration/zombified-piglin.png" alt="Zombified piglin with a golden sword" width="520" height="880" loading="lazy" /><p>Keep your gold close.<br /><span>You’re in their world now.</span></p><img src="/images/minecraft/exploration/zombified-piglin.png" alt="" width="520" height="880" loading="lazy" /></div>
    <div className="mc-container mc-nether-foot"><span>Keep your inventory close. Adventure awaits.</span><WorldLink to={`${home}/apply`} kind="end" className="mc-button">Join the adventure <ArrowUpRight size={17} /></WorldLink></div>
  </div>;
}

/** The old footer. With no scroll there is nowhere to put it but the last chapter,
 * which suits the End-credits framing. */
function Credits() {
  return <footer className="mc-credits" aria-label="DataHacks credits">
    <div><Link to={home} className="mc-brand">DATAHACKS 2.0</Link><p>January 16–17, 2027 · Organized by DS3</p></div>
    <nav aria-label="Footer navigation"><Link to={`${home}/about`}>About</Link><Link to={`${home}/tracks`}>Tracks</Link><WorldLink to={`${home}/mentors`} kind="trial">Mentors</WorldLink><WorldLink to={`${home}/schedule`} kind="portal">Run of show</WorldLink><Link to={`${home}/faq`}>FAQ</Link></nav>
    <div className="mc-void-contact"><a href="mailto:info@ds3.club">info@ds3.club</a><Link to={home}>Back to spawn ↑</Link><small>© 2027 DS3</small></div>
  </footer>;
}

export default function Minecraft() {
  const location = useLocation();
  const page = location.pathname.endsWith("schedule") ? "nether" : location.pathname.endsWith("apply") ? "application" : location.pathname.endsWith("mentors") ? "trial" : "overworld";
  // Only the two doors are their own pages. Everything else is a story chapter, and
  // Story resolves which one from the pathname. The viewport lock rides on the
  // chapter routes alone — the doors are ordinary pages and scroll.
  const locked = location.pathname === "/" || chapterIndexOf(location.pathname) !== -1;
  return <div className={`minecraft-root mc-world-${page}${locked ? " mc-locked" : ""}`} id="top"><WorldTravel><a className="mc-skip" href="#mc-main">Skip to content</a><Navigation /><main id="mc-main"><Routes><Route path="schedule" element={<NetherPage />} /><Route path="mentors" element={<TrialChambersPage />} /><Route path="*" element={<HomePage />} /></Routes></main><PickaxeCursor /></WorldTravel></div>;
}
