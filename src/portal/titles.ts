import { HACKER_GUIDE_PAGES } from "@/staff-portal/config";

// Kept apart from PortalShell so it can be tested without the Supabase client.

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
