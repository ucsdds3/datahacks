import { useSyncExternalStore } from "react";

/** The applicant portal's two looks: the End (the default) and the Nether. */
export type PortalTheme = "end" | "nether";

export const PORTAL_THEMES: { id: PortalTheme; label: string }[] = [
  { id: "end", label: "End" },
  { id: "nether", label: "Nether" },
];

const KEY = "datahacks.portalTheme";
const isTheme = (value: unknown): value is PortalTheme => value === "end" || value === "nether";
const listeners = new Set<() => void>();
let current: PortalTheme | null = null;

/** A `?theme=nether` (or `end`) link picks the look and remembers it; otherwise this browser's last choice. */
function read(): PortalTheme {
  try {
    const fromLink = new URLSearchParams(window.location.search).get("theme");
    if (isTheme(fromLink)) {
      localStorage.setItem(KEY, fromLink);
      return fromLink;
    }
    const saved = localStorage.getItem(KEY);
    return isTheme(saved) ? saved : "end";
  } catch {
    return "end";
  }
}

export const getPortalTheme = (): PortalTheme => (current ??= read());

export function setPortalTheme(theme: PortalTheme) {
  current = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Private mode: the choice lasts for this visit.
  }
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const usePortalTheme = () => useSyncExternalStore(subscribe, getPortalTheme, (): PortalTheme => "end");
