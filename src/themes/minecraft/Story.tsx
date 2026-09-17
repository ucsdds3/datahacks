import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { CHAPTERS, type Chapter } from "./chapters";
import { depthAt, depthOf, formatDepth } from "./depth";

type StoryValue = {
  /** Index of the chapter the camera is level with. */
  active: number;
  total: number;
  /** Scroll to a chapter. Out-of-range values clamp to the ends. */
  go: (index: number) => void;
};
const StoryContext = createContext<StoryValue | null>(null);

/** Story controls. Throws outside a Story so a mistake is loud, not silent. */
export function useStory() {
  const value = useContext(StoryContext);
  if (!value) throw new Error("useStory must be used inside <Story>");
  return value;
}

/** How much taller than the window each chapter is. The slack is what the camera
 * travels through while the content itself holds still, pinned. */
const CHAPTER_STAGES = 1.9;
/** Height of one backdrop tile, in windows. Slightly under one so the strip is
 * shorter than the content is long, which is where the parallax comes from. */
const TILE_STAGES = 0.92;

/**
 * The descent.
 *
 * Every backdrop was drawn to one brief — a flat, straight-on cave-wall cross
 * section, "like a 2D side-scrolling game's background" — so they are tiles of a
 * single shaft rather than nine separate pictures. They are stacked into one strip
 * here and the scroll drives a camera down it: the wall passes continuously from
 * stone to deepslate to sculk with no cut, the light fails as you go, and the depth
 * meter counts you down to bedrock. Content is pinned while its stretch of wall
 * goes by, so each beat holds still long enough to read.
 */
export function Story({ chapters = CHAPTERS, children }: {
  chapters?: Chapter[];
  children: (chapter: Chapter, index: number) => ReactNode;
}) {
  const location = useLocation();
  const frame = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const landed = useRef(false);
  const deepLink = chapters.findIndex(c => c.path === (location.pathname.replace(/\/+$/, "") || chapters[0].path));
  const [active, setActive] = useState(deepLink === -1 ? 0 : deepLink);
  const [depth, setDepth] = useState(() => depthOf(chapters[0]?.y ?? "—"));

  const tiles = useMemo(() => chapters.filter(c => c.art), [chapters]);
  const depths = useMemo(() => chapters.map(c => depthOf(c.y)), [chapters]);

  const go = useCallback((index: number) => {
    const target = sections.current[Math.max(0, Math.min(chapters.length - 1, index))];
    target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [chapters.length]);

  // Deep links and subsequent navigation both land on the requested chapter.
  useEffect(() => {
    const firstVisit = !landed.current;
    landed.current = true;
    if (deepLink < 0 || (firstVisit && deepLink === 0)) return;
    sections.current[deepLink]?.scrollIntoView({ behavior: "auto" });
  }, [deepLink, location.key]);

  // The camera. One number — how far down the shaft we are — drives the backdrop,
  // the darkness and the meter, so they can never disagree with each other.
  useEffect(() => {
    const view = scroller.current;
    const stage = frame.current;
    if (!view || !stage) return;
    let queued = 0;
    const read = () => {
      queued = 0;
      const travel = view.scrollHeight - view.clientHeight;
      const progress = travel > 0 ? Math.max(0, Math.min(1, view.scrollTop / travel)) : 0;
      stage.style.setProperty("--descent", String(progress));
      setDepth(depthAt(progress, depths));
    };
    const onScroll = () => { queued ||= requestAnimationFrame(read); };
    const measure = () => {
      stage.style.setProperty("--stage", `${view.clientHeight}px`);
      read();
    };
    // ResizeObserver catches the mobile URL bar growing and shrinking the window,
    // which a resize event does not always report. Guarded for jsdom.
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    measure();
    resize?.observe(view);
    window.addEventListener("resize", measure);
    view.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(queued);
      resize?.disconnect();
      window.removeEventListener("resize", measure);
      view.removeEventListener("scroll", onScroll);
    };
  }, [depths]);

  // Whichever chapter is level with the middle of the window owns the URL, so links
  // and reloads stay honest. A thin band rather than a ratio: chapters are taller
  // than the window now and can never be mostly visible.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      const crossing = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!crossing) return;
      const index = Number((crossing.target as HTMLElement).dataset.index);
      setActive(index);
      const path = chapters[index]?.path;
      // replaceState rather than the router: scrolling should not stack history.
      if (path && window.location.pathname !== path) window.history.replaceState(window.history.state, "", path);
    }, { root: scroller.current, rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    sections.current.forEach(section => section && observer.observe(section));
    return () => observer.disconnect();
  }, [chapters]);

  const value = useMemo(() => ({ active, total: chapters.length, go }), [active, chapters.length, go]);

  return <StoryContext.Provider value={value}>
    <div
      className="mc-story-frame"
      ref={frame}
      style={{ "--chapter-stages": CHAPTER_STAGES, "--tile-stages": TILE_STAGES, "--strip-travel": tiles.length * TILE_STAGES - 1 } as React.CSSProperties}
    >
      <div className="mc-shaft" aria-hidden="true">
        <div className="mc-shaft-strip">
          {tiles.map((chapter, index) => <img
            key={chapter.id}
            className="mc-shaft-tile"
            src={chapter.art ?? ""}
            width="1536"
            height="1024"
            alt=""
            decoding="async"
            loading={index > 1 ? "lazy" : undefined}
          />)}
        </div>
        <div className="mc-shaft-gloom" />
      </div>

      <div className="mc-story" ref={scroller}>
        {chapters.map((chapter, index) => <section
          key={chapter.id}
          ref={element => { sections.current[index] = element; }}
          data-index={index}
          className={`mc-chapter mc-chapter-${chapter.id}`}
          aria-label={chapter.title}
        >
          <div className="mc-chapter-stage">{children(chapter, index)}</div>
        </section>)}
      </div>

      <DepthRail chapters={chapters} active={active} depth={depth} go={go} />
    </div>
  </StoryContext.Provider>;
}

/** The depth meter, borrowed from the game's own coordinate readout. It is the
 * story's spine made visible: how far you have come, and what is still below you. */
function DepthRail({ chapters, active, depth, go }: {
  chapters: Chapter[];
  active: number;
  depth: number;
  go: (index: number) => void;
}) {
  return <nav className="mc-depth-rail" aria-label="Depth">
    <p className="mc-depth-read"><span>Y</span><b>{formatDepth(depth)}</b></p>
    <ol className="mc-depth-strata">
      {chapters.map((chapter, index) => <li key={chapter.id} className={index === active ? "is-level" : undefined}>
        <button type="button" onClick={() => go(index)} aria-current={index === active ? "true" : undefined}>
          <i aria-hidden="true" style={{ background: chapter.color }} />
          <span>{chapter.name}</span>
        </button>
      </li>)}
    </ol>
    <p className="mc-depth-floor" aria-hidden="true">BEDROCK</p>
  </nav>;
}
