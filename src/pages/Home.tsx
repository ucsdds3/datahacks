import { useEffect, useState } from "react";
import Renovation from "./Renovation";

/** Set while this page is loading the real homepage, so a missing homepage can't reload forever. */
const REDIRECT_KEY = "datahacks.homeRedirect";
// Locally the homepage is served straight from public/home/.
const HOMEPAGE = import.meta.env.DEV ? "/home/index.html" : "/";

const justTried = () => {
  try {
    return Date.now() - Number(sessionStorage.getItem(REDIRECT_KEY)) < 10_000;
  } catch {
    return false;
  }
};

/**
 * The homepage is the DataCraft site: a separate static build in public/home/ that the deploy puts at
 * /index.html (see the "Homepage" step in deploy.yml). This route only renders when the app itself lands on
 * "/" (a link inside the portal, or local dev), and it loads that page. If the page isn't there (a deploy
 * that skipped the step), it shows the holding page instead of reloading forever.
 */
export default function Home() {
  const [fallback] = useState(justTried);

  useEffect(() => {
    if (fallback) {
      try { sessionStorage.removeItem(REDIRECT_KEY); } catch { /* storage blocked */ }
      return;
    }
    try { sessionStorage.setItem(REDIRECT_KEY, String(Date.now())); } catch { /* storage blocked */ }
    window.location.replace(HOMEPAGE);
  }, [fallback]);

  return fallback ? <Renovation /> : null;
}
