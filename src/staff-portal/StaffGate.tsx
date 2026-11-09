import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { portal, type LoginRole } from "@/portal/paths";
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

/** What to show while the portal can't open yet: loading, signed out, or not applied yet. */
export function StaffGate({ access, loginRole }: { access: Exclude<StaffAccess, { state: "ready" }>; loginRole: LoginRole }) {
  switch (access.state) {
    case "loading":
      return <Screen title="Loading your portal…" />;
    case "signed-out":
      return <Navigate to={portal.login(loginRole)} replace />;
    case "error":
      return (
        <Screen title="We couldn't load your portal">
          <p>{access.message}</p>
          <p>Try refreshing. If it keeps happening, email <a href={`mailto:${GENERAL_CONTACT_EMAIL}`}>{GENERAL_CONTACT_EMAIL}</a>.</p>
        </Screen>
      );
    case "no-application":
      return <Navigate to={portal.apply} replace />;
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
