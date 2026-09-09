import { createContext, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PortalFrame } from "./PortalFrame";
import { WorldLink } from "./WorldTravel";

type Encounter = { target: string; kind: "skeleton" | "dig" | "chest"; label: string; destination: string };
const JourneyContext = createContext<{ active: string | null; enter: (encounter: Encounter) => void }>({ active: null, enter: () => {} });

/** Optional discoveries use the same hash destinations as ordinary page navigation. */
export function ExplorationJourney({ children }: { children: ReactNode }) {
  const [trip, setTrip] = useState<Encounter | null>(null);
  const [phase, setPhase] = useState("encounter");
  const content = useRef<HTMLDivElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const finish = useRef<() => void>(() => {});

  const jump = (target: string) => {
    navigate(`${location.pathname}#${target}`);
    document.getElementById(target)?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!trip) return;
    const overflow = document.body.style.overflow;
    const scroll = document.documentElement.style.scrollBehavior;
    const contentElement = content.current;
    document.body.style.overflow = "hidden";
    document.documentElement.style.scrollBehavior = "auto";
    contentElement?.setAttribute("inert", "");
    skip.current?.focus({ preventScroll: true });
    let arrived = false;
    const arrive = () => {
      if (arrived) return;
      arrived = true;
      navigate(`${location.pathname}#${trip.target}`);
      document.getElementById(trip.target)?.scrollIntoView({ behavior: "instant", block: "start" });
    };
    finish.current = () => { arrive(); setTrip(null); };
    const cover = window.setTimeout(() => setPhase("covered"), 420);
    const transfer = window.setTimeout(() => { arrive(); setPhase("arrived"); }, 780);
    const done = window.setTimeout(() => setTrip(null), 1150);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish.current();
      if (event.key === "Tab") { event.preventDefault(); skip.current?.focus(); }
    };
    window.addEventListener("keydown", key);
    return () => {
      [cover, transfer, done].forEach(clearTimeout);
      document.body.style.overflow = overflow;
      document.documentElement.style.scrollBehavior = scroll;
      contentElement?.removeAttribute("inert");
      window.removeEventListener("keydown", key);
      document.getElementById(trip.target)?.focus({ preventScroll: true });
    };
  }, [trip, navigate, location.pathname]);

  const enter = (encounter: Encounter) => {
    if (trip || !document.getElementById(encounter.target)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { jump(encounter.target); return; }
    setPhase("encounter"); setTrip(encounter);
  };

  return <JourneyContext.Provider value={{ active: trip?.target ?? null, enter }}>
    <div ref={content}>{children}</div>
    {trip && <div className={`mc-discovery-travel is-${phase}`} role="dialog" aria-modal="true" aria-label={`Exploring ${trip.destination}`}>
      <div className="mc-discovery-cover" aria-hidden="true" />
      <div className="mc-discovery-caption" role="status"><small>PATH DISCOVERED</small><strong>{trip.destination}</strong></div>
      <button ref={skip} onClick={() => finish.current()} className="mc-travel-skip">Continue now →</button>
    </div>}
  </JourneyContext.Provider>;
}

export function EncounterLink({ target, kind, label, destination }: Encounter) {
  const { active, enter } = useContext(JourneyContext);
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); enter({ target, kind, label, destination });
  };
  const image = kind === "skeleton" ? "/images/minecraft/exploration/skeleton.png" : kind === "chest" ? "/images/minecraft/exploration/chest-minecart.png" : "/images/minecraft/textures/stone.png";
  return <a href={`#${target}`} onClick={onClick} className={`mc-encounter mc-encounter-${kind} ${active === target ? "is-discovered" : ""}`} data-mineable aria-label={`${label} — explore ${destination}`}>
    <span className="mc-encounter-object" aria-hidden="true"><img src={image} alt="" loading="lazy" decoding="async" />{kind === "chest" && <img className="mc-chest-lid" src={image} alt="" />}{kind === "dig" && <span className="mc-crack" />}</span>
    <span className="mc-encounter-label"><small>EXPLORE DEEPER</small><strong>{label} <span aria-hidden="true">↓</span></strong><span>{destination}</span></span>
  </a>;
}

export function NetherEntrance() {
  return <div className="mc-track-nether">
    <div><p className="mc-eyebrow">A DETOUR THROUGH THE NETHER</p><h3>Your weekend awaits.</h3><p>Workshops, building time, and the final demo.<br />Find your next quest in the run of show.</p></div>
    <WorldLink to="/minecraft/schedule" kind="portal" className="mc-track-nether-door" data-mineable aria-label="Enter the Nether — run of show"><PortalFrame /><span>Enter the Nether <span aria-hidden="true">↗</span></span><small>Run of show</small></WorldLink>
  </div>;
}
