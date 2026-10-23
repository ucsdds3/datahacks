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
