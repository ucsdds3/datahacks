import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CHAPTERS, type Chapter } from "./chapters";

type StoryValue = {
  chapter: Chapter;
  index: number;
  total: number;
  /** Jump to a chapter by index. Out-of-range values clamp to the ends. */
  go: (index: number) => void;
  next: () => void;
  previous: () => void;
};
const StoryContext = createContext<StoryValue | null>(null);

const FORWARD_KEYS = ["ArrowDown", "ArrowRight", "PageDown", " ", "Spacebar"];
const BACK_KEYS = ["ArrowUp", "ArrowLeft", "PageUp"];
const EDITABLE = "input, textarea, select, [contenteditable='true']";
/** Shortest vertical travel that reads as a deliberate swipe rather than a tap wobble. */
const SWIPE = 55;

/** The chapter being told. Throws outside a Story so a mistake is loud, not silent. */
export function useStory() {
  const value = useContext(StoryContext);
  if (!value) throw new Error("useStory must be used inside <Story>");
  return value;
}

/** Renders exactly one chapter, filling a page that cannot scroll. */
export function Story({ chapters = CHAPTERS, children }: {
  chapters?: Chapter[];
  children: (chapter: Chapter) => ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const scene = useRef<HTMLElement>(null);
  const path = location.pathname.replace(/\/+$/, "") || chapters[0].path;
  const found = chapters.findIndex(c => c.path === path);
  const index = found === -1 ? 0 : found;
  const chapter = chapters[index];

  const go = useCallback((target: number) => {
    const clamped = Math.max(0, Math.min(chapters.length - 1, target));
    if (chapters[clamped].path === path) return;
    navigate(chapters[clamped].path);
  }, [chapters, navigate, path]);
  const next = useCallback(() => go(index + 1), [go, index]);
  const previous = useCallback(() => go(index - 1), [go, index]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => { scene.current?.focus({ preventScroll: true }); }, [chapter.id]);

  // There is no scrollbar, so these are the only way a keyboard reaches the next
  // chapter. The wheel is deliberately absent: trackpad momentum overshoots.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      if ((event.target as HTMLElement | null)?.closest?.(EDITABLE)) return;
      if (FORWARD_KEYS.includes(event.key)) next();
      else if (BACK_KEYS.includes(event.key)) previous();
      else if (event.key === "Home") go(0);
      else if (event.key === "End") go(chapters.length - 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, previous, go, chapters.length]);

  useEffect(() => {
    let start: { x: number; y: number } | null = null;
    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      start = touch ? { x: touch.clientX, y: touch.clientY } : null;
    };
    const onEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      start = null;
      if (Math.abs(dy) < SWIPE || Math.abs(dx) > Math.abs(dy)) return;
      if (dy < 0) next(); else previous();
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [next, previous]);

  const value = useMemo(
    () => ({ chapter, index, total: chapters.length, go, next, previous }),
    [chapter, index, chapters.length, go, next, previous],
  );

  return <StoryContext.Provider value={value}>
    <div className="mc-story">
      <section ref={scene} key={chapter.id} className={`mc-chapter mc-chapter-${chapter.id}`} tabIndex={-1} aria-label={chapter.title}>
        {children(chapter)}
      </section>
    </div>
  </StoryContext.Provider>;
}
