/**
 * Where the application portal lives. One place, because these paths are also
 * registered with Supabase as OAuth redirect URLs — a path that drifts in one
 * file breaks sign-in without breaking the build.
 */

/** What someone is, as the database says. Mentors, judges and hybrids are accepted staff. */
export type Role = "hacker" | "mentor" | "judge" | "hybrid";

/** The sign-in pages. Hybrids sign in through either staff page. */
export type LoginRole = "hacker" | "judge" | "mentor";

export const portal = {
  login: (role: LoginRole) => `/login/${role}`,
  callback: "/auth/callback",
  /** Opens the right section for the person: their application's portal, Apply, or the organizer console. */
  home: "/portal",
  apply: "/portal/apply",
  applyHacker: "/portal/apply/hacker",
  applyStaff: "/portal/apply/mentor-judge",
  organizer: "/portal/organizer",
  /** The organizer sign-in. Not linked from the site: organizers bookmark it. */
  organizerLogin: "/organizer",
  /** Where Supabase Auth's OAuth server sends people to approve an AI assistant (MCP client). Set as the Authorization Path in the dashboard. */
  oauthConsent: "/oauth/consent",
};

/** Which application a signed-in person without one should see: set by the sign-in page they used. */
export type ApplyAs = "hacker" | "staff";
const APPLY_AS_KEY = "datahacks.applyAs";

export function rememberApplyAs(kind: ApplyAs) {
  try { localStorage.setItem(APPLY_AS_KEY, kind); } catch { /* storage blocked: falls back to hacker */ }
}

export function applyPath(): string {
  let kind: string | null = null;
  try { kind = localStorage.getItem(APPLY_AS_KEY); } catch { /* storage blocked */ }
  return kind === "staff" ? portal.applyStaff : portal.applyHacker;
}

/**
 * A pathname without the trailing slash GitHub Pages adds when a link is loaded
 * directly (/portal/apply/mentor-judge/). Match routes on this, never on the raw
 * pathname: "…/mentor-judge/".endsWith("mentor-judge") is false.
 */
export const trimSlash = (pathname: string) => pathname.replace(/(.)\/+$/, "$1");

/**
 * Where to go back to after signing in, from a `next` the URL carried: a portal
 * page only (anyone can edit the URL), so never another site or the organizer
 * console from an applicant sign-in.
 */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/portal/") || value.startsWith("//") || value.includes("\\")) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\s\x00-\x1f]/.test(value)) return null;
  return value;
}

/** A sign-in page that brings the person back to `next` (a portal page) afterwards. */
export function loginWithNext(role: LoginRole, next?: string | null): string {
  const safe = safeNext(next);
  return safe ? `${portal.login(role)}?${new URLSearchParams({ next: safe })}` : portal.login(role);
}
