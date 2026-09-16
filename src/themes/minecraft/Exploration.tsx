import { createContext, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { PortalFrame } from "./PortalFrame";
import { WorldLink } from "./WorldTravel";

type Encounter = { target: string; kind: "skeleton" | "dig" | "chest"; label: string; destination: string };
const JourneyContext = createContext<{ active: string | null; enter: (encounter: Encounter) => void }>({ active: null, enter: () => {} });
const ease = [.22, 1, .36, 1] as const;

/** Move through the real document; wheel/touch always gives control back. */
export function ExplorationJourney({ children }: { children: ReactNode }) {
  const [trip, setTrip] = useState<Encounter | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const finish = useRef<() => void>(() => {});
  const origin = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!trip) return;
    const target = document.getElementById(trip.target);
    if (!target) { setTrip(null); return; }
    const previousBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    const start = window.scrollY;
    const end = Math.max(0, Math.min(start + target.getBoundingClientRect().top, document.documentElement.scrollHeight - window.innerHeight));
    let settled = false;
    const complete = () => {
      if (settled) return;
      settled = true;
      window.scrollTo(0, end);
      navigate(`${location.pathname}#${trip.target}`);
      target.focus({ preventScroll: true });
      setTrip(null);
    };
    const camera = animate(0, 1, {
      delay: .65, duration: 1.35, ease: [.65, 0, .2, 1],
      onUpdate: value => window.scrollTo(0, start + (end - start) * value),
      onComplete: complete,
    });
    finish.current = () => { camera.stop(); complete(); };
    const cancel = () => { settled = true; camera.stop(); setTrip(null); };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { cancel(); origin.current?.focus({ preventScroll: true }); }
      else if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", "Tab", " "].includes(event.key)) cancel();
    };
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("resize", cancel);
    window.addEventListener("keydown", key);
    return () => {
      camera.stop();
      document.documentElement.style.scrollBehavior = previousBehavior;
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("resize", cancel);
      window.removeEventListener("keydown", key);
    };
  }, [trip, navigate, location.pathname]);

  const enter = (encounter: Encounter) => {
    if (trip || !document.getElementById(encounter.target)) return;
    origin.current = document.activeElement as HTMLElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.getElementById(encounter.target)?.scrollIntoView({ behavior: "instant" });
      navigate(`${location.pathname}#${encounter.target}`);
      document.getElementById(encounter.target)?.focus({ preventScroll: true });
      return;
    }
    setTrip(encounter);
  };

  return <JourneyContext.Provider value={{ active: trip?.target ?? null, enter }}>
    {children}
    {trip && <><span className="sr-only" role="status">Exploring {trip.destination}</span><button className="mc-descent-skip" onClick={() => finish.current()}>Skip descent</button></>}
  </JourneyContext.Provider>;
}

function Minecart({ opened }: { opened: boolean }) {
  return <svg viewBox="0 0 160 150" className="mc-cart-art" aria-hidden="true" shapeRendering="crispEdges">
    <path fill="#182024" d="M16 90h124v38H16zM25 125h22v16H25zM114 125h22v16h-22z" />
    <path fill="#858b88" d="m12 88 20-12h96l20 12v38H12z" /><path fill="#b6bab1" d="M12 88h136v8H12z" />
    <path fill="#535d5e" d="M22 100h116v19H22z" /><path fill="#969e98" d="M28 103h104v4H28z" />
    <path fill="#362715" d="M36 48h88v42H36z" /><path fill="#976127" d="M42 52h76v32H42z" />
    <motion.g style={{ transformOrigin: "80px 48px" }} animate={{ y: opened ? -23 : 0, rotate: opened ? -12 : 0 }} transition={{ type: "spring", stiffness: 190, damping: 20 }}>
      <path fill="#362715" d="M32 25h96v30H32z" /><path fill="#c38b36" d="M38 29h84v19H38z" />
      <path fill="#e6b552" d="M38 29h84v5H38z" /><path fill="#705024" d="M48 29h6v19h-6zM107 29h6v19h-6z" />
      <path fill="#dae2d6" d="M76 44h10v15H76z" /><path fill="#7e8984" d="M80 48h3v7h-3z" />
    </motion.g>
    <path fill="#ced4c8" d="M18 101h4v4h-4zM138 101h4v4h-4z" />
  </svg>;
}

export function EncounterLink({ target, kind, label, destination }: Encounter) {
  const { active, enter } = useContext(JourneyContext);
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const discovered = active === target;
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); enter({ target, kind, label, destination });
  };
  return <motion.a href={`#${target}`} onClick={onClick} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)} className={`mc-encounter mc-encounter-${kind}`} data-mineable aria-label={`${label} — explore ${destination}`}>
    <span className="mc-encounter-scene" aria-hidden="true">
      <span className="mc-scene-floor" />
      <motion.span className="mc-scene-light" animate={{ opacity: discovered ? .85 : hovered ? .55 : .18, scale: discovered ? 1.2 : 1 }} transition={{ duration: .35 }} />
      {kind === "skeleton" && <motion.img className="mc-skeleton-art" src="/images/minecraft/exploration/skeleton.png" alt="" width="554" height="1024" loading="lazy" animate={discovered ? { x: [0, -8, 30, 60], y: [0, -4, 5, 28], rotate: [0, -5, 18, 80], opacity: [1, 1, 1, 0] } : { x: 0, y: 0, rotate: hovered && !reduced ? -4 : 0, opacity: 1 }} transition={{ duration: discovered ? .6 : .3, ease }} />}
      {kind === "dig" && <span className="mc-dig-face">{Array.from({ length: 9 }, (_, i) => <motion.span key={i} className="mc-dig-block" style={{ backgroundPosition: `${i % 3 * 40}% ${Math.floor(i / 3) * 40}%` }} animate={discovered ? { x: (i % 3 - 1) * 65, y: (Math.floor(i / 3) - 1) * 45 + 25, rotate: (i - 4) * 12, opacity: 0, scale: .6 } : { x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }} transition={{ delay: discovered ? .08 + Math.abs(i - 4) * .025 : 0, duration: .45, ease }} />)}<motion.span className="mc-dig-cracks" animate={{ opacity: hovered || discovered ? 1 : 0 }} /></span>}
      {kind === "chest" && <motion.span className="mc-cart-wrap" animate={discovered ? { x: [0, -6, 0, 35], y: [0, -3, 0, 0] } : { x: 0, y: hovered && !reduced ? -3 : 0 }} transition={{ duration: .65, ease }}><Minecart opened={discovered || (hovered && !reduced)} /></motion.span>}
      {Array.from({ length: 8 }, (_, i) => <motion.i key={i} className={`mc-scene-particle mc-scene-particle-${kind}`} initial={false} animate={discovered ? { x: Math.cos(i * 2.4) * (40 + i * 7), y: [-25, -65 - i * 4, 40], opacity: [0, 1, 0], rotate: i * 65, scale: [1, 1, .3] } : { x: 0, y: 0, opacity: 0, rotate: 0, scale: 1 }} transition={{ duration: .65, delay: i * .015, ease: "easeOut" }} />)}
      <motion.span className="mc-scene-crosshair" animate={{ opacity: hovered && !discovered ? 1 : 0, scale: hovered ? 1 : 1.3 }} transition={{ duration: .2 }} />
    </span>
    <span className="mc-encounter-label"><small>{kind === "skeleton" ? "A PATH WORTH TAKING" : kind === "dig" ? "SOMETHING LIES BELOW" : "A LITTLE DISCOVERY"}</small><strong>{label}<motion.span aria-hidden="true" animate={{ y: hovered && !reduced ? 3 : 0 }}>↓</motion.span></strong><span>{destination}</span></span>
  </motion.a>;
}

export function NetherEntrance() {
  const reduced = useReducedMotion();
  return <div className="mc-track-nether">
    <div><p className="mc-eyebrow">A DETOUR THROUGH THE NETHER</p><h3>Your weekend awaits.</h3><p>Workshops, building time, and the final demo.<br />Find your next quest in the run of show.</p></div>
    <motion.div whileHover={reduced ? undefined : { y: -4 }} transition={{ type: "spring", stiffness: 180, damping: 22 }}><WorldLink to="/minecraft/schedule" kind="portal" className="mc-track-nether-door" data-mineable aria-label="Enter the Nether — run of show"><PortalFrame /><span>Enter the Nether <span aria-hidden="true">↗</span></span><small>Run of show</small></WorldLink></motion.div>
  </div>;
}
