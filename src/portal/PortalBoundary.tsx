import { Component, type ReactNode } from "react";

const RELOADED_KEY = "datahacks.chunkReloadAt";

/**
 * A page's code that no longer exists: after a deploy, GitHub Pages drops the old
 * hashed files, so a tab opened before it can't load the next page it needs.
 */
export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /ChunkLoadError|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(message);
}

/**
 * Reloads once to pick up the new deploy. Not again within a minute, so a page
 * that really is broken shows the error screen instead of reloading forever.
 */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
  } catch {
    return false; // Can't remember having reloaded: don't risk a loop.
  }
  window.location.reload();
  return true;
}

// Vite reports a failed preload of a lazy page here before React sees anything.
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", event => {
    if (reloadForNewVersion()) event.preventDefault();
  });
}

const page: React.CSSProperties = {
  minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#16181a", color: "#EFF1F2",
  fontFamily: "system-ui, sans-serif", textAlign: "center",
};
const button: React.CSSProperties = {
  minHeight: 44, padding: "0 22px", border: 0, borderRadius: 6, background: "#12B2C8", color: "#0b1214",
  font: "600 16px system-ui, sans-serif", cursor: "pointer",
};

/**
 * Catches the portal failing to start or crashing: a stale page after a deploy (reloaded
 * once automatically), or a build made without the Supabase values, where the client
 * throws as soon as it is imported. Without this the error unmounts the whole tree and
 * the visitor gets a white screen.
 */
export class PortalBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    console.error("Application portal failed:", error);
    if (isStaleChunkError(error)) reloadForNewVersion();
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main style={page}>
      <div style={{ maxWidth: 460 }}>
        <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>Something went wrong loading the portal</h1>
        <p style={{ margin: "0 0 20px", color: "#B8C0C4", lineHeight: 1.5 }}>
          Reloading the page usually fixes it. If you were filling in an application, your answers are saved on this device.
        </p>
        <button type="button" style={button} onClick={() => window.location.reload()}>Reload the page</button>
        <p style={{ margin: "20px 0 0", color: "#B8C0C4" }}>
          Still stuck? Email <a href="mailto:info@ds3.club" style={{ color: "#F48035" }}>info@ds3.club</a>.
        </p>
      </div>
    </main>;
  }
}
