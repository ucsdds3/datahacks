import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { BookOpen, CalendarClock, ClipboardList, FileSignature, Gavel, LayoutDashboard, LogOut, Mail, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { portal as paths } from "@/portal/paths";
import { signOutEverywhere } from "@/portal/signIn";
import { StaffPortalProvider, useStaffPortal } from "./StaffPortalContext";
import { StaffGate } from "./StaffGate";
import { useStaffAccess } from "./useStaffAccess";
import { GENERAL_CONTACT_EMAIL, HANDBOOK_TITLE, TIMELINE, hasJudgeAccess, type PortalRole } from "./config";
import "./staff-portal.css";

type NavItem = { path: string; label: string; icon: ReactNode };

/** Which pages someone can open. Most of the portal opens once they're accepted. */
function navItems(portal: PortalRole, accepted: boolean, preview: boolean): NavItem[] {
  const items: NavItem[] = [
    { path: "", label: "Status", icon: <LayoutDashboard size={18} /> },
    { path: "/questions", label: "Application", icon: <ClipboardList size={18} /> },
  ];
  if (!accepted) return items;
  items.push(
    { path: "/handbook", label: HANDBOOK_TITLE[portal], icon: <BookOpen size={18} /> },
    { path: "/schedule", label: "Run of show", icon: <CalendarClock size={18} /> },
  );
  if (portal === "hacker" && (preview || Date.now() >= TIMELINE.mentorsTabOpens.getTime())) {
    items.push({ path: "/mentors", label: "Mentors", icon: <Users size={18} /> });
  }
  if (hasJudgeAccess(portal)) items.push({ path: "/judging", label: "Judging Portal", icon: <Gavel size={18} /> });
  items.push({ path: "/waiver", label: "Liability Waiver", icon: <FileSignature size={18} /> });
  return items;
}

/** Signs out, clears this browser, and reloads onto a sign-in page so nothing is left on screen. */
export const signOutTo = (loginPath: string) => signOutEverywhere().finally(() => window.location.replace(loginPath));

/** The sidebar's brand block and contact footer, shared with the Apply pages. */
export function PortalFrame({ nav, signOutPath, children }: { nav: ReactNode; signOutPath: string; children: ReactNode }) {
  const { session } = useAuth();
  return (
    <div className="sp-root">
      <aside className="sp-sidebar">
        <div className="sp-brand">
          <img src="/datahacks-logo.png" alt="" />
          <div>
            <strong>DataHacks 2027</strong>
            <span>Data Science Student Society</span>
          </div>
        </div>
        <nav className="sp-nav" aria-label="Portal">
          {nav}
        </nav>
        <div className="sp-sidebar-footer">
          <a href={`mailto:${GENERAL_CONTACT_EMAIL}`}><Mail size={14} aria-hidden /> {GENERAL_CONTACT_EMAIL}</a>
          {session && (
            <button className="sp-signout" onClick={() => signOutTo(signOutPath)}>
              <LogOut size={14} aria-hidden /> Sign out
            </button>
          )}
        </div>
      </aside>
      <main className="sp-main">{children}</main>
    </div>
  );
}

function Sidebar() {
  const { portal, basePath, status, preview } = useStaffPortal();
  // Keep a dev `?preview` while moving between pages.
  const { search } = useLocation();
  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "sp-nav-link active" : "sp-nav-link");
  return (
    <>
      {navItems(portal, status === "accepted", preview).map(item => (
        <NavLink key={item.path} to={{ pathname: basePath + item.path, search }} end={item.path === ""} className={linkClass}>
          {item.icon} {item.label}
        </NavLink>
      ))}
    </>
  );
}

export default function StaffPortalLayout({ portal }: { portal: PortalRole }) {
  const access = useStaffAccess(portal);
  const { pathname, search } = useLocation();

  if (access.state !== "ready") {
    return <StaffGate access={access} loginRole={portal === "judge" ? "judge" : portal === "hacker" ? "hacker" : "mentor"} />;
  }

  // Someone on another role's portal goes to their own, on the same page if they can open it there.
  const { type, status } = access.application;
  const page = pathname.slice(`/portal/${portal}`.length).replace(/\/$/, "");
  const allowed = navItems(type, status === "accepted", access.preview).some(item => item.path === page);
  if (type !== portal || !allowed) {
    return <Navigate to={{ pathname: `/portal/${type}${allowed ? page : ""}`, search }} replace />;
  }

  return (
    <StaffPortalProvider application={access.application} preview={access.preview}>
      <PortalFrame nav={<Sidebar />} signOutPath={paths.login(portal === "hacker" ? "hacker" : "mentor")}>
        <Outlet />
      </PortalFrame>
    </StaffPortalProvider>
  );
}
