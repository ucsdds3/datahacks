# Story Mode Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Minecraft theme's long scrolling document with a linear story of ten full-viewport chapters, where the visitor must act to advance and nothing on the site scrolls.

**Architecture:** A `chapters` registry is the single source of truth for order, routing, depth labels and exit affordances. A `Story` shell reads the current chapter from the URL, renders exactly one chapter at a time inside a fixed, scroll-locked root, and animates a "camera descent" between them. The Nether and Trial Chambers stay separate routes reached through doors that sit inside chapters 03 and 07.

**Tech Stack:** React 18, TypeScript, React Router v6 (`BrowserRouter`, nested routes under `/minecraft/*`), framer-motion 12, hand-written CSS (no Tailwind in this theme), Vitest + Testing Library + jsdom.

**Design doc:** `docs/plans/2026-09-16-story-mode-navigation-design.md`

---

## Orientation for the implementer

Everything in this plan lives under `src/themes/minecraft/`. That directory is the live
site: `src/App.tsx:24` routes `/` to it and `src/App.tsx:28` routes `/minecraft/*` to it.
The other theme directories (`groove`, `pop`, `press`) are unused mockups — **do not
touch them**.

Conventions in this theme that you should match:

- Components are dense, single-file, and use inline JSX rather than many small
  components. Match the surrounding density; do not "helpfully" reformat existing lines.
- CSS is hand-written, one long line per rule, every selector prefixed
  `.minecraft-root`. No Tailwind classes. Class names are `mc-*`.
- Tests use Vitest globals, `@testing-library/react`, and a jsdom environment
  (`vitest.config.ts`). `src/test/setup.ts` stubs `window.matchMedia` to always return
  `matches: false`, so reduced-motion tests must re-stub it — see
  `src/themes/minecraft/Exploration.test.tsx:29-30` for the exact pattern.
- Run the suite with `npm test`. A single file: `npx vitest run src/themes/minecraft/Story.test.tsx`.
- Type check and lint with `npx tsc --noEmit` and `npm run lint`.

**The one rule that makes this feature work:** nothing scrolls. If you find yourself
adding `overflow:auto` or `overflow-y:scroll` anywhere, you have taken a wrong turn —
the answer is always to make the content smaller (Task 9) or split the chapter in two.

---

## Task 1: Chapter registry

The registry is data only, no JSX, so it can be tested and imported without pulling in
the whole theme.

**Files:**
- Create: `src/themes/minecraft/chapters.ts`
- Create: `src/themes/minecraft/chapters.test.ts`

**Step 1: Write the failing test**

```ts
// src/themes/minecraft/chapters.test.ts
import { describe, expect, it } from "vitest";
import { CHAPTERS, chapterAt, chapterIndexOf } from "./chapters";

describe("chapter registry", () => {
  it("runs from the surface down to the End", () => {
    expect(CHAPTERS.map(c => c.id)).toEqual([
      "hero", "about", "tracks", "sponsors", "speakers",
      "prizes", "trials", "faq", "stronghold", "end",
    ]);
  });

  it("gives the hero the bare theme root so /minecraft opens the story", () => {
    expect(CHAPTERS[0].path).toBe("/minecraft");
    expect(CHAPTERS.at(-1)?.path).toBe("/minecraft/apply");
  });

  it("has a unique path for every chapter", () => {
    expect(new Set(CHAPTERS.map(c => c.path)).size).toBe(CHAPTERS.length);
  });

  it("ends every chapter but the last with an exit affordance", () => {
    CHAPTERS.slice(0, -1).forEach(c => expect(c.exit, c.id).not.toBeNull());
    expect(CHAPTERS.at(-1)?.exit).toBeNull();
  });

  it("resolves a pathname to its chapter", () => {
    expect(chapterIndexOf("/minecraft/faq")).toBe(7);
    expect(chapterIndexOf("/minecraft")).toBe(0);
    expect(chapterIndexOf("/minecraft/schedule")).toBe(-1);
    expect(chapterAt(7)?.id).toBe("faq");
    expect(chapterAt(99)).toBeUndefined();
  });

  it("maps legacy in-page hashes onto chapter paths", () => {
    expect(LEGACY_HASHES["#about"]).toBe("/minecraft/about");
    expect(LEGACY_HASHES["#faq"]).toBe("/minecraft/faq");
  });
});
```

Add `LEGACY_HASHES` to the import on line 3.

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/minecraft/chapters.test.ts`
Expected: FAIL — `Failed to resolve import "./chapters"`.

**Step 3: Write the registry**

```ts
// src/themes/minecraft/chapters.ts
export type ExitKind = "skeleton" | "dig" | "chest" | "portal" | "end";

/** The thing the visitor clicks to leave a chapter. */
export type Exit = {
  kind: ExitKind;
  /** Button text. */
  label: string;
  /** Small caps line above the label. */
  caption: string;
};

export type Chapter = {
  id: string;
  /** URL that opens this chapter. */
  path: string;
  /** Depth-meter name, e.g. "Stone, coal & copper". */
  name: string;
  /** Depth-meter reading, e.g. "+48". */
  y: string;
  /** Depth-meter swatch. */
  color: string;
  /** Scene backdrop under /public, or null for chapters that draw their own. */
  art: string | null;
  /** Accessible name for the chapter region. */
  title: string;
  exit: Exit | null;
};

export const CHAPTERS: Chapter[] = [
  { id: "hero", path: "/minecraft", name: "Cherry grove", y: "+80", color: "#f0b9d0", art: null,
    title: "DataHacks 2.0 — the surface",
    exit: { kind: "dig", label: "Dig a little deeper", caption: "YOUR ADVENTURE BEGINS" } },
  { id: "about", path: "/minecraft/about", name: "Stone, coal & copper", y: "+48", color: "#d5aa87", art: "/images/minecraft/relief/01-about.webp",
    title: "About DataHacks",
    exit: { kind: "skeleton", label: "Clear the path", caption: "A PATH WORTH TAKING" } },
  { id: "tracks", path: "/minecraft/tracks", name: "Iron & redstone", y: "+24", color: "#cfae9c", art: "/images/minecraft/relief/02-tracks.webp",
    title: "Tracks",
    exit: { kind: "dig", label: "Keep digging", caption: "SOMETHING LIES BELOW" } },
  { id: "sponsors", path: "/minecraft/sponsors", name: "Sulfur cavern", y: "+08", color: "#e7d88b", art: "/images/minecraft/relief/03-sponsors.webp",
    title: "Sponsors",
    exit: { kind: "dig", label: "Dig into the mineshaft", caption: "SOMETHING LIES BELOW" } },
  { id: "speakers", path: "/minecraft/speakers", name: "The mineshaft", y: "−08", color: "#cfa873", art: "/images/minecraft/relief/04-speakers.webp",
    title: "Speakers",
    exit: { kind: "chest", label: "Open the minecart chest", caption: "A LITTLE DISCOVERY" } },
  { id: "prizes", path: "/minecraft/prizes", name: "Deepslate ores", y: "−28", color: "#98d4d8", art: "/images/minecraft/relief/05-prizes.webp",
    title: "Prizes",
    exit: { kind: "dig", label: "Break through the deepslate", caption: "SOMETHING LIES BELOW" } },
  { id: "trials", path: "/minecraft/trials", name: "Trial chambers", y: "−36", color: "#b57853", art: "/images/minecraft/dimensions/trial-chamber-entrance.webp",
    title: "The trial chambers",
    exit: { kind: "skeleton", label: "Slip past the spawner", caption: "A PATH WORTH TAKING" } },
  { id: "faq", path: "/minecraft/faq", name: "Ancient city", y: "−44", color: "#8acbc4", art: "/images/minecraft/relief/06-faq.webp",
    title: "Frequently asked questions",
    exit: { kind: "dig", label: "Tunnel toward the light", caption: "SOMETHING LIES BELOW" } },
  { id: "stronghold", path: "/minecraft/stronghold", name: "The stronghold", y: "−56", color: "#f0b175", art: "/images/minecraft/relief/07-stronghold.webp",
    title: "The stronghold",
    exit: { kind: "end", label: "Step through the portal", caption: "THE END IS RIGHT THERE" } },
  { id: "end", path: "/minecraft/apply", name: "The End", y: "—", color: "#d9d0a0", art: "/images/minecraft/dimensions/end-application.webp",
    title: "Apply to DataHacks 2.0",
    exit: null },
];

/** Hashes the old scrolling page used, so existing links keep working. */
export const LEGACY_HASHES: Record<string, string> = {
  "#top": "/minecraft",
  "#about": "/minecraft/about",
  "#emerald-layer": "/minecraft/about",
  "#tracks": "/minecraft/tracks",
  "#iron-layer": "/minecraft/tracks",
  "#faq": "/minecraft/faq",
  "#sculk-layer": "/minecraft/faq",
  "#apply": "/minecraft/apply",
  "#lava-layer": "/minecraft/stronghold",
};

export const chapterAt = (index: number): Chapter | undefined => CHAPTERS[index];

/** -1 when the pathname is not a chapter (the Nether and Trial Chambers doors). */
export const chapterIndexOf = (pathname: string): number =>
  CHAPTERS.findIndex(c => c.path === pathname.replace(/\/+$/, "" ) || (c.path === "/minecraft" && pathname.replace(/\/+$/, "") === ""));
```

**Step 4: Run the test to verify it passes**

Run: `npx vitest run src/themes/minecraft/chapters.test.ts`
Expected: PASS, 6 tests.

**Step 5: Commit**

```bash
git add src/themes/minecraft/chapters.ts src/themes/minecraft/chapters.test.ts
git commit -m "Add the story chapter registry"
```

---

## Task 2: The Story shell — render one chapter, lock the page

The shell is the heart of the feature. Build it against fixture chapters so the test
does not depend on real content.

**Files:**
- Create: `src/themes/minecraft/Story.tsx`
- Create: `src/themes/minecraft/Story.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/themes/minecraft/Story.test.tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Story } from "./Story";
import type { Chapter } from "./chapters";

const fixture: Chapter[] = [
  { id: "one", path: "/minecraft", name: "Surface", y: "+80", color: "#fff", art: null, title: "Chapter one", exit: { kind: "dig", label: "Dig down", caption: "BELOW" } },
  { id: "two", path: "/minecraft/two", name: "Stone", y: "+48", color: "#eee", art: null, title: "Chapter two", exit: null },
];
const render_ = (path = "/minecraft") => render(
  <MemoryRouter initialEntries={[path]}>
    <Story chapters={fixture}>{chapter => <p>Body of {chapter.id}</p>}</Story>
  </MemoryRouter>,
);

afterEach(cleanup);

describe("Story shell", () => {
  it("renders only the current chapter", () => {
    render_();
    expect(screen.getByText("Body of one")).toBeInTheDocument();
    expect(screen.queryByText("Body of two")).not.toBeInTheDocument();
  });

  it("opens directly on a deep-linked chapter", () => {
    render_("/minecraft/two");
    expect(screen.getByText("Body of two")).toBeInTheDocument();
  });

  it("labels the chapter as a region and gives it focus", () => {
    render_();
    expect(screen.getByRole("region", { name: "Chapter one" })).toHaveFocus();
  });

  it("locks the page so nothing can scroll", () => {
    render_();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("releases the lock on unmount", () => {
    render_().unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run src/themes/minecraft/Story.test.tsx`
Expected: FAIL — `Failed to resolve import "./Story"`.

**Step 3: Write the minimal shell**

No transitions yet, no keyboard yet. Just: one chapter, scroll locked, focused.

```tsx
// src/themes/minecraft/Story.tsx
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { CHAPTERS, chapterIndexOf, type Chapter } from "./chapters";

type StoryValue = { chapter: Chapter; index: number; total: number };
const StoryContext = createContext<StoryValue | null>(null);

/** Current chapter. Throws outside a Story so a mistake is loud, not silent. */
export function useStory() {
  const value = useContext(StoryContext);
  if (!value) throw new Error("useStory must be used inside <Story>");
  return value;
}

export function Story({ chapters = CHAPTERS, children }: {
  chapters?: Chapter[];
  children: (chapter: Chapter) => ReactNode;
}) {
  const location = useLocation();
  const scene = useRef<HTMLElement>(null);
  const found = chapters.findIndex(c => c.path === location.pathname.replace(/\/+$/, ""));
  const index = found === -1 ? 0 : found;
  const chapter = chapters[index];

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => { scene.current?.focus({ preventScroll: true }); }, [chapter.id]);

  return <StoryContext.Provider value={{ chapter, index, total: chapters.length }}>
    <div className="mc-story">
      <section ref={scene} className={`mc-chapter mc-chapter-${chapter.id}`} tabIndex={-1} aria-label={chapter.title} key={chapter.id}>
        {children(chapter)}
      </section>
    </div>
  </StoryContext.Provider>;
}
```

Note `chapterIndexOf` is imported but unused for now — Task 3 uses it. Remove the
import if lint complains, and add it back in Task 3.

**Step 4: Run the test to verify it passes**

Run: `npx vitest run src/themes/minecraft/Story.test.tsx`
Expected: PASS, 5 tests.

**Step 5: Commit**

```bash
git add src/themes/minecraft/Story.tsx src/themes/minecraft/Story.test.tsx
git commit -m "Add the Story shell rendering one locked chapter at a time"
```

---

## Task 3: Advancing and going back

Navigation is URL-driven so browser back/forward work for free.

**Files:**
- Modify: `src/themes/minecraft/Story.tsx`
- Modify: `src/themes/minecraft/Story.test.tsx`

**Step 1: Write the failing tests**

Append to the `describe` block. Add a `Controls` helper that calls the hook:

```tsx
function Controls() {
  const { next, previous, index } = useStory();
  return <>
    <button onClick={next}>go next</button>
    <button onClick={previous}>go back</button>
    <output aria-label="Index">{index}</output>
  </>;
}
```

Render it inside the children callback: `{chapter => <><p>Body of {chapter.id}</p><Controls /></>}`.

```tsx
it("advances exactly one chapter", () => {
  render_();
  fireEvent.click(screen.getByRole("button", { name: "go next" }));
  expect(screen.getByText("Body of two")).toBeInTheDocument();
  expect(screen.queryByText("Body of one")).not.toBeInTheDocument();
});

it("goes back one chapter", () => {
  render_("/minecraft/two");
  fireEvent.click(screen.getByRole("button", { name: "go back" }));
  expect(screen.getByText("Body of one")).toBeInTheDocument();
});

it("does not run off either end", () => {
  render_();
  fireEvent.click(screen.getByRole("button", { name: "go back" }));
  expect(screen.getByLabelText("Index")).toHaveTextContent("0");
  render_("/minecraft/two");
  fireEvent.click(screen.getAllByRole("button", { name: "go next" })[1]);
  expect(screen.getAllByLabelText("Index")[1]).toHaveTextContent("1");
});
```

**Step 2: Run to verify they fail**

Run: `npx vitest run src/themes/minecraft/Story.test.tsx`
Expected: FAIL — `next is not a function`.

**Step 3: Implement**

Add to `StoryValue`: `go: (index: number) => void; next: () => void; previous: () => void;`

In `Story`:

```tsx
const navigate = useNavigate();
const go = useCallback((target: number) => {
  const clamped = Math.max(0, Math.min(chapters.length - 1, target));
  if (clamped === index) return;
  navigate(chapters[clamped].path);
}, [chapters, index, navigate]);
const next = useCallback(() => go(index + 1), [go, index]);
const previous = useCallback(() => go(index - 1), [go, index]);
```

Pass `go`, `next`, `previous` through the provider value (memoise with `useMemo`).

**Step 4: Run to verify they pass**

Run: `npx vitest run src/themes/minecraft/Story.test.tsx`
Expected: PASS, 8 tests.

**Step 5: Commit**

```bash
git add src/themes/minecraft/Story.tsx src/themes/minecraft/Story.test.tsx
git commit -m "Move between story chapters by URL"
```

---

## Task 4: Keyboard, touch, and a deliberately inert wheel

There is no scrollbar, so keyboard support is not a nicety — it is the only way a
keyboard-only visitor gets through the site.

**Files:**
- Modify: `src/themes/minecraft/Story.tsx`
- Modify: `src/themes/minecraft/Story.test.tsx`

**Step 1: Write the failing tests**

```tsx
it.each(["ArrowDown", "ArrowRight", "PageDown", " "])("advances on %s", key => {
  render_();
  fireEvent.keyDown(window, { key });
  expect(screen.getByText("Body of two")).toBeInTheDocument();
});

it.each(["ArrowUp", "ArrowLeft", "PageUp"])("goes back on %s", key => {
  render_("/minecraft/two");
  fireEvent.keyDown(window, { key });
  expect(screen.getByText("Body of one")).toBeInTheDocument();
});

it("returns to the first chapter on Home", () => {
  render_("/minecraft/two");
  fireEvent.keyDown(window, { key: "Home" });
  expect(screen.getByText("Body of one")).toBeInTheDocument();
});

it("ignores the wheel", () => {
  render_();
  fireEvent.wheel(window, { deltaY: 400 });
  expect(screen.getByText("Body of one")).toBeInTheDocument();
});

it("leaves typing in a field alone", () => {
  render_();
  const field = document.createElement("input");
  document.body.append(field);
  field.focus();
  fireEvent.keyDown(field, { key: " ", bubbles: true });
  expect(screen.getByText("Body of one")).toBeInTheDocument();
  field.remove();
});
```

**Step 2: Run to verify they fail**

Run: `npx vitest run src/themes/minecraft/Story.test.tsx`
Expected: FAIL — the arrow-key tests still show "Body of one".

**Step 3: Implement**

```tsx
const FORWARD = ["ArrowDown", "ArrowRight", "PageDown", " ", "Spacebar"];
const BACK = ["ArrowUp", "ArrowLeft", "PageUp"];

useEffect(() => {
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    // Never steal keys from a form field or anything the visitor is editing.
    if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (FORWARD.includes(event.key)) { event.preventDefault(); next(); }
    else if (BACK.includes(event.key)) { event.preventDefault(); previous(); }
    else if (event.key === "Home") { event.preventDefault(); go(0); }
    else if (event.key === "End") { event.preventDefault(); go(chapters.length - 1); }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [next, previous, go, chapters.length]);
```

Touch, on the same effect or a second one: record `touchstart` clientY, and on
`touchend` advance when the delta is below −55px, go back when above +55px. Ignore
horizontal-dominant swipes (`Math.abs(dx) > Math.abs(dy)`).

Do **not** add a wheel listener. The inert wheel is a decision, not an omission —
leave a one-line comment saying so, or someone will "fix" it later.

**Step 4: Run to verify they pass**

Run: `npx vitest run src/themes/minecraft/Story.test.tsx`
Expected: PASS, 16 tests.

**Step 5: Commit**

```bash
git add src/themes/minecraft/Story.tsx src/themes/minecraft/Story.test.tsx
git commit -m "Drive the story with keyboard and touch, not the wheel"
```

---

## Task 5: The chapter exit affordance

Reuse the existing encounter art — it is good and already built. The refactor is to
separate the *art* from the *scroll animation* it is currently welded to in
`src/themes/minecraft/Exploration.tsx:94-115`.

**Files:**
- Create: `src/themes/minecraft/ChapterExit.tsx`
- Create: `src/themes/minecraft/ChapterExit.test.tsx`
- Modify: `src/themes/minecraft/Exploration.tsx`

**Step 1: Write the failing test**

```tsx
// src/themes/minecraft/ChapterExit.test.tsx
it("advances the story when clicked", () => {
  // render a Story fixture whose chapter body contains <ChapterExit />
  fireEvent.click(screen.getByRole("button", { name: /Dig down/ }));
  expect(screen.getByText("Body of two")).toBeInTheDocument();
});

it("names the destination for screen readers", () => {
  expect(screen.getByRole("button", { name: "Dig down — continue to Stone" })).toBeInTheDocument();
});

it("renders nothing on the final chapter", () => {
  // render at "/minecraft/two", whose exit is null
  expect(screen.queryByRole("button", { name: /continue/ })).not.toBeInTheDocument();
});
```

**Step 2: Run to verify it fails**

Run: `npx vitest run src/themes/minecraft/ChapterExit.test.tsx`
Expected: FAIL — module not found.

**Step 3: Implement**

Move the `Minecart` component and the three art branches (`skeleton`, `dig`, `chest`)
out of `Exploration.tsx` into `ChapterExit.tsx` unchanged — same SVG, same
framer-motion animations, same `mc-encounter-*` class names, so the CSS in
`exploration.css:11-72` keeps applying. Add `portal` (reuse `PortalFrame`) and `end`
(reuse `/images/minecraft/layers/end-portal.png`) branches for chapters 07 and 09.

The changes from the original:

- It is a `<button>`, not an `<a href="#...">`. There is no anchor to point at any more.
- `onClick` calls `next()` from `useStory()` instead of `enter()`.
- The `discovered` flag that plays the break/open animation is local state set on
  click, held for the transition duration, rather than read from journey context.
- `aria-label` is `` `${exit.label} — continue to ${nextChapter.name}` ``.
- Returns `null` when `chapter.exit` is `null`.

**Step 4: Run to verify it passes**

Run: `npx vitest run src/themes/minecraft/ChapterExit.test.tsx`
Expected: PASS, 3 tests.

**Step 5: Commit**

```bash
git add src/themes/minecraft/ChapterExit.tsx src/themes/minecraft/ChapterExit.test.tsx src/themes/minecraft/Exploration.tsx
git commit -m "Extract the encounter art into a chapter exit button"
```

---

## Task 6: The camera-descent transition

**Files:**
- Modify: `src/themes/minecraft/Story.tsx`
- Modify: `src/themes/minecraft/Story.test.tsx`
- Create: `src/themes/minecraft/story.css`

**Step 1: Write the failing tests**

```tsx
it("arrives instantly when the visitor prefers reduced motion", () => {
  const media = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation(query => ({ ...media(query), matches: query.includes("prefers-reduced-motion") }));
  render_();
  fireEvent.click(screen.getByRole("button", { name: "go next" }));
  expect(screen.getByText("Body of two")).toBeInTheDocument();
  expect(screen.queryByText("Body of one")).not.toBeInTheDocument();
});

it("holds both chapters while the camera moves, then drops the old one", () => {
  vi.useFakeTimers();
  render_();
  fireEvent.click(screen.getByRole("button", { name: "go next" }));
  expect(screen.getByText("Body of one")).toBeInTheDocument();
  expect(screen.getByText("Body of two")).toBeInTheDocument();
  expect(screen.getByText("Body of one").closest("section")).toHaveAttribute("inert");
  act(() => vi.advanceTimersByTime(900));
  expect(screen.queryByText("Body of one")).not.toBeInTheDocument();
});

it("ignores a second advance while the camera is moving", () => {
  vi.useFakeTimers();
  render_();
  const go = screen.getByRole("button", { name: "go next" });
  fireEvent.click(go); fireEvent.click(go);
  act(() => vi.advanceTimersByTime(900));
  expect(screen.getAllByLabelText("Index")[0]).toHaveTextContent("1");
});
```

**Step 2: Run to verify they fail**

Run: `npx vitest run src/themes/minecraft/Story.test.tsx`
Expected: FAIL — the outgoing chapter unmounts immediately.

**Step 3: Implement**

Hold a `leaving: Chapter | null` in state. On a chapter change, set `leaving` to the
previous chapter and clear it after the transition duration. Render both, with the
leaving one marked `inert` and given `data-leaving`. Guard `go` with a
`transitioning` ref so a second click during the move is dropped.

Use `700` for ordinary moves. Read `prefers-reduced-motion` through
`useReducedMotion()` from framer-motion; when reduced, skip the hold entirely.

The visual is CSS, not JS — `story.css`:

```css
.minecraft-root .mc-story { position:relative; width:100%; height:100dvh; overflow:hidden; }
.minecraft-root .mc-chapter { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; overflow:hidden; animation:mc-descend-in .7s cubic-bezier(.65,0,.2,1) both; }
.minecraft-root .mc-chapter:focus { outline:none; }
.minecraft-root .mc-chapter[data-leaving] { animation:mc-descend-out .7s cubic-bezier(.65,0,.2,1) both; }
.minecraft-root .mc-chapter[data-back] { animation:mc-descend-in-back .7s cubic-bezier(.65,0,.2,1) both; }
@keyframes mc-descend-in { from { transform:translateY(14%); filter:brightness(.25); } to { transform:none; filter:none; } }
@keyframes mc-descend-out { from { transform:none; filter:none; } to { transform:translateY(-12%); filter:brightness(.15); } }
@keyframes mc-descend-in-back { from { transform:translateY(-14%); filter:brightness(.25); } to { transform:none; filter:none; } }
@media (prefers-reduced-motion:reduce) { .minecraft-root .mc-chapter, .minecraft-root .mc-chapter[data-leaving], .minecraft-root .mc-chapter[data-back] { animation:none; } }
```

Import `./story.css` in `src/themes/minecraft/index.tsx` alongside the other stylesheets.

**Step 4: Run to verify they pass**

Run: `npx vitest run src/themes/minecraft/Story.test.tsx`
Expected: PASS, 19 tests.

**Step 5: Commit**

```bash
git add src/themes/minecraft/Story.tsx src/themes/minecraft/Story.test.tsx src/themes/minecraft/story.css src/themes/minecraft/index.tsx
git commit -m "Animate a camera descent between chapters"
```

---

## Task 7: Wire the real content into chapters

Now replace `HomePage`. Content components are reused as-is — this task is about
where they are mounted, not how they look.

**Files:**
- Modify: `src/themes/minecraft/index.tsx:54-84` (`HomePage`) and `:106-110` (`Minecraft`)

**Step 1: Replace `HomePage`**

Delete the `layers` array (now `chapters.ts`), `LayerLabel`, and the `.map` over
depth layers. Build a `bodies` record keyed by chapter id:

```tsx
const bodies: Record<string, ReactNode> = {
  hero: <HeroScene />,          // the existing <section className="mc-hero mc-cherry-hero"> markup
  about: <About />,
  tracks: <><Tracks /><NetherEntrance /></>,
  sponsors: <Sponsors />,
  speakers: <Speakers />,
  prizes: <Prizes />,
  trials: <TrialEntrance />,
  faq: <SculkFaq />,
  stronghold: <LavaApply />,
  end: <ApplicationPage />,
};
```

Then:

```tsx
<Story>{chapter => <>
  {chapter.art && <img className="mc-chapter-art" src={chapter.art} alt="" width="1536" height="1024" decoding="async" />}
  <ChapterLabel chapter={chapter} />
  <div className="mc-chapter-body">{bodies[chapter.id]}</div>
  <ChapterExit />
</>}</Story>
```

`ChapterLabel` is the old `LayerLabel` reading from the chapter object instead of the
deleted `layers` array.

**Step 2: Update routing**

In `Minecraft` (`index.tsx:106`), the story owns every chapter path, so the `Routes`
shrink to the two doors plus a story catch-all:

```tsx
<Routes>
  <Route path="schedule" element={<NetherPage />} />
  <Route path="mentors" element={<TrialChambersPage />} />
  <Route path="*" element={<HomePage />} />
</Routes>
```

`HomePage` renders `Story`, which resolves the chapter from the pathname. An unknown
path falls back to chapter 0 (`Story` already does this via `found === -1 ? 0 : found`).

Also handle `LEGACY_HASHES`: in `WorldTravel`'s location effect
(`src/themes/minecraft/WorldTravel.tsx:24-29`), replace the `scrollIntoView` branch —
there is nothing to scroll into view any more — with a `navigate(LEGACY_HASHES[hash],
{ replace: true })` when the hash is known.

**Step 3: Verify by hand**

Run: `npm run dev`, open `http://localhost:8080/minecraft`.
Expected: one chapter fills the window; clicking the exit advances; the page has no
scrollbar at any chapter; `/minecraft/faq` opens on the FAQ; browser back returns to
the previous chapter.

The scenes will overflow and look wrong at this point. That is Task 9. Do not fix
sizing here.

**Step 4: Run the full suite**

Run: `npm test && npx tsc --noEmit`
Expected: PASS. `Exploration.test.tsx` and `WorldTravel.test.tsx` will fail if they
assert on scroll behaviour — update or delete the assertions that no longer describe
the product, but do not delete a test just because it is inconvenient.

**Step 5: Commit**

```bash
git add src/themes/minecraft/
git commit -m "Render the home page as story chapters"
```

---

## Task 8: The two doors

**Files:**
- Modify: `src/themes/minecraft/Exploration.tsx` (`NetherEntrance`)
- Modify: `src/themes/minecraft/TrialChambers.tsx` (`TrialEntrance`, `TrialChambersPage`)
- Modify: `src/themes/minecraft/index.tsx` (`NetherPage`)

Both entrances already use `WorldLink`, which plays the cinematic and navigates — that
part needs no change. What they need is a way back that returns to the chapter the
visitor left from, not to the top of the story.

**Step 1:** When a door is taken, record the origin chapter path in router state:
`<WorldLink to="/minecraft/schedule" kind="portal" state={{ from: chapter.path }}>`.

**Step 2:** On `NetherPage` and `TrialChambersPage`, replace the existing
`← Return to the overworld` link (`index.tsx:89`) with a `WorldLink` back to
`location.state?.from ?? "/minecraft/tracks"`.

**Step 3:** Trim the cinematic. `WorldTravel.tsx:39` uses `1850`ms — change to `1200`.
`WorldTravel.test.tsx` asserts on the timing; update the advance to match.

**Step 4:** Run: `npm test`. Expected: PASS.

**Step 5: Commit**

```bash
git add src/themes/minecraft/
git commit -m "Make the Nether and Trial Chambers doors that return you to your chapter"
```

---

## Task 9: Make every scene fit

The real work. No scrollbars anywhere, at 1280×720 and 390×667.

**Files:**
- Modify: `src/themes/minecraft/story.css`
- Modify: `src/themes/minecraft/layers.css`, `descent.css`, `exploration.css`

**Step 1: Establish the scene unit**

Every scene sizes itself from one custom property, so art and type shrink together:

```css
.minecraft-root .mc-chapter { --scene:clamp(10px,min(1.55vh,1.15vw),17px); font-size:var(--scene); padding:calc(var(--scene) * 2) 0; }
.minecraft-root .mc-chapter-body { display:flex; flex-direction:column; align-items:center; justify-content:center; width:min(78em,92%); max-height:100%; }
.minecraft-root .mc-chapter-art { position:absolute; inset:0; z-index:-1; width:100%; height:100%; object-fit:cover; object-position:center 35%; }
```

Then convert the inner section rules from `px` to `em` so they follow `--scene`.

**Step 2: Remove the scrolling-document scaffolding**

These exist only to make a tall page work and now actively break the layout:

- `layers.css:3` — `.mc-texture-layer { padding:40px 0 105px; min-height:600px; }`
- `layers.css:19,31,40,58` — the `min-height:370px` / `760px` / `880px` / `850px` blocks
- `layers.css:112-127` — the tall-viewport padding overrides
- `descent.css:17` — `.mc-depth-layer { padding:75px 0 35px; scroll-margin-top:28px; }`
- `descent.css:9,216` — `.mc-cherry-hero { min-height:760px; max-height:1050px; }`
- `minecraft.css:23` — `.mc-hero { min-height:720px; height:calc(100svh - 80px); }`

Replace each with the `--scene`-relative equivalent or delete it.

**Step 3: Verify at both sizes**

Run `npm run dev`, then walk all ten chapters plus both doors at exactly 1280×720 and
390×667. For each, confirm `document.documentElement.scrollHeight === window.innerHeight`
and nothing is clipped.

The FAQ (eight questions) is the chapter most likely to fail. If it cannot fit at
390×667 after scaling, split it into `faq` and `faq-more` chapters in `chapters.ts` —
that is a registry edit plus a body split, and the shell needs no changes. **Do not
add a scrollbar.**

**Step 4: Reframe the art**

The eight `relief/*.webp` files were authored as tall strips. Tune `object-position`
per chapter. If a backdrop still reads wrong as a 16:9 scene — the composition's
subject sits outside any usable crop — note it in
`public/images/minecraft/relief/README.md` for re-export rather than fighting CSS.

**Step 5: Commit**

```bash
git add src/themes/minecraft/
git commit -m "Scale every scene to fit one viewport"
```

---

## Task 10: Lock the door pages too

**Files:**
- Modify: `src/themes/minecraft/index.tsx` (`NetherPage`), `TrialChambers.tsx`, `descent.css`

- **Nether / run of show:** the schedule already has day tabs
  (`.mc-day-tabs` in `minecraft.css`). Show one day at a time and drop the heading
  block's vertical padding until the pane fits. The `mc-nether-residents` piglin strip
  and `mc-nether-foot` are the first things to cut if it will not fit.
- **Trial Chambers / mentors:** scale the grid with `--scene`; reduce columns rather
  than rows so the block stays wide and short.
- **Apply (chapter 10):** the form is the tightest fit. Group fields into two columns
  at desktop width. If it still overflows at 390×667, split into two chapters
  (`apply` and `apply-details`) — the registry supports it.

Verify the same way as Task 9. Commit.

---

## Task 11: Progress, announcements, and the credits

**Files:**
- Modify: `src/themes/minecraft/Story.tsx`, `index.tsx`, `story.css`

1. **Depth meter.** `descent.css:102-108` already styles `.mc-depth-meter` but nothing
   renders it. Render it from `CHAPTERS`: one dot per chapter, current one marked
   `aria-current="step"`, each a button calling `go(i)`. It is the only affordance
   showing how long the story is.
2. **Announcements.** Add a `role="status"` live region in `Story` that announces
   `` `${chapter.title}. Chapter ${index + 1} of ${total}.` `` on arrival.
3. **Footer.** Delete the `Footer` component (`index.tsx:96-104`) and its render at
   `index.tsx:109`. Move its content — contact, DS3 attribution, copyright — into the
   bottom of the chapter 10 body as End-poem credits.
4. **Skip link.** `mc-skip` (`index.tsx:109`) should target the current chapter
   section, not `#mc-main`.

Add tests for the live region and for `aria-current` landing on the right dot. Commit.

---

## Task 12: Delete the scrolling machinery

Only after everything above passes. Removing this earlier will strand you.

**Files:**
- Delete: `src/themes/minecraft/Exploration.test.tsx` (it tests scroll behaviour that no longer exists)
- Modify: `src/themes/minecraft/Exploration.tsx` — remove `ExplorationJourney`, `JourneyContext`, `EncounterLink` and the `mc-descent-skip` button; keep `NetherEntrance`
- Modify: `src/themes/minecraft/exploration.css` — remove `.mc-descent-skip` (`:36-37`)
- Modify: `src/themes/minecraft/WorldMotion.tsx` — `Reveal` uses scroll-triggered
  reveals; either delete it or retarget it to chapter-entry

**Step 1:** Grep for stragglers.

```bash
grep -rn "scrollIntoView\|window.scrollTo\|scroll-behavior\|ExplorationJourney\|EncounterLink\|mc-depth-layer\|mc-underground" src/themes/minecraft/
```

Expected: no hits outside comments.

**Step 2:** Run `npm test && npx tsc --noEmit && npm run lint && npm run build`.
Expected: all pass.

**Step 3:** Final manual walk — all ten chapters, both doors, browser back/forward,
keyboard only, and with reduced motion on.

**Step 4: Commit**

```bash
git add -A src/themes/minecraft/
git commit -m "Remove the scrolling descent machinery"
```

---

## Definition of done

- `document.documentElement.scrollHeight === window.innerHeight` on every chapter and
  both doors, at 1280×720 and 390×667.
- Every chapter is reachable by mouse, by keyboard alone, and by direct URL.
- Browser back and forward move one chapter.
- Reduced motion swaps instantly with no camera move.
- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass.
- No `overflow:auto` or `overflow-y:scroll` anywhere in `src/themes/minecraft/`.
