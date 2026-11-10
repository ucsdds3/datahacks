import { useEffect, useState } from "react";

/** Shared by the console's SVG charts (ArrivalsChart, DailyChart). */

/** 1, 2, 5, 10, 20, 50… at or above n, so axis labels are round. */
export function niceMax(n: number) {
  if (n <= 4) return Math.max(n, 1);
  const step = Math.pow(10, Math.floor(Math.log10(n)));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * step >= n) return k * step;
  return 10 * step;
}

/** The element's width, following it through resizes and remounts (a callback ref). */
export function useWidth<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => setWidth(Math.floor(entries[0].contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [setEl, width] as const;
}
