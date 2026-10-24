import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { closedTitle, fetchApplicationWindow } from "@/portal/event";
import { applyPath, portal } from "@/portal/paths";
import { GENERAL_CONTACT_EMAIL } from "./config";
import { PortalFrame } from "./StaffPortalLayout";
import { StaffGate } from "./StaffGate";
import { useStaffAccess } from "./useStaffAccess";

/**
 * `/portal/apply/*`: signed in, not applied yet. Hackers and mentors/judges each
 * only see their own form; anyone who already has an application goes to it.
 * While the event isn't taking applications (events.applications_open), the
 * form is replaced by when they open.
 */
export function ApplyLayout() {
  const access = useStaffAccess();
  const { session, loading } = useAuth();
  const { pathname } = useLocation();
  const applications = useQuery({
    queryKey: ["application-window"],
    queryFn: fetchApplicationWindow,
    enabled: access.state === "no-application",
    staleTime: 60_000,
  });
  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "sp-nav-link active" : "sp-nav-link");

  if (!loading && !session) {
    return <Navigate to={portal.login(pathname.endsWith("mentor-judge") ? "mentor" : "hacker")} replace />;
  }
  if (access.state === "ready") return <Navigate to={portal.home} replace />;
  if (access.state === "loading" || access.state === "error") return <StaffGate access={access} loginRole="hacker" />;
  // A failed read shows the form anyway: the database still refuses a closed event.
  if (applications.isPending) return <StaffGate access={{ state: "loading" }} loginRole="hacker" />;
  const closed = applications.data?.open === false;

  return (
    <PortalFrame
      nav={<NavLink to={pathname} className={linkClass}><ClipboardList size={18} /> Application</NavLink>}
      signOutPath={portal.login(pathname.endsWith("mentor-judge") ? "mentor" : "hacker")}
    >
      {closed ? <ApplicationsClosed opensAt={applications.data!.opensAt} /> : <Outlet />}
    </PortalFrame>
  );
}

function ApplicationsClosed({ opensAt }: { opensAt: string | null }) {
  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>{closedTitle(opensAt)}</h1>
        <p>The application form will be here as soon as they open. You're signed in, so just come back to this page.</p>
      </header>
      <section className="sp-card">
        <p>Questions? Email <a href={`mailto:${GENERAL_CONTACT_EMAIL}`}>{GENERAL_CONTACT_EMAIL}</a>.</p>
      </section>
    </div>
  );
}

/** `/portal/apply`: the form for the sign-in page they came from. */
export function ApplyRedirect() {
  return <Navigate to={applyPath()} replace />;
}
