import { supabase } from "@/lib/supabaseClient";
import { portal, rememberApplyAs } from "./paths";
import { allowLeaving } from "./formDraft";

/** Who a sign-in is for: picks where the callback sends them. It never grants anything. */
export type SignInAs = "hacker" | "staff" | "organizer";

/**
 * Goes straight to Google's account picker, then back to /auth/callback. The
 * site's buttons call this directly, so there's no extra "sign in" page.
 * `next` sends them on to a page other than the portal afterwards (only the
 * OAuth consent page; see AuthCallback).
 */
export async function startGoogleSignIn(as: SignInAs, next?: string) {
  if (as !== "organizer") rememberApplyAs(as);
  const params = new URLSearchParams({ as });
  if (next) params.set("next", next);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    // Always show Google's account picker, so people signed in to a personal
    // Google account can choose their school or organizer account instead.
    options: { redirectTo: `${window.location.origin}${portal.callback}?${params}`, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
}

/**
 * Signs out and leaves nothing behind on this browser: the session, cached
 * portal data and the portal's own saved settings (like a signed waiver flag),
 * so the next person on the same computer starts clean.
 */
export async function signOutEverywhere() {
  // Signing out deletes any application draft (datahacks.draft.*) below: an open form
  // mustn't write it back, or ask "leave this page?" on the way to the sign-in page.
  allowLeaving();
  await supabase.auth.signOut();
  try {
    // Dev test tabs keep their login in this tab only: leave the organizer's alone.
    const testTab = import.meta.env.DEV && sessionStorage.getItem("datahacks.testTab");
    if (!testTab) for (const key of Object.keys(localStorage)) {
      if (key.startsWith("datahacks.") || key.startsWith("sb-")) localStorage.removeItem(key);
    }
    sessionStorage.clear();
  } catch { /* storage blocked */ }
}

/**
 * The account this browser is already signed in to, or null. The whole site
 * (hacker portal, mentor/judge portal, organizer console) shares one session per
 * browser, so a new sign-in replaces it everywhere: sign-in buttons check this
 * first and ask before starting Google.
 */
export async function signedInAccount(): Promise<{ email: string } | null> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { email: data.session.user.email ?? "" } : null;
}

/** "Use a different account": signs this browser out, then straight to Google's account picker. */
export async function switchGoogleAccount(as: SignInAs, next?: string) {
  await signOutEverywhere();
  await startGoogleSignIn(as, next);
}

/**
 * "Continue as …": where the sign-in callback would have sent them. Organizers
 * go to the console; everyone else to /portal, which opens their application or
 * the form for the button they used.
 */
export function continuePath(as: SignInAs): string {
  if (as === "organizer") return portal.organizer;
  rememberApplyAs(as);
  return portal.home;
}
