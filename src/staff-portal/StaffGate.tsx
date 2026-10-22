import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { portal } from "@/portal/paths";
import { GENERAL_CONTACT_EMAIL } from "./config";
import { useStaffAccess, type StaffAccess } from "./useStaffAccess";
import "./staff-portal.css";

function Screen({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="sp-root sp-gate">
      <section className="sp-card">
        <img src="/datahacks-logo.png" alt="" />
        <h1>{title}</h1>
        {children}
      </section>
    </div>
  );
}

/** What to show while the portal can't open yet: loading, signed out, no application. */
export function StaffGate({ access, loginRole }: { access: Exclude<StaffAccess, { state: "ready" }>; loginRole: "mentor" | "judge" }) {
  const navigate = useNavigate();
  const switchAccount = async () => {
    await supabase.auth.signOut();
    navigate(portal.login(loginRole));
  };

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
      return (
        <Screen title="No application found">
          <p>We couldn't find a mentor or judge application for <strong>{access.email}</strong>.</p>
          <p>Apply now, or if you applied with another Google account, sign in with that one. Questions: <a href={`mailto:${GENERAL_CONTACT_EMAIL}`}>{GENERAL_CONTACT_EMAIL}</a>.</p>
          <Link className="sp-button" to={portal.staffApplication}>Apply as a mentor or judge</Link>
          <button className="sp-button" onClick={switchAccount}>Use a different account</button>
        </Screen>
      );
  }
}

/** `/portal`: sends each person to the portal for what they applied as. */
export default function PortalHome() {
  const access = useStaffAccess();
  const { search } = useLocation();
  if (access.state !== "ready") return <StaffGate access={access} loginRole="mentor" />;
  return <Navigate to={{ pathname: `/portal/${access.application.type}`, search }} replace />;
}
