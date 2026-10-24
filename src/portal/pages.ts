// The portal's pages, each its own chunk. App.tsx lazy-loads them by route, and
// PortalShell fetches the rest in the background once the portal is open, so moving
// between pages doesn't wait on the network.

export const portalPages = {
  signIn: () => import("@/pages/SignIn"),
  authCallback: () => import("@/pages/AuthCallback"),
  home: () => import("@/staff-portal/StaffGate"),
  layout: () => import("@/staff-portal/StaffPortalLayout"),
  apply: () => import("@/staff-portal/Apply"),
  hackerApplication: () => import("@/staff-portal/HackerApplication"),
  staffApplication: () => import("@/staff-portal/StaffApplication"),
  status: () => import("@/staff-portal/Dashboard"),
  questions: () => import("@/staff-portal/Questions"),
  schedule: () => import("@/staff-portal/Schedule"),
  mentors: () => import("@/staff-portal/Mentors"),
  waiver: () => import("@/staff-portal/Waiver"),
  handbook: () => import("@/staff-portal/Handbook"),
  hackerGuide: () => import("@/staff-portal/HackerGuide"),
  judging: () => import("@/staff-portal/JudgingPortal"),
  organizer: () => import("@/organizer/OrganizerConsole"),
  oauthConsent: () => import("@/pages/OAuthConsent"),
};

/** Fetch every page chunk when the browser is idle. Already-loaded ones cost nothing. */
export function prefetchPortalPages() {
  const load = () => Object.values(portalPages).forEach(page => page().catch(() => {}));
  if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 3000 });
  else setTimeout(load, 1000);
}
