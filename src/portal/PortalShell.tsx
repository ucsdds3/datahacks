import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { NoIndex } from "@/components/NoIndex";
import { prefetchPortalPages } from "./pages";
import { portalTitle } from "./titles";

/** The portal's dark page colour, behind everything while a portal page is open. */
const PORTAL_BACKGROUND = "#26382f";

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
