import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { EndSky } from "@/staff-portal/EndSky";
import { trimSlash } from "@/portal/paths";
import "@/staff-portal/staff-portal.css";
import "@/staff-portal/end-theme.css";
import "./not-found.css";

/**
 * Any address the site doesn't have (a mistyped flyer link, an old portal page).
 * Drawn like the portal's sign-in cards in the End theme. Loaded on demand, so the
 * portal's styles stay out of the home page's bundle.
 */
export default function NotFound() {
  const { pathname } = useLocation();
  const inPortal = /^\/(portal|login|organizer)(\/|$)/.test(trimSlash(pathname));

  useEffect(() => {
    console.error("404: no page at", pathname);
  }, [pathname]);

  useEffect(() => {
    const before = document.title;
    document.title = "Page not found · DataHacks";
    return () => { document.title = before; };
  }, []);

  return (
    <div className="sp-root sp-end sp-gate sp-not-found">
      <EndSky />
      <main className="sp-gate-glass">
        <section className="sp-card">
          <img src="/datahacks-logo.png" alt="" />
          <h1>Page not found</h1>
          <p>There's no page at this address. The link may have a typo, or the page may have moved.</p>
          <nav className="sp-not-found-links" aria-label="Where to go instead">
            {inPortal
              ? <Link className="sp-button primary" to="/portal">Back to your portal</Link>
              : <Link className="sp-button primary" to="/apply">Apply to DataHacks</Link>}
            <Link className="sp-button" to="/">DataHacks home page</Link>
          </nav>
          <p>Questions? Email <a href="mailto:info@ds3.club">info@ds3.club</a>.</p>
        </section>
      </main>
    </div>
  );
}
