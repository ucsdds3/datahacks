import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { About, Challenges, Tracks, Prizes, Schedule, Sponsors } from "./WorldSections";
import { PortalFrame } from "./PortalFrame";
import TrialChambersPage from "./TrialChambers";
import { Speakers, SculkFaq } from "./DescentSections";
import { PickaxeCursor } from "./WorldMotion";
import { WorldLink, WorldTravel } from "./WorldTravel";
import ApplicationPage from "./ApplicationPage";
import { Story } from "./Story";
import { SceneDepth } from "./SceneDepth";
import { ApplyButton } from "./ApplyButton";
import { chapterIndexOf, type Chapter } from "./chapters";
import "./minecraft.css";
import "./descent.css";
import "./layers.css";
import "./dimensions.css";
import "./exploration.css";
import "./story.css";
import "./scene-depth.css";

const home = "/datacraft";

/** The public site links to its own sections and to the two applications. The run
 * of show lives in the application portal; the door pages still open from old links. */
function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setMenuOpen(false); }, [location]);
  const close = () => setMenuOpen(false);
  return <header className="mc-nav">
    <Link to={home} className="mc-brand" aria-label="DataHacks home"><span className="mc-brand-icon" aria-hidden="true">D</span><span>DATAHACKS<span className="mc-brand-version"> 2.0</span></span></Link>
    <nav aria-label="Main navigation" className={menuOpen ? "mc-links is-open" : "mc-links"} id="mc-navigation">
      <Link to={`${home}/about`} onClick={close}>The world</Link>
      <Link to={`${home}/tracks`} onClick={close}>Tracks</Link>
      <Link to={`${home}/challenges`} onClick={close}>Challenges</Link>
      <Link to={`${home}/prizes`} onClick={close}>Prizes</Link>
      <Link to={`${home}/faq`} onClick={close}>FAQ</Link>
      <ApplyButton as="staff" className="mc-nav-apply-menu" onClick={close}>Apply to mentor or judge</ApplyButton>
    </nav>
    <div className="mc-nav-apply">
      <ApplyButton as="staff" className="mc-button mc-button-small mc-button-stone mc-nav-apply-staff" onClick={close}>Apply to mentor or judge</ApplyButton>
      <ApplyButton as="hacker" className="mc-button mc-button-small" onClick={close}>Apply as a hacker <ArrowRight size={16} /></ApplyButton>
    </div>
    <button className="mc-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="mc-navigation" onClick={() => setMenuOpen(!menuOpen)} onKeyDown={event => { if (event.key === "Escape") setMenuOpen(false); }}>{menuOpen ? <X /> : <Menu />}</button>
  </header>;
}


function Hero() {
  return <div className="mc-hero mc-cherry-hero">
    <div className="mc-hero-image mc-hero-cherry-image" aria-hidden="true" /><div className="mc-hero-shade" aria-hidden="true" />
    <div className="mc-hero-content">
      <p className="mc-eyebrow mc-hero-eyebrow">DS3 PRESENTS · A NEW WORLD OF POSSIBILITIES</p>
      <div className="mc-title-wrap"><h1 id="mc-title">DATA<span>HACKS</span></h1><span className="mc-edition">THE 2.0 UPDATE</span></div>
      <p className="mc-hero-tagline">Big ideas. Infinite possibilities. One world to build.</p>
      <p className="mc-hero-date">JANUARY 16–17, 2027 <span>✦</span> 36 HOURS <span>✦</span> IN PERSON</p>
      <div className="mc-hero-actions"><ApplyButton as="hacker">Apply as a hacker <ArrowRight size={19} /></ApplyButton><ApplyButton as="staff" className="mc-button mc-button-stone">Apply to mentor or judge <ArrowRight size={17} /></ApplyButton></div>
      <p className="mc-hero-note">All experience levels. No diamonds required.</p>
    </div>
    <div className="mc-hero-bottom"><span>BIOME: THE OVERWORLD<br />Y: +80 · THE SURFACE</span><span>SEED: 01162027<br />GAME MODE: COLLABORATIVE</span></div>
  </div>;
}

/** What each chapter shows. Order, routing and depth labels live in chapters.ts. */
const BODIES: Record<string, ReactNode> = {
  hero: <Hero />,
  about: <About />,
  tracks: <Tracks />,
  challenges: <Challenges />,
  prizes: <Prizes />,
  sponsors: <Sponsors />,
  speakers: <Speakers />,
  faq: <SculkFaq />,
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
    {chapter.id === "faq" && <Credits />}
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

/** `/datacraft/apply`: the hacker application, on its own page with the End
 * backdrop. Reached from old links; the site's buttons go straight to Google. */
function EndPage() {
  return <div className="mc-end-page mc-dimension-page mc-application-page">
    <img className="mc-dimension-art" src="/images/minecraft/dimensions/end-application.webp" alt="" width="1536" height="1024" {...{ fetchpriority: "high" }} />
    <div className="mc-container mc-application-layout">
      <aside className="mc-application-intro">
        <Link to={home} className="mc-dimension-back">← Return to the overworld</Link>
        <p className="mc-eyebrow">THE END</p>
        <h1 tabIndex={-1}>A new world.<br /><em>Your next adventure.</em></h1>
        <p>Bring your curiosity. We’ll help you find the rest.</p>
        <dl>
          <div><dt>WHEN</dt><dd>January 16–17, 2027</dd></div>
          <div><dt>PARTY SIZE</dt><dd>Up to 4 hackers</dd></div>
          <div><dt>ENTRY FEE</dt><dd>Free. Always.</dd></div>
        </dl>
      </aside>
      <ApplicationPage />
    </div>
  </div>;
}

/** Bedrock: the footer under the FAQ, at the very bottom of the descent. */
const CONTACTS = [
  { label: "info@ds3.club", href: "mailto:info@ds3.club" },
  { label: "DS3 website", href: "https://www.ds3atucsd.com/" },
  { label: "Instagram", href: "https://www.instagram.com/ds3atucsd/" },
  { label: "LinkedIn", href: "https://linkedin.com/company/data-science-student-society-at-ucsd/" },
  { label: "Discord", href: "https://discord.gg/z7KNvSGCvF" },
];

function Credits() {
  return <footer className="mc-credits mc-bedrock-footer" aria-label="DataHacks footer">
    <div className="mc-bedrock-band" aria-hidden="true" />
    <div className="mc-bedrock-row">
      <div><Link to={home} className="mc-brand">DATAHACKS 2.0</Link><p>January 16–17, 2027 · Organized by the Data Science Student Society at UC San Diego</p></div>
      <nav aria-label="Footer navigation"><Link to={`${home}/about`}>About</Link><Link to={`${home}/tracks`}>Tracks</Link><Link to={`${home}/challenges`}>Challenges</Link><Link to={`${home}/prizes`}>Prizes</Link><Link to={`${home}/sponsors`}>Sponsors</Link><Link to={`${home}/speakers`}>Speakers</Link><Link to={`${home}/faq`}>FAQ</Link></nav>
      <nav aria-label="Contact DS3" className="mc-bedrock-contacts">{CONTACTS.map(c => <a key={c.label} href={c.href} {...(c.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>{c.label}</a>)}</nav>
      <div className="mc-void-contact"><Link to={home}>Back to spawn ↑</Link><small>© 2027 DS3</small></div>
    </div>
  </footer>;
}

export default function Minecraft() {
  const location = useLocation();
  const page = location.pathname.endsWith("schedule") ? "nether" : location.pathname.endsWith("apply") ? "application" : location.pathname.endsWith("mentors") ? "trial" : "overworld";
  // The door pages (schedule, mentors, apply) are ordinary scrolling pages; every
  // other path is a story chapter, resolved by Story from the pathname. The viewport
  // lock rides on the chapter routes alone.
  const locked = location.pathname === "/" || chapterIndexOf(location.pathname) !== -1;
  return <div className={`minecraft-root mc-world-${page}${locked ? " mc-locked" : ""}`} id="top"><WorldTravel><a className="mc-skip" href="#mc-main">Skip to content</a><Navigation /><main id="mc-main"><Routes><Route path="schedule" element={<NetherPage />} /><Route path="mentors" element={<TrialChambersPage />} /><Route path="apply" element={<EndPage />} /><Route path="trials" element={<Navigate to={`${home}/mentors`} replace />} /><Route path="stronghold" element={<Navigate to={`${home}/apply`} replace />} /><Route path="*" element={<HomePage />} /></Routes></main><PickaxeCursor /></WorldTravel></div>;
}
