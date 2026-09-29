import { Component, type ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Catches the portal failing to start — in practice, a build made without the
 * Supabase values, where the client throws as soon as it is imported. Without
 * this the error unmounts the whole tree and the visitor gets a white screen.
 */
export class PortalBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error("Application portal failed to start:", error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#16181a", color: "#EFF1F2", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
      <div>
        <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>The application portal isn’t available yet.</h1>
        <p style={{ margin: "0 0 20px", color: "#9BA5AB" }}>Applications open in October. Questions: <a href="mailto:info@ds3.club" style={{ color: "#F48035" }}>info@ds3.club</a></p>
        <Link to="/" style={{ color: "#12B2C8" }}>Back to DataHacks</Link>
      </div>
    </main>;
  }
}
