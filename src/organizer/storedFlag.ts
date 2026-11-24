import { useState } from "react";

/**
 * An on/off layout choice (sidebar collapsed, drawer expanded) remembered on
 * this device. Storage can be missing or blocked (private windows), so it
 * falls back to off and just isn't remembered.
 */
export function useStoredFlag(key: string): [boolean, () => void] {
  const [on, setOn] = useState(() => {
    try { return window.localStorage.getItem(key) === "1"; } catch { return false; }
  });
  const toggle = () => {
    const next = !on;
    setOn(next);
    try { window.localStorage.setItem(key, next ? "1" : "0"); } catch { /* storage unavailable: just this time */ }
  };
  return [on, toggle];
}
