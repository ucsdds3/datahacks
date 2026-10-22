/**
 * Where the application portal lives. One place, because these paths are also
 * registered with Supabase as OAuth redirect URLs — a path that drifts in one
 * file breaks sign-in without breaking the build.
 */
export type PortalRole = "hacker" | "judge" | "mentor";

export const portal = {
  login: (role: PortalRole) => `/login/${role}`,
  dashboard: (role: PortalRole) => `/dashboard/${role}`,
  callback: "/auth/callback",
  application: "/apply",
};
