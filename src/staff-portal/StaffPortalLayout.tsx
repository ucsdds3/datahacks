import { NavLink, Outlet, useLocation } from "react-router-dom";
import { BookOpen, FileSignature, LayoutDashboard } from "lucide-react";
import { StaffPortalProvider, useStaffPortal } from "./StaffPortalContext";
import "./staff-portal.css";

function Sidebar() {
  const { status } = useStaffPortal();
  // Keep a `?status=` preview while moving between pages.
  const { search } = useLocation();
  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "sp-nav-link active" : "sp-nav-link");

  return (
    <aside className="sp-sidebar">
      <div className="sp-brand">
        <img src="/datahacks-logo.png" alt="" />
        <div>
          <strong>DataHacks</strong>
          <span>Mentor & Judge Portal</span>
        </div>
      </div>
      <nav className="sp-nav" aria-label="Portal">
        <NavLink to={{ pathname: "/portal", search }} end className={linkClass}>
          <LayoutDashboard size={18} /> Dashboard
        </NavLink>
        {status === "accepted" && (
          <NavLink to={{ pathname: "/portal/waiver", search }} className={linkClass}>
            <FileSignature size={18} /> Liability waiver
          </NavLink>
        )}
        <NavLink to={{ pathname: "/portal/handbook", search }} className={linkClass}>
          <BookOpen size={18} /> Mentor handbook
        </NavLink>
      </nav>
    </aside>
  );
}

export default function StaffPortalLayout() {
  return (
    <StaffPortalProvider>
      <div className="sp-root">
        <Sidebar />
        <main className="sp-main">
          <Outlet />
        </main>
      </div>
    </StaffPortalProvider>
  );
}
