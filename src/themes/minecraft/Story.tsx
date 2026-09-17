import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { CHAPTERS, type Chapter } from "./chapters";

type StoryValue = {
  /** Index of the chapter currently filling the window. */
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

/**
 * The whole story lives in one scroll container with mandatory snap points, so a
 * scroll or a swipe always lands on exactly one chapter — never between two. Native
 * scrolling does the work; there is no hand-rolled transition to get out of sync.
 */
export function Story({ chapters = CHAPTERS, children }: {
  chapters?: Chapter[];
  children: (chapter: Chapter, index: number) => ReactNode;
}) {
  const location = useLocation();
  const scroller = useRef<HTMLDivElement>(null);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const landed = useRef(false);
  const deepLink = chapters.findIndex(c => c.path === (location.pathname.replace(/\/+$/, "") || chapters[0].path));
  const [active, setActive] = useState(deepLink === -1 ? 0 : deepLink);

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

  // Whichever chapter owns the window owns the URL, so links and reloads stay honest.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const index = Number((visible.target as HTMLElement).dataset.index);
      setActive(index);
      const path = chapters[index]?.path;
      // replaceState rather than the router: scrolling should not stack history.
      if (path && window.location.pathname !== path) window.history.replaceState(window.history.state, "", path);
    }, { root: scroller.current, threshold: [.5, .75] });
    sections.current.forEach(section => section && observer.observe(section));
    return () => observer.disconnect();
  }, [chapters]);

  const value = useMemo(() => ({ active, total: chapters.length, go }), [active, chapters.length, go]);

  return <StoryContext.Provider value={value}>
    <div className="mc-story" ref={scroller}>
      {chapters.map((chapter, index) => <section
        key={chapter.id}
        ref={element => { sections.current[index] = element; }}
        data-index={index}
        className={`mc-chapter mc-chapter-${chapter.id}`}
        aria-label={chapter.title}
      >{children(chapter, index)}</section>)}
    </div>
  </StoryContext.Provider>;
}
