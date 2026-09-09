import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ArrowDown, ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { About, Tracks, Prizes, Schedule, Sponsors } from "./WorldSections";
import { PortalFrame } from "./PortalFrame";
import TrialChambersPage, { TrialEntrance } from "./TrialChambers";
import { Speakers, SculkFaq, LavaApply } from "./DescentSections";
import { PickaxeCursor } from "./WorldMotion";
import { WorldLink, WorldTravel } from "./WorldTravel";
import ApplicationPage from "./ApplicationPage";
import { EncounterLink, ExplorationJourney, NetherEntrance } from "./Exploration";
import "./minecraft.css";
import "./descent.css";
import "./layers.css";
import "./dimensions.css";
import "./exploration.css";

const home = "/minecraft";
const layers = [
  { id: "emerald-layer", name: "Stone, coal & copper", y: "+48", color: "#d5aa87" },
  { id: "iron-layer", name: "Iron & redstone", y: "+24", color: "#cfae9c" },
  { id: "gold-layer", name: "Sulfur cavern", y: "+08", color: "#e7d88b" },
  { id: "mineshaft-layer", name: "The mineshaft", y: "−08", color: "#cfa873" },
  { id: "diamond-layer", name: "Deepslate ores", y: "−28", color: "#98d4d8" },
  { id: "trial-layer", name: "Trial chambers", y: "−36", color: "#b57853" },
  { id: "sculk-layer", name: "Ancient city", y: "−44", color: "#8acbc4" },
  { id: "lava-layer", name: "The stronghold", y: "−56", color: "#f0b175" },
];

function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setMenuOpen(false); }, [location]);
  return <header className="mc-nav">
    <Link to={home} className="mc-brand" aria-label="DataHacks home"><span className="mc-brand-icon" aria-hidden="true">D</span><span>DATAHACKS<span className="mc-brand-version"> 2.0</span></span></Link>
    <nav aria-label="Main navigation" className={menuOpen ? "mc-links is-open" : "mc-links"} id="mc-navigation">
      <Link to={`${home}#about`} onClick={() => setMenuOpen(false)}>The world</Link>
      <Link to={`${home}#tracks`} onClick={() => setMenuOpen(false)}>Tracks</Link>
      <WorldLink to={`${home}/mentors`} kind="trial" onClick={() => setMenuOpen(false)} aria-current={location.pathname.endsWith("mentors") ? "page" : undefined}>Mentors & judges</WorldLink>
      <WorldLink to={`${home}/schedule`} kind="portal" onClick={() => setMenuOpen(false)} aria-current={location.pathname.endsWith("schedule") ? "page" : undefined}>Run of show <span className="mc-nav-portal" aria-hidden="true">↗</span></WorldLink>
      <Link to={`${home}#faq`} onClick={() => setMenuOpen(false)}>FAQ</Link>
    </nav>
    <WorldLink to={`${home}/apply`} kind="end" className="mc-button mc-button-small" onClick={() => setMenuOpen(false)}>Join the adventure <ArrowUpRight size={16} /></WorldLink>
    <button className="mc-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="mc-navigation" onClick={() => setMenuOpen(!menuOpen)} onKeyDown={event => { if (event.key === "Escape") setMenuOpen(false); }}>{menuOpen ? <X /> : <Menu />}</button>
  </header>;
}

function DepthMeter() {
  const [depth, setDepth] = useState({ layer: -1, y: 80 });
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const probe = window.innerHeight * .45;
      let current = -1;
      let y = 80;
      layers.forEach((layer, index) => {
        const element = document.getElementById(layer.id);
        if (!element) return;
        const box = element.getBoundingClientRect();
        if (box.top <= probe) {
          current = index;
          y = Math.round(Number(layer.y.replace("−", "-")) - Math.max(0, Math.min(1, (probe - box.top) / box.height)) * 12);
        }
      });
      setDepth(previous => previous.layer === current && previous.y === y ? previous : { layer: current, y });
    };
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);
  return <nav className={`mc-depth-meter ${depth.layer >= 0 ? "is-underground" : ""}`} aria-label="World layers">
    <span className="mc-depth-coordinate" aria-hidden="true">Y {depth.y > 0 ? "+" : ""}{depth.y}</span>
    <a href="#top" aria-label="Cherry grove surface" aria-current={depth.layer === -1 ? "location" : undefined}><i style={{ background: "#e1aac5" }} /><span>Cherry grove</span></a>
    {layers.map((layer, i) => <a key={layer.id} href={`#${layer.id}`} aria-label={layer.name} aria-current={depth.layer === i ? "location" : undefined}><i style={{ background: layer.color }} /><span>{layer.name}</span></a>)}
    <span className="mc-depth-bottom" aria-hidden="true">↓</span>
  </nav>;
}

function LayerLabel({ index }: { index: number }) {
  const layer = layers[index];
  return <div className="mc-layer-label mc-container"><span>Y {layer.y}</span><i aria-hidden="true" style={{ background: layer.color }} /><span>{layer.name}</span><span className="mc-layer-number">0{index + 1} / 0{layers.length}</span></div>;
}

function HomePage() {
  return <ExplorationJourney>
    <DepthMeter />
    <section className="mc-hero mc-cherry-hero" aria-labelledby="mc-title">
      <div className="mc-hero-image mc-hero-cherry-image" aria-hidden="true" /><div className="mc-hero-shade" aria-hidden="true" />
      <div className="mc-hero-content">
        <p className="mc-eyebrow mc-hero-eyebrow">DS3 PRESENTS · A NEW WORLD OF POSSIBILITIES</p>
        <div className="mc-title-wrap"><h1 id="mc-title" tabIndex={-1}>DATA<span>HACKS</span></h1><span className="mc-edition">THE 2.0 UPDATE</span><span className="mc-splash">Dig a little deeper!</span></div>
        <p className="mc-hero-tagline">Big ideas. Infinite possibilities. One world to build.</p>
        <p className="mc-hero-date">JANUARY 16–17, 2027 <span>✦</span> 36 HOURS <span>✦</span> IN PERSON</p>
        <div className="mc-hero-actions"><WorldLink to={`${home}/apply`} kind="end" className="mc-button">Start your adventure <ArrowUpRight size={19} /></WorldLink><a href="#emerald-layer" className="mc-button mc-button-stone">Dig a little deeper <ArrowDown size={17} /></a></div>
        <p className="mc-hero-note">All experience levels. No diamonds required.</p>
      </div>
      <div className="mc-hero-bottom"><span>BIOME: CHERRY GROVE<br />Y: +80 · THE SURFACE</span><a href="#emerald-layer">YOUR ADVENTURE CONTINUES BELOW <ArrowDown size={16} /></a><span>SEED: 01162027<br />GAME MODE: COLLABORATIVE</span></div>
    </section>
    <div className="mc-underground mc-textured-descent">
      {[
        {asset:'01-about', cls:'about', content:<><About /><EncounterLink target="iron-layer" kind="skeleton" label="Clear the path" destination="Tracks · Iron & redstone" /></>},
        {asset:'02-tracks', cls:'tracks', content:<><Tracks /><NetherEntrance /></>},
        {asset:'03-sponsors', cls:'sponsors', content:<><Sponsors /><EncounterLink target="mineshaft-layer" kind="dig" label="Dig into the mineshaft" destination="Speakers · The mineshaft" /></>},
        {asset:'04-speakers', cls:'speakers', content:<><Speakers /><EncounterLink target="diamond-layer" kind="chest" label="Open the minecart chest" destination="Prizes · Deepslate ores" /></>},
        {asset:'05-prizes', cls:'prizes', content:<Prizes />},
        {asset:'trial-chamber-entrance', cls:'trials', content:<TrialEntrance />},
        {asset:'06-faq', cls:'faq', content:<SculkFaq />},
        {asset:'07-stronghold', cls:'apply', content:<LavaApply />},
      ].map((layer,i)=><div className={`mc-depth-layer mc-texture-layer mc-texture-${layer.cls}`} id={layers[i].id} tabIndex={-1} aria-label={layers[i].name} data-layer key={layer.asset}>
        <img className="mc-layer-art" src={`/images/minecraft/${layer.cls === 'trials' ? 'dimensions' : 'relief'}/${layer.asset}.webp`} width="1536" height="1024" alt="" loading="lazy" decoding="async" />
        <LayerLabel index={i} />{layer.content}
      </div>)}
    </div>
  </ExplorationJourney>;
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

function Footer() {
  return <footer className="mc-void-footer" aria-label="DataHacks footer">
    <div className="mc-container mc-void-footer-content">
      <div><Link to={home} className="mc-brand">DATAHACKS 2.0</Link><p>January 16–17, 2027 · Organized by DS3</p><p>Data Science Student Society</p></div>
      <nav aria-label="Footer navigation"><Link to={`${home}#about`}>About</Link><Link to={`${home}#tracks`}>Tracks</Link><WorldLink to={`${home}/mentors`} kind="trial">Mentors & judges</WorldLink><WorldLink to={`${home}/schedule`} kind="portal">Run of show</WorldLink><WorldLink to={`${home}/apply`} kind="end">Apply</WorldLink><Link to={`${home}#faq`}>FAQ</Link></nav>
      <div className="mc-void-contact"><a href="mailto:hello@ds3ucsd.com">hello@ds3ucsd.com</a><Link to={`${home}#top`}>Back to spawn ↑</Link><small>© 2027 DS3</small></div>
    </div>
  </footer>;
}

export default function Minecraft() {
  const location = useLocation();
  const page = location.pathname.endsWith("schedule") ? "nether" : location.pathname.endsWith("apply") ? "application" : location.pathname.endsWith("mentors") ? "trial" : "overworld";
  return <div className={`minecraft-root mc-world-${page}`} id="top"><WorldTravel><a className="mc-skip" href="#mc-main">Skip to content</a><Navigation /><main id="mc-main"><Routes><Route index element={<HomePage />} /><Route path="schedule" element={<NetherPage />} /><Route path="apply" element={<ApplicationPage />} /><Route path="mentors" element={<TrialChambersPage />} /><Route path="*" element={<Navigate to={home} replace />} /></Routes></main><Footer /><PickaxeCursor /></WorldTravel></div>;
}
