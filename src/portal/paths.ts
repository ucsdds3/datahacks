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
  hackerDashboard: "/dashboard/hacker",
  application: "/apply",
  staffApplication: "/apply/mentor-judge",
  /** Opens the mentor, judge or hybrid portal matching the person's application. */
  staffPortal: "/portal",
  /** Where someone with this role lands after signing in. */
  home: (role: Role) => (role === "hacker" ? "/dashboard/hacker" : "/portal"),
};
