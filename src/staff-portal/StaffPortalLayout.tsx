import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { BookOpen, FileSignature, Gavel, LayoutDashboard } from "lucide-react";
import { StaffPortalProvider, useStaffPortal } from "./StaffPortalContext";
import { StaffGate } from "./StaffGate";
import { useStaffAccess } from "./useStaffAccess";
import { HANDBOOK_TITLE, hasJudgeAccess, type PortalRole } from "./config";
import "./staff-portal.css";

function Sidebar() {
  const { portal, basePath, status } = useStaffPortal();
  // Keep a dev `?preview` while moving between pages.
  const { search } = useLocation();
  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "sp-nav-link active" : "sp-nav-link");

  return (
    <aside className="sp-sidebar">
      <div className="sp-brand">
        <img src="/datahacks-logo.png" alt="" />
        <div>
          <strong>DataHacks 2027</strong>
          <span>Data Science Student Society</span>
        </div>
      </div>
      <nav className="sp-nav" aria-label="Portal">
        <NavLink to={{ pathname: basePath, search }} end className={linkClass}>
          <LayoutDashboard size={18} /> Dashboard
        </NavLink>
        {status === "accepted" && (
          <NavLink to={{ pathname: `${basePath}/waiver`, search }} className={linkClass}>
            <FileSignature size={18} /> Liability Waiver
          </NavLink>
        )}
        <NavLink to={{ pathname: `${basePath}/handbook`, search }} className={linkClass}>
          <BookOpen size={18} /> {HANDBOOK_TITLE[portal]}
        </NavLink>
        {hasJudgeAccess(portal) && (
          <NavLink to={{ pathname: `${basePath}/judging`, search }} className={linkClass}>
            <Gavel size={18} /> Judging Portal
          </NavLink>
        )}
      </nav>
    </aside>
  );
}

export default function StaffPortalLayout({ portal }: { portal: PortalRole }) {
  const access = useStaffAccess(portal);
  const { pathname, search } = useLocation();

  if (access.state !== "ready") return <StaffGate access={access} loginRole={portal === "judge" ? "judge" : "mentor"} />;

  // Someone on another role's portal goes to their own, on the same page where it exists.
  const { type } = access.application;
  if (type !== portal) {
    const page = pathname.slice(`/portal/${portal}`.length);
    const target = page === "/judging" && !hasJudgeAccess(type) ? "" : page;
    return <Navigate to={{ pathname: `/portal/${type}${target}`, search }} replace />;
  }

  return (
    <StaffPortalProvider application={access.application} preview={access.preview}>
      <div className="sp-root">
        <Sidebar />
        <main className="sp-main">
          <Outlet />
        </main>
      </div>
    </StaffPortalProvider>
  );
}
