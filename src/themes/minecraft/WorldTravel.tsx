import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useLocation, useNavigate, type LinkProps } from "react-router-dom";
import { PixelSprite } from "./PixelWorld";

type Trip = { to: string; kind: "portal" | "creeper" };
const TravelContext = createContext<(trip: Trip) => void>(() => {});

export function WorldTravel({ children }: { children: ReactNode }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const skip = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const completed = useRef(false);

  const arrive = useCallback(() => {
    if (!trip) return;
    if (!completed.current) { completed.current = true; navigate(trip.to); }
    setTrip(null);
  }, [trip, navigate]);

  useEffect(() => {
    const heading = document.querySelector<HTMLElement>("#mc-main h1");
    document.title = location.pathname.endsWith("schedule") ? "Run of show · DataHacks 2.0" : location.pathname.endsWith("apply") ? "Application preview · DataHacks 2.0" : "DataHacks 2.0 · Crafted Together";
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    else { window.scrollTo(0, 0); heading?.focus({ preventScroll: true }); }
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!trip) return;
    completed.current = false;
    const bodyOverflow = document.body.style.overflow;
    const contentElement = content.current;
    document.body.style.overflow = "hidden";
    contentElement?.setAttribute("inert", "");
    skip.current?.focus();
    const timer = window.setTimeout(arrive, 1850);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") arrive(); };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = bodyOverflow;
      contentElement?.removeAttribute("inert");
      window.removeEventListener("keydown", onKey);
    };
  }, [trip, arrive]);

  useEffect(() => {
    if (!trip) document.querySelector<HTMLElement>("#mc-main h1")?.focus({ preventScroll: true });
  }, [trip]);

  const depart = (next: Trip) => {
    if (trip) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) navigate(next.to);
    else setTrip(next);
  };

  return <TravelContext.Provider value={depart}>
    <div ref={content}>{children}</div>
    {trip && <div className={`mc-travel mc-travel-${trip.kind}`} role="dialog" aria-modal="true" aria-label={trip.kind === "portal" ? "Traveling to the Nether schedule" : "Opening the application preview"}>
      <div className="mc-travel-scene" aria-hidden="true"><PixelSprite kind={trip.kind} animated={trip.kind === "portal"} className="mc-travel-sprite" />
        {trip.kind === "creeper" && <div className="mc-explosion">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ "--dx": `${Math.cos(i * 2.4) * (140 + i * 14)}px`, "--dy": `${Math.sin(i * 2.4) * (140 + i * 14)}px`, "--turn": `${i * 53}deg`, "--size": `${15 + i % 5 * 9}px` } as CSSProperties} />)}</div>}
      </div>
      <div className="mc-travel-copy" role="status"><p>{trip.kind === "portal" ? "Entering the Nether…" : "Ssssss…"}</p><span>{trip.kind === "portal" ? "Loading your next adventure" : "Making a little room for big ideas"}</span><div className="mc-travel-progress"><i /></div></div>
      <button ref={skip} onClick={arrive} className="mc-travel-skip">Skip animation →</button>
    </div>}
  </TravelContext.Provider>;
}

export function WorldLink({ kind, to, children, onClick, ...props }: Omit<LinkProps, "to"> & { kind: Trip["kind"]; to: string }) {
  const depart = useContext(TravelContext);
  return <Link {...props} to={to} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === "_blank") return;
    event.preventDefault();
    depart({ to, kind });
  }}>{children}</Link>;
}
