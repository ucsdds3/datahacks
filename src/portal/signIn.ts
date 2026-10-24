import { supabase } from "@/lib/supabaseClient";
import { portal, rememberApplyAs } from "./paths";

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
    options: { redirectTo: `${window.location.origin}${portal.callback}?${params}` },
  });
  if (error) throw error;
}

/**
 * Signs out and leaves nothing behind on this browser: the session, cached
 * portal data and the portal's own saved settings (like a signed waiver flag),
 * so the next person on the same computer starts clean.
 */
export async function signOutEverywhere() {
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
