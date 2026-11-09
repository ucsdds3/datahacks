import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

/*
 * Fitting a Nether handbook page into the board (NetherGuide.tsx, Schedule.tsx). On desktop
 * the shell makes the board a fixed box that never scrolls the window, so a page tries its
 * layouts from roomiest to most compact and keeps the first one that fits.
 */

/** Where the shell makes the board a fixed box (keep in step with nether-shell.css). */
const DESKTOP_FIT = "(min-width: 861px) and (min-height: 600px)";

const subscribeFit = (onChange: () => void) => {
  const query = window.matchMedia(DESKTOP_FIT);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const useDesktopFit = () => useSyncExternalStore(subscribeFit, () => window.matchMedia(DESKTOP_FIT).matches, () => false);

/** Whether an element's content runs past its bottom edge. */
export const overflows = (el: HTMLElement | null) => !!el && el.scrollHeight > el.clientHeight + 1;

/**
 * The first of a page's layouts (steps 0…last, roomiest first) that fits: `tooBig(step)`
 * checks the layout just drawn (usually: does the view overflow?). Starts over from 0 when
 * the window is resized or the fonts are ready, from `restart(step)` when the reader opens
 * another tab, and checks again (without starting over, so focus stays put) when a font
 * loads later. `usable(step)` skips steps that don't apply (a section with only one topic
 * has nothing to split); the last step always applies. Measuring happens in layout effects
 * (and a frame callback on resize), so only the layout that fits is ever painted. Off on
 * phones, where the page scrolls as usual.
 */
export function useFitStep(last: number, tooBig: (step: number) => boolean, usable: (step: number) => boolean = () => true) {
  const fit = useDesktopFit();
  // A new object each time, so starting over always re-renders and re-measures.
  const [state, setState] = useState({ step: 0 });
  const latest = useRef({ tooBig, usable });
  latest.current = { tooBig, usable };
  const from = useCallback((step: number) => {
    let s = step;
    while (s < last && !latest.current.usable(s)) s++;
    return s;
  }, [last]);
  const restart = useCallback((step: number) => setState({ step: from(step) }), [from]);

  // After each layout (every change makes a new state object): too big? Try the next one.
  useLayoutEffect(() => {
    if (fit && state.step < last && latest.current.tooBig(state.step)) setState({ step: from(state.step + 1) });
  }, [fit, state, last, from]);

  useEffect(() => {
    if (!fit) return;
    let frame = 0;
    let live = true;
    const later = (update: () => void) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { if (live) flushSync(update); });
    };
    const again = () => later(() => restart(0));
    const check = () => later(() => setState(s => ({ ...s })));
    window.addEventListener("resize", again);
    const fonts = document.fonts;
    fonts?.addEventListener?.("loadingdone", check);
    fonts?.ready.then(again);
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", again);
      fonts?.removeEventListener?.("loadingdone", check);
    };
  }, [fit, restart]);

  return { fit, step: fit ? state.step : 0, restart };
}

/** The panel a GuideTabs opens; a stop in the tab order of its own unless it holds a panel of tabs further in. */
export const tabPanel = (id: string, selected: number, tabStop = true) =>
  ({ role: "tabpanel", id: `${id}-panel`, "aria-labelledby": `${id}-tab-${selected}`, tabIndex: tabStop ? 0 : -1 }) as const;
