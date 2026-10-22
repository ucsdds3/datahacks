import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { Code2, GraduationCap, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { portal } from "@/portal/paths";
import { PortalFrame } from "./StaffPortalLayout";
import { Screen, StaffGate } from "./StaffGate";
import { TIMELINE } from "./config";
import { useStaffAccess } from "./useStaffAccess";

const formatDate = (value: Date) => value.toLocaleDateString("en-US", { month: "long", day: "numeric" });

/** `/portal/apply/*`: signed in, not applied yet. Anyone who already has an application goes to it. */
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
      nav={<>
        <NavLink to={portal.apply} end className={linkClass}><Sparkles size={18} /> Apply</NavLink>
        <NavLink to={portal.applyHacker} className={linkClass}><Code2 size={18} /> As a hacker</NavLink>
        <NavLink to={portal.applyStaff} className={linkClass}><GraduationCap size={18} /> As a mentor or judge</NavLink>
      </>}
    >
      <Outlet />
    </PortalFrame>
  );
}

/** `/portal/apply`: pick which application to fill out. */
export function ApplyChooser() {
  const { session } = useAuth();
  if (!session) return <Screen title="Loading…" />;
  return (
    <div className="sp-page">
      <header className="sp-page-header">
        <h1>Apply to DataHacks</h1>
        <p>
          Signed in as {session.user.email}. Priority applications close {formatDate(TIMELINE.priorityDeadline)};
          regular applications close {formatDate(TIMELINE.regularDeadline)}.
        </p>
      </header>
      <div className="sp-choices">
        <Link to={portal.applyHacker} className="sp-card sp-choice">
          <Code2 size={28} aria-hidden />
          <h2>I want to hack</h2>
          <p>Build a data science project with a team over the weekend.</p>
        </Link>
        <Link to={portal.applyStaff} className="sp-card sp-choice">
          <GraduationCap size={28} aria-hidden />
          <h2>I want to mentor or judge</h2>
          <p>Help hackers during the event, judge final projects, or both.</p>
        </Link>
      </div>
    </div>
  );
}
