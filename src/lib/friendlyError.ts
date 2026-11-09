// Plain-English versions of the errors an applicant can hit while the portal loads
// or saves something. The raw text ("TypeError: Failed to fetch", "JWT expired",
// "new row violates row-level security policy…") goes to the console, not the page.

import { GENERAL_CONTACT_EMAIL } from "@/staff-portal/config";

export type ErrorKind = "network" | "session" | "unavailable" | "other";

type ErrorLike = { message?: unknown; code?: unknown; status?: unknown; name?: unknown } | null | undefined;

// Chromium "Failed to fetch", Safari "Load failed", Firefox "NetworkError when attempting
// to fetch resource.", React Native / node "Network request failed" / "fetch failed".
const NETWORK = /failed to fetch|load failed|networkerror|network request failed|fetch failed|internet connection appears to be offline/i;
// An expired or missing sign-in: PostgREST's JWT errors, a 401, or row-level security
// refusing a request that arrived without the applicant's sign-in.
const SESSION_CODES = new Set(["PGRST301", "PGRST302", "PGRST303", "42501", "refresh_token_not_found", "session_not_found"]);
const SESSION = /jwt expired|invalid jwt|jwt.*(malformed|invalid)|row-level security|refresh token|auth session missing|session.*expired/i;

/** What kind of failure this is, so the page can say what to do next. */
export function errorKind(error: unknown): ErrorKind {
  const e = (typeof error === "object" ? error : { message: String(error) }) as ErrorLike;
  const message = typeof e?.message === "string" ? e.message : String(error ?? "");
  const code = typeof e?.code === "string" ? e.code : "";
  if (NETWORK.test(message) || e?.name === "AuthRetryableFetchError") return "network";
  if (SESSION_CODES.has(code) || e?.status === 401 || SESSION.test(message)) return "session";
  // currentEventId() / fetchApplicationWindow() when the event row is missing (portal/event.ts).
  if (/^No event with code /.test(message)) return "unavailable";
  return "other";
}

export const FRIENDLY_MESSAGE: Record<ErrorKind, string> = {
  network: "We couldn't reach DataHacks. Check your internet connection and try again.",
  session: "Your sign-in has expired. Sign in again to continue.",
  unavailable: "DataHacks applications aren't available right now. Please try again later.",
  other: `Something went wrong on our side. Try again in a minute; if it keeps happening, email ${GENERAL_CONTACT_EMAIL}.`,
};

/** A message to show a person, never the raw developer text (log that yourself where it's useful). */
export const friendlyError = (error: unknown): string => FRIENDLY_MESSAGE[errorKind(error)];
