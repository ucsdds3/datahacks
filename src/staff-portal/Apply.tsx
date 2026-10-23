import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { applyPath, portal } from "@/portal/paths";
import { PortalFrame } from "./StaffPortalLayout";
import { StaffGate } from "./StaffGate";
import { useStaffAccess } from "./useStaffAccess";

/**
 * `/portal/apply/*`: signed in, not applied yet. Hackers and mentors/judges each
 * only see their own form; anyone who already has an application goes to it.
 */
export function ApplyLayout() {
  const access = useStaffAccess();
  const { session, loading } = useAuth();
  const { pathname } = useLocation();
  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "sp-nav-link active" : "sp-nav-link");

  if (!loading && !session) {
    return <Navigate to={portal.login(pathname.endsWith("mentor-judge") ? "mentor" : "hacker")} replace />;
  }
  if (access.state === "ready") return <Navigate to={portal.home} replace />;
  if (access.state === "loading" || access.state === "error") return <StaffGate access={access} loginRole="hacker" />;

  return (
    <PortalFrame
      nav={<NavLink to={pathname} className={linkClass}><ClipboardList size={18} /> Application</NavLink>}
    >
      <Outlet />
    </PortalFrame>
  );
}

/** `/portal/apply`: the form for the sign-in page they came from. */
export function ApplyRedirect() {
  return <Navigate to={applyPath()} replace />;
}
