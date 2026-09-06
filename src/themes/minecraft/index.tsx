import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ArrowDown, ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { About, Tracks, Prizes, Schedule, Sponsors, Faq } from "./WorldSections";
import { PixelBackdrop, PixelSprite } from "./PixelWorld";
import { BiomeScene } from "./BiomeScenes";
import { PickaxeCursor } from "./WorldMotion";
import { WorldLink, WorldTravel } from "./WorldTravel";
import ApplicationPage from "./ApplicationPage";
import "./minecraft.css";
import "./descent.css";

const home = "/minecraft";
const layers = [
  { id: "emerald-layer", name: "Cobble & emerald", y: "+48", color: "#85c5a0" },
  { id: "iron-layer", name: "Iron & coal", y: "+16", color: "#c6a491" },
  { id: "gold-layer", name: "Gold & redstone", y: "−16", color: "#dcb665" },
  { id: "diamond-layer", name: "Diamond & deepslate", y: "−48", color: "#8bccd0" },
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
      <WorldLink to={`${home}/schedule`} kind="portal" onClick={() => setMenuOpen(false)} aria-current={location.pathname.endsWith("schedule") ? "page" : undefined}>Run of show <span className="mc-nav-portal" aria-hidden="true">↗</span></WorldLink>
      <Link to={`${home}#faq`} onClick={() => setMenuOpen(false)}>FAQ</Link>
    </nav>
    <WorldLink to={`${home}/apply`} kind="creeper" className="mc-button mc-button-small" onClick={() => setMenuOpen(false)}>Join the adventure <ArrowUpRight size={16} /></WorldLink>
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
          y = Math.round(64 - index * 32 - Math.max(0, Math.min(1, (probe - box.top) / box.height)) * 32);
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
  return <div className="mc-layer-label mc-container"><span>Y {layer.y}</span><i aria-hidden="true" style={{ background: layer.color }} /><span>{layer.name}</span><span className="mc-layer-number">0{index + 1} / 04</span></div>;
}

function HomePage() {
  return <>
    <DepthMeter />
    <section className="mc-hero mc-cherry-hero" aria-labelledby="mc-title">
      <PixelBackdrop kind="surface" />
      <div className="mc-hero-content">
        <p className="mc-eyebrow mc-hero-eyebrow">DS3 PRESENTS · A NEW WORLD OF POSSIBILITIES</p>
        <div className="mc-title-wrap"><h1 id="mc-title" tabIndex={-1}>DATA<span>HACKS</span></h1><span className="mc-edition">THE 2.0 UPDATE</span><span className="mc-splash">Dig a little deeper!</span></div>
        <p className="mc-hero-tagline">Big ideas. Infinite possibilities. One world to build.</p>
        <p className="mc-hero-date">JANUARY 16–17, 2027 <span>✦</span> 36 HOURS <span>✦</span> IN PERSON</p>
        <div className="mc-hero-actions"><WorldLink to={`${home}/apply`} kind="creeper" className="mc-button">Start your adventure <ArrowUpRight size={19} /></WorldLink><a href="#emerald-layer" className="mc-button mc-button-stone">Dig a little deeper <ArrowDown size={17} /></a></div>
        <p className="mc-hero-note">All experience levels. No diamonds required.</p>
      </div>
      <div className="mc-hero-bottom"><span>BIOME: CHERRY GROVE<br />Y: +80 · THE SURFACE</span><a href="#emerald-layer">YOUR ADVENTURE CONTINUES BELOW <ArrowDown size={16} /></a><span>SEED: 01162027<br />GAME MODE: COLLABORATIVE</span></div>
    </section>
    <div className="mc-underground">
      <PixelBackdrop kind="cave" />
      <div className="mc-depth-layer mc-layer-emerald" id="emerald-layer" data-layer>
        <LayerLabel index={0} /><BiomeScene kind="grove" /><About />
        <div className="mc-descent-pause" aria-hidden="true"><span>THERE’S MORE BENEATH THE SURFACE</span><ArrowDown size={20} /></div>
      </div>
      <div className="mc-depth-layer mc-layer-iron" id="iron-layer" data-layer>
        <LayerLabel index={1} /><BiomeScene kind="mineshaft" /><Tracks />
        <div className="mc-descent-pause" aria-hidden="true"><span>A LITTLE CURIOSITY GOES A LONG WAY DOWN</span><ArrowDown size={20} /></div>
      </div>
      <div className="mc-depth-layer mc-layer-gold" id="gold-layer" data-layer>
        <LayerLabel index={2} /><BiomeScene kind="sulfur" /><Sponsors />
        <div className="mc-descent-pause" aria-hidden="true"><span>THE BEST DISCOVERIES TAKE A LITTLE DIGGING</span><ArrowDown size={20} /></div>
      </div>
      <div className="mc-depth-layer mc-layer-diamond" id="diamond-layer" data-layer>
        <LayerLabel index={3} /><BiomeScene kind="ancient" /><Prizes /><Faq />
        <div className="mc-world-crossroads mc-container">
          <p className="mc-eyebrow">YOU’VE REACHED DEEPSLATE</p><h2>One world explored.<br /><em>Two adventures ahead.</em></h2>
          <div className="mc-crossroads-grid">
            <WorldLink to={`${home}/schedule`} kind="portal" className="mc-world-door mc-door-nether"><PixelSprite kind="portal" /><div><span>ENTER THE NETHER</span><h3>The run of show</h3><p>Your whole weekend, through the portal.</p><b>Step through <ArrowRight size={17} /></b></div></WorldLink>
            <WorldLink to={`${home}/apply`} kind="creeper" className="mc-world-door mc-door-apply"><PixelSprite kind="creeper" /><div><span>MAKE AN ENTRANCE</span><h3>Your next chapter</h3><p>Big ideas tend to make a little noise.</p><b>Open application <ArrowRight size={17} /></b></div></WorldLink>
          </div>
          <a href="#top" className="mc-return-surface">↑ Back to the cherry grove</a>
        </div>
      </div>
    </div>
  </>;
}

function NetherPage() {
  return <div className="mc-nether-page">
    <PixelBackdrop kind="nether" />
    <div className="mc-container mc-nether-heading"><div><Link to={home} className="mc-dimension-back">← Return to the overworld</Link><p className="mc-eyebrow">DIMENSION 02 / THE NETHER</p><h1 tabIndex={-1}>Things are<br />heating <em>up.</em></h1><p>Your run of show. Two days of building, learning,<br className="mc-desktop-break" /> and making something worth staying up for.</p><span className="mc-nether-date">JANUARY 16–17, 2027 · PACIFIC TIME</span></div><PixelSprite kind="portal" animated className="mc-nether-portal" /></div>
    <Schedule />
    <div className="mc-container mc-nether-foot"><span>Keep your inventory close. Adventure awaits.</span><WorldLink to={`${home}/apply`} kind="creeper" className="mc-button">Join the adventure <ArrowUpRight size={17} /></WorldLink></div>
  </div>;
}

function Footer() {
  return <footer className="mc-footer"><div className="mc-container"><div className="mc-footer-top"><Link to={home} className="mc-brand">DATAHACKS 2.0</Link><p>A world of ideas, crafted together.</p><Link to={`${home}#top`} className="mc-back-top">Back to spawn ↑</Link></div><div className="mc-footer-links"><p>Organized by DS3<br /><span>Data Science Student Society</span></p><nav aria-label="Footer navigation"><Link to={`${home}#about`}>About</Link><Link to={`${home}#tracks`}>Tracks</Link><Link to={`${home}#prizes`}>Prizes</Link><WorldLink to={`${home}/schedule`} kind="portal">Run of show</WorldLink><WorldLink to={`${home}/apply`} kind="creeper">Apply</WorldLink><Link to={`${home}#faq`}>FAQ</Link></nav><a href="mailto:hello@ds3ucsd.com">hello@ds3ucsd.com</a></div><div className="mc-footer-fine"><p>© 2027 DS3 · Concept preview · Not a live registration page.<br />Unofficial Minecraft-inspired design. Not affiliated with Mojang or Microsoft.</p><Link to="/themes">← All theme mockups</Link></div></div></footer>;
}

export default function Minecraft() {
  const location = useLocation();
  const page = location.pathname.endsWith("schedule") ? "nether" : location.pathname.endsWith("apply") ? "application" : "overworld";
  return <div className={`minecraft-root mc-world-${page}`} id="top"><WorldTravel><a className="mc-skip" href="#mc-main">Skip to content</a><Navigation /><main id="mc-main"><Routes><Route index element={<HomePage />} /><Route path="schedule" element={<NetherPage />} /><Route path="apply" element={<ApplicationPage />} /><Route path="*" element={<Navigate to={home} replace />} /></Routes></main><Footer /><PickaxeCursor /></WorldTravel></div>;
}
