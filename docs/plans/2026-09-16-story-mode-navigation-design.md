# Story mode navigation — design

**Date:** 2026-09-16
**Theme:** `src/themes/minecraft` (the live site at `/`)

## Goal

Replace the long scrolling document with a linear story. The visitor sees exactly one
full-viewport scene at a time and must act to reach the next one. Nothing scrolls —
not the page, not a panel inside it. Content is scaled to fit the viewport instead.

## Why the current site fails this

`HomePage` renders a hero plus eight `mc-depth-layer` blocks in one tall document.
`ExplorationJourney` animates `window.scrollTo` between them, and any wheel or touch
event cancels the animation and hands scrolling back to the user. The story beats
exist; the scroll undermines them. Three routes (`/schedule`, `/apply`, `/mentors`)
are already separate pages with full-screen `WorldTravel` cinematics between them.

## Structure

A single spine of ten chapters, with two doors leading off it.

```
01 Hero        Cherry Grove     Y +80
02 About       Stone & copper   Y +48
03 Tracks      Iron & redstone  Y +24   ▸ door: THE NETHER (run of show)
04 Sponsors    Sulfur cavern    Y +08
05 Speakers    The mineshaft    Y −08
06 Prizes      Deepslate ores   Y −28
07 Trials      Trial chambers   Y −36   ▸ door: TRIAL CHAMBERS (mentors & judges)
08 FAQ         Ancient city     Y −44
09 Stronghold  Apply teaser     Y −56
10 The End     Application + credits
```

Chapter 10 is the finale the descent aims at, so the story ends rather than stopping.
The nav's "Join the adventure" button jumps straight to it.

The Nether and the Trial Chambers are **not** chapters. They are optional side trips
reached by clicking a portal in chapters 03 and 07 (and from the nav). Taking one
leaves the spine, plays the existing portal or gate cinematic, and lands on that page.
Each offers an explicit way back to the chapter it was opened from.

The footer is removed. Its content (contact, credits, DS3 attribution) becomes the
tail of chapter 10, which suits the End-credits framing.

## Architecture

**`StoryShell`** replaces `ExplorationJourney`. It owns the chapter index, renders the
current chapter, and mounts the neighbour only while a transition runs. The root gets
`position:fixed; inset:0; overflow:hidden` and body scroll is locked for the session.

**Chapter registry** — one ordered array of `{ id, path, layer, element, exit }`.
`exit` describes the affordance that ends the chapter (`skeleton` / `dig` / `chest` /
`portal` / `end`), so every chapter terminates in something the visitor does. The
registry is the single source of truth for order, routing, and the depth meter.

**Routing** stays URL-addressable. Each chapter owns a path: `/minecraft` for the hero,
then `/minecraft/about`, `/minecraft/tracks`, and so on. The three existing paths
(`/minecraft/schedule`, `/minecraft/apply`, `/minecraft/mentors`) keep working —
`apply` resolves to chapter 10, the other two to their side-trip pages. Old in-page
hashes (`#about`, `#tracks`, `#faq`) redirect to the matching chapter path.

**Transitions** come in two tiers:

- *Ordinary* (~700ms): the camera descends. The outgoing scene lifts and darkens, the
  incoming one rises from below through rock dust. This reuses the descent feeling of
  the current build, decoupled from real scroll position.
- *Dimension* (the two doors, plus the End portal into chapter 10): keeps the existing
  full-screen `WorldTravel` cinematics, trimmed from 1850ms to ~1200ms.

Transitions are non-interruptible but always skippable, matching the existing
"Skip animation" affordance.

## Interaction

- **Click** the chapter's exit affordance — the primary path, and the only one the
  design draws attention to.
- **Keyboard**: `→ ↓ Space PageDown Enter` advance, `← ↑ PageUp` go back, `Home`
  returns to chapter 01. Needed for keyboard-only visitors since there is no scroll.
- **Touch**: vertical swipe advances or goes back.
- **Wheel**: does nothing. A trackpad flick carries far too much momentum to map onto
  discrete chapters without overshooting.
- **Browser back/forward** moves between chapters, since each has a URL.

## Fitting the viewport

Every scene is a `100dvh` flex container sized against a `--scene` custom property
derived from viewport height, so art and type shrink together on short screens.
The eight `relief/*.webp` backdrops were authored as tall strips for a scrolling
document; they become height-capped scene art, reframed with `object-fit` and
`object-position` first, and re-exported only if CSS framing looks wrong.

Fit target: no clipping at 1280×720 and at 390×667. If a scene cannot survive that
after scaling — the FAQ's eight questions are the likely case — it splits into two
chapters rather than gaining a scrollbar.

The side-trip pages follow the same rule. The schedule shows one day at a time through
its existing day tabs; the mentors grid and the application form scale to fit.

## Accessibility

- `prefers-reduced-motion` swaps chapters instantly with no camera move.
- Each chapter is a labelled `section` that receives focus on arrival, and announces
  itself through the existing `role="status"` live region.
- Only the current chapter is in the accessibility tree; the outgoing one is `inert`
  during a transition.
- The depth meter (`Y +48`, `03 / 10`) doubles as the progress indicator.
- Skip-to-content and the skip-transition buttons are preserved.

## Testing

Extend the existing Vitest + Testing Library suite (`Exploration.test.tsx` is the model
— it fakes timers and stubs `framer-motion`'s `animate`). Cover:

- only one chapter is in the document at rest;
- the exit affordance advances exactly one chapter and updates the URL;
- keyboard forward and back, and `Home`;
- wheel and scroll do not change the chapter;
- reduced motion arrives instantly and focuses the destination;
- a deep link to `/minecraft/faq` opens on that chapter;
- a door navigates away and the return link comes back to the origin chapter;
- body scroll stays locked throughout.

## Risks

`descent.css`, `layers.css` and `exploration.css` are built around a tall scrolling
document — stacked depth layers, `min-height:600–880px` blocks, scroll parallax. A
substantial part of that is rewritten rather than adjusted. The art reframing is the
other unknown; some backdrops may need re-export.

## Decisions taken

- Whole site is the story, not just the home page.
- Content scales to fit; no inner scroll panels anywhere.
- Nether and Trial Chambers are doors off the spine, not chapters.
- Application is the story finale, chapter 10.
- Side-trip pages are also locked to one viewport.
- Wheel is inert.
