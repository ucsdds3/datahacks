import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { NoIndex } from "@/components/NoIndex";
import { AccountWatcher } from "./AccountWatcher";
import { prefetchPortalPages } from "./pages";
import { portal } from "./paths";
import { ORGANIZER_BACKGROUND, THEME_BACKGROUND } from "./theme";
import { usePortalTheme } from "./portalTheme";
import { portalTitle } from "./titles";

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

  // Fetch the other pages now so moving between them is instant.
  useEffect(() => { prefetchPortalPages(); }, []);

  // No white behind the portal: paint the page dark (overscroll, a page still loading).
  // The current theme's colour; the organizer console's End look is its own green.
  const organizer = pathname.startsWith(portal.organizer);
  const theme = usePortalTheme();
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.backgroundColor;
    html.style.backgroundColor = organizer && theme === "end" ? ORGANIZER_BACKGROUND : THEME_BACKGROUND[theme];
    // Things drawn outside the portal frame (toasts) read the theme from here.
    html.dataset.portalTheme = theme;
    return () => {
      html.style.backgroundColor = before;
      delete html.dataset.portalTheme;
    };
  }, [organizer, theme]);

  return <AuthProvider><NoIndex /><AccountWatcher /><Outlet /></AuthProvider>;
}
