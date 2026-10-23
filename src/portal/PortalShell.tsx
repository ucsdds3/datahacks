import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { NoIndex } from "@/components/NoIndex";
import { HACKER_GUIDE_PAGES } from "@/staff-portal/config";
import { prefetchPortalPages } from "./pages";

const PORTAL = "DataHacks Application Portal";

/** Portal pages, by the last part of /portal/<role>/<page>. */
const PAGE_NAMES: Record<string, string> = {
  "": "Status",
  questions: "Application",
  handbook: "Handbook",
  ...Object.fromEntries(HACKER_GUIDE_PAGES.map(p => [p.slug, p.label])),
  schedule: "Run of Show",
  waiver: "Liability Waiver",
  judging: "Judging",
  mentors: "Mentors",
};

/** The portal's dark page colour, behind everything while a portal page is open. */
const PORTAL_BACKGROUND = "#26382f";

/** The browser tab's name for a portal page, so it reads as the portal rather than the main site. */
export function portalTitle(pathname: string): string {
  const path = pathname.replace(/\/+$/, "");
  if (path === "/portal/organizer") return "Organizer Console · DataHacks";
  if (path === "/organizer") return "Organizer Sign In · DataHacks";
  if (path.startsWith("/login/")) return `Sign In · ${PORTAL}`;
  if (path === "/auth/callback") return `Signing In · ${PORTAL}`;
  if (path === "/portal/apply/hacker") return `Hacker Application · ${PORTAL}`;
  if (path === "/portal/apply/mentor-judge") return `Mentor & Judge Application · ${PORTAL}`;
  const page = path.match(/^\/portal\/(?:hacker|mentor|judge|hybrid)(?:\/([a-z]+))?$/);
  if (page) return `${PAGE_NAMES[page[1] ?? ""] ?? "Portal"} · ${PORTAL}`;
  return PORTAL;
}

/**
 * Everything that needs a signed-in user lives under this.
 *
 * It is loaded lazily, and that is the point: AuthProvider pulls in the Supabase
 * client, which throws at import when VITE_SUPABASE_URL is missing. Wrapped round
 * the whole app, a build without those values took the public holding page down
 * with it. Here the client is only fetched when someone opens a portal route.
 */
export default function PortalShell() {
  const { pathname } = useLocation();

  // Name the tab after the portal page; put the site's own title back on the way out.
  useEffect(() => {
    const siteTitle = document.title;
    return () => { document.title = siteTitle; };
  }, []);
  useEffect(() => { document.title = portalTitle(pathname); }, [pathname]);

  // No white behind the portal: paint the page dark (overscroll, a page still loading),
  // and fetch the other pages now so moving between them is instant.
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.backgroundColor;
    html.style.backgroundColor = PORTAL_BACKGROUND;
    prefetchPortalPages();
    return () => { html.style.backgroundColor = before; };
  }, []);

  return <AuthProvider><NoIndex /><Outlet /></AuthProvider>;
}
