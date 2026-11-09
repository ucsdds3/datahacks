import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { loginWithNext, portal, trimSlash, type LoginRole } from "@/portal/paths";
import { GENERAL_CONTACT_EMAIL } from "./config";
import { useStaffAccess, type StaffAccess } from "./useStaffAccess";
import { PortalBackdrop, useThemeClass } from "./PortalBackdrop";
import { ThemeToggle } from "./ThemeToggle";
import "./staff-portal.css";
import "./end-theme.css";
import "./nether/nether-theme.css";

/** A single card on the theme's backdrop: loading, sign-in and error screens. */
export function Screen({ title, children }: { title: string; children?: React.ReactNode }) {
  const themeClass = useThemeClass();
  return (
    <div className={`sp-root ${themeClass} sp-gate`}>
      <PortalBackdrop />
      <ThemeToggle className="sp-gate-theme" />
      <div className="sp-gate-glass">
        <section className="sp-card">
          <img src="/datahacks-logo.png" alt="" />
          <h1>{title}</h1>
          {children}
        </section>
      </div>
    </div>
  );
}

/** After this long, the loading screen says so and offers a reload instead of spinning on. */
export const SLOW_LOAD_MS = 12_000;

function LoadingScreen() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Screen title="Loading your portal…">
      {slow && (
        <div role="status">
          <p>This is taking longer than usual. Check your internet connection, then try again.</p>
          <button type="button" className="sp-button primary" onClick={() => window.location.reload()}>Try again</button>
        </div>
      )}
    </Screen>
  );
}

/** What to show while the portal can't open yet: loading, signed out, or not applied yet. */
export function StaffGate({ access, loginRole }: { access: Exclude<StaffAccess, { state: "ready" }>; loginRole: LoginRole }) {
  const { pathname, search } = useLocation();
  switch (access.state) {
    case "loading":
      return <LoadingScreen />;
    case "signed-out":
      // Back to this page after signing in (only deeper portal pages; /portal finds its own way).
      return <Navigate to={loginWithNext(loginRole, trimSlash(pathname) === portal.home ? null : `${trimSlash(pathname)}${search}`)} replace />;
    case "error":
      return (
        <Screen title="We couldn't load your portal">
          <p>{access.message}</p>
          {access.retry && <button type="button" className="sp-button primary" onClick={access.retry}>Try again</button>}
          <p>If it keeps happening, email <a href={`mailto:${GENERAL_CONTACT_EMAIL}`}>{GENERAL_CONTACT_EMAIL}</a>.</p>
        </Screen>
      );
    case "no-application":
      // A mentor or judge link (or sign-in) goes to their form, whatever this browser remembered.
      return <Navigate to={loginRole === "hacker" ? portal.apply : portal.applyStaff} replace />;
  }
}

/** `/portal`: sends each person to the portal for what they applied as, or to apply. */
export default function PortalHome() {
  const access = useStaffAccess();
  const { isOrganizer, loading } = useAuth();
  const { search } = useLocation();
  if (access.state === "no-application" && !loading && isOrganizer) return <Navigate to={portal.organizer} replace />;
  if (access.state !== "ready") return <StaffGate access={access} loginRole="hacker" />;
  return <Navigate to={{ pathname: `/portal/${access.application.type}`, search }} replace />;
}
