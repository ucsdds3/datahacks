import { useRef } from "react";
import { Navigate, NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { closedTitle, fetchApplicationWindow } from "@/portal/event";
import { applyPath, portal, trimSlash } from "@/portal/paths";
import { GENERAL_CONTACT_EMAIL } from "./config";
import { PortalFrame } from "./StaffPortalLayout";
import { StaffGate } from "./StaffGate";
import { useStaffAccess } from "./useStaffAccess";

/**
 * `/portal/apply/*`: signed in, not applied yet. Hackers and mentors/judges each
 * only see their own form; anyone who already has an application goes to it.
 * While the event isn't taking applications (events.applications_open), the
 * form is replaced by when they open.
 *
 * In `npm run dev`, `?preview` shows the form without signing in (to look at it;
 * submitting needs a session, so nothing is sent).
 *
 * Signed out while a form is open (in another tab, or the sign-in expired)? The
 * form stays, with its answers: it says what happened and offers to sign in again.
 */
export function ApplyLayout() {
  const access = useStaffAccess();
  const { session, loading } = useAuth();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const preview = import.meta.env.DEV && params.has("preview");
  // GitHub Pages adds a slash to a loaded link: /portal/apply/mentor-judge/.
  const loginRole = trimSlash(pathname).endsWith("mentor-judge") ? "mentor" : "hacker";
  const applications = useQuery({
    queryKey: ["application-window"],
    queryFn: fetchApplicationWindow,
    enabled: access.state === "no-application",
    staleTime: 60_000,
  });
  // The account the form was opened for, so losing the session afterwards keeps it on screen.
  const openedFor = useRef<string | null>(null);
  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "sp-nav-link active" : "sp-nav-link");

  const leftMidForm = openedFor.current !== null && session?.user.id !== openedFor.current;
  if (!preview && !leftMidForm) {
    if (!loading && !session) return <Navigate to={portal.login(loginRole)} replace />;
    if (access.state === "ready") return <Navigate to={portal.home} replace />;
    if (access.state === "loading" || access.state === "error") return <StaffGate access={access} loginRole={loginRole} />;
    // A failed read shows the form anyway: the database still refuses a closed event.
    if (applications.isPending) return <StaffGate access={{ state: "loading" }} loginRole={loginRole} />;
  }
  const closed = !preview && !leftMidForm && applications.data?.open === false;
  if (!preview && !closed && session && openedFor.current === null) openedFor.current = session.user.id;

  return (
    <PortalFrame
      nav={<NavLink to={pathname} className={linkClass}><ClipboardList size={18} /> Application</NavLink>}
      signOutPath={portal.login(loginRole)}
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
        <p>
          {opensAt && new Date(opensAt) > new Date()
            ? "The application form will be here as soon as they open. You're signed in, so just come back to this page."
            : "We're not taking applications at the moment. If you'd started one on this device, your answers are still saved here."}
        </p>
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
