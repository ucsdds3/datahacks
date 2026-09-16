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
