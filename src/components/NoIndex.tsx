import { useEffect } from "react";

/**
 * Keeps a route out of search results.
 *
 * robots.txt only asks a crawler not to fetch the page; it does not stop the URL
 * being indexed when something links to it. This adds the meta tag that actually
 * suppresses it, and removes it again on unmount so a client-side navigation back
 * to the real site does not leave the tag behind.
 *
 * Used on the design mockups, which carry placeholder dates and figures.
 */
export function NoIndex() {
  useEffect(() => {
    const tag = document.createElement("meta");
    tag.name = "robots";
    tag.content = "noindex, nofollow";
    document.head.appendChild(tag);
    return () => { tag.remove(); };
  }, []);
  return null;
}
