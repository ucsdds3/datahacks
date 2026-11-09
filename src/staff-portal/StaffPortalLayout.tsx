import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BookOpen, Bus, CalendarClock, ClipboardList, Cpu, FileSignature, Gavel, HandHelping, LayoutDashboard, Library, LogOut, Mail,
  Plane, Receipt, Send, Trophy, Users, UtensilsCrossed, Waypoints,
} from "lucide-react";
import { Suspense, useLayoutEffect, useRef, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { portal as paths } from "@/portal/paths";
import { signOutEverywhere } from "@/portal/signIn";
import { usePortalTheme } from "@/portal/portalTheme";
import { StaffPortalProvider, useStaffPortal } from "./StaffPortalContext";
import { StaffGate } from "./StaffGate";
import { useStaffAccess } from "./useStaffAccess";
import { GENERAL_CONTACT_EMAIL, HACKER_GUIDE_PAGES, HANDBOOK_TITLE, hasJudgeAccess, type PortalRole } from "./config";
import { PortalBackdrop, useThemeClass } from "./PortalBackdrop";
import { ThemeToggle } from "./ThemeToggle";
import "./staff-portal.css";
import "./end-theme.css";
import "./nether/nether-theme.css";

type NavItem = { path: string; label: string; icon: ReactNode };

const GUIDE_ICONS: Record<(typeof HACKER_GUIDE_PAGES)[number]["slug"], ReactNode> = {
  resources: <Library size={18} />,
  transportation: <Bus size={18} />,
  travel: <Plane size={18} />,
  reimbursement: <Receipt size={18} />,
  schedule: <CalendarClock size={18} />,
  food: <UtensilsCrossed size={18} />,
  mentorship: <HandHelping size={18} />,
  prizes: <Trophy size={18} />,
  tracks: <Waypoints size={18} />,
  hardware: <Cpu size={18} />,
  devpost: <Send size={18} />,
};

/** Which pages someone can open. Most of the portal opens once they're accepted. */
function navItems(portal: PortalRole, accepted: boolean): NavItem[] {
  const items: NavItem[] = [
    { path: "", label: "Status", icon: <LayoutDashboard size={18} /> },
    { path: "/questions", label: "Application", icon: <ClipboardList size={18} /> },
  ];
  if (!accepted) return items;
  if (portal === "hacker") {
    // The handbook, a page per topic, then who's mentoring. The Mentors tab is meant to
    // open the morning of the event (TIMELINE.mentorsTabOpens); it's always on while
    // organizers test it. To bring the gate back, push it only when
    // `preview || Date.now() >= TIMELINE.mentorsTabOpens.getTime()`.
    items.push(...HACKER_GUIDE_PAGES.map(p => ({ path: `/${p.slug}`, label: p.label, icon: GUIDE_ICONS[p.slug] })));
    items.push({ path: "/mentors", label: "Mentors", icon: <Users size={18} /> });
  } else {
    items.push(
      { path: "/handbook", label: HANDBOOK_TITLE[portal], icon: <BookOpen size={18} /> },
      { path: "/schedule", label: "Run of show", icon: <CalendarClock size={18} /> },
    );
  }
  if (hasJudgeAccess(portal)) items.push({ path: "/judging", label: "Judging Portal", icon: <Gavel size={18} /> });
  items.push({ path: "/waiver", label: "Liability Waiver", icon: <FileSignature size={18} /> });
  return items;
}

/** Signs out, clears this browser, and reloads onto a sign-in page so nothing is left on screen. */
export const signOutTo = (loginPath: string) => signOutEverywhere().finally(() => window.location.replace(loginPath));

/**
 * Who this browser is signed in as, next to Sign out. The whole site shares one
 * session per browser, so this is how someone spots that another tab switched it.
 */
export function SignedInAs({ email, onSignOut, signOut = true }: { email: string; onSignOut: () => void; signOut?: boolean }) {
  return (
    <div className="sp-account">
      <p className="sp-account-who">
        <span className="sp-account-label">Signed in as</span>
        <span className="sp-account-email" title={email}>{email || "an account without an email"}</span>
      </p>
      {signOut && (
        <button className="sp-signout" onClick={onSignOut}>
          <LogOut size={14} aria-hidden /> Sign out
        </button>
      )}
    </div>
  );
}

/** The sidebar's brand block and contact footer, shared with the Apply pages. */
export function PortalFrame({ nav, signOutPath, children }: { nav: ReactNode; signOutPath: string; children: ReactNode }) {
  const { session } = useAuth();
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);
  // On phones the nav is a strip of tabs that scrolls sideways: keep the current page's tab in view.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>(".active");
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const left = active.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
    nav.scrollLeft = Math.max(0, left - (nav.clientWidth - active.offsetWidth) / 2);
  }, [pathname]);
  const themeClass = useThemeClass();
  return (
    <div className={`sp-root ${themeClass}`}>
      <PortalBackdrop />
      {/* The tempered-glass sheet over the painting; the sidebar is a second pane on it. */}
      <div className="sp-shell">
        <aside className="sp-sidebar">
          <div className="sp-brand">
            <img src="/datahacks-logo.png" alt="" />
            <div><strong>DataHacks</strong><span>Portal</span></div>
          </div>
          <nav className="sp-nav" aria-label="Portal" ref={navRef}>
            {nav}
          </nav>
          <div className="sp-sidebar-footer">
            <ThemeToggle />
            {/* The organizers' inbox, not the account: labelled so nobody mistakes it for who's signed in. */}
            <a className="sp-contact" href={`mailto:${GENERAL_CONTACT_EMAIL}`} title="Email the organizers">
              <Mail size={14} aria-hidden /> <span>Questions? <span className="sp-contact-email">{GENERAL_CONTACT_EMAIL}</span></span>
            </a>
            {session && <SignedInAs email={session.user.email ?? ""} onSignOut={() => signOutTo(signOutPath)} />}
          </div>
        </aside>
        {/* Pages load on demand; while one does, the frame stays and the page area stays dark. */}
        <main className="sp-main"><Suspense fallback={<div className="sp-page" aria-busy="true" />}>{children}</Suspense></main>
      </div>
    </div>
  );
}

/** The pages about someone's own application; the Nether sidebar heads them "Application" and the rest "Event info". */
const APPLICATION_PAGES = ["", "/questions"];

function Sidebar() {
  const { portal, basePath, status } = useStaffPortal();
  // Keep a dev `?preview` while moving between pages.
  const { search } = useLocation();
  const nether = usePortalTheme() === "nether";
  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "sp-nav-link active" : "sp-nav-link");
  const items = navItems(portal, status === "accepted");
  const links = (list: NavItem[]) => list.map(item => (
    <NavLink key={item.path} to={{ pathname: basePath + item.path, search }} end={item.path === ""} className={linkClass}>
      {item.icon} {item.label}
    </NavLink>
  ));
  if (!nether) return <>{links(items)}</>;
  // The Nether design hangs the signs in two labelled groups. Same links, same order: the
  // application pages come first in navItems, so splitting them off leaves the order alone.
  const groups = [
    { label: "Application", items: items.filter(item => APPLICATION_PAGES.includes(item.path)) },
    { label: "Event info", items: items.filter(item => !APPLICATION_PAGES.includes(item.path)) },
  ];
  return (
    <>
      {groups.filter(group => group.items.length > 0).map(group => (
        <div key={group.label} className="sp-nav-group" role="group" aria-label={group.label}>
          <span className="sp-nav-group-label" aria-hidden="true">{group.label}</span>
          {links(group.items)}
        </div>
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
  const requested = pathname.slice(`/portal/${portal}`.length).replace(/\/$/, "");
  // Hackers' handbook is now split into pages; old handbook links open the first one.
  const page = type === "hacker" && requested === "/handbook" ? "/resources" : requested;
  const allowed = navItems(type, status === "accepted").some(item => item.path === page);
  if (type !== portal || !allowed || page !== requested) {
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
