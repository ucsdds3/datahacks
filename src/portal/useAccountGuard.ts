import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SignInAs } from "./signIn";

// Loaded on demand: the public site's apply buttons use this too, and the
// Supabase client has to stay out of the site's own bundle.
const loadSignIn = () => import("./signIn");
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * A Google sign-in button that asks before replacing an account. The site shares
 * one session per browser, so signing in as a hacker with a personal account
 * would silently sign an organizer out of the console in another tab.
 *
 * - `signIn()`: straight to Google as before, unless this browser is already
 *   signed in; then `account` is set and the page shows AccountNotice instead.
 * - `continueAsCurrent()`: where the callback would have sent them.
 * - `switchAccount()`: sign out here, then Google's account picker.
 *
 * Pages inside the portal pass `signedInAs` from useAuth so the notice shows as
 * soon as the page opens; buttons outside it find out on click.
 */
export function useAccountGuard(as: SignInAs, options: { next?: string; signedInAs?: string | null } = {}) {
  const navigate = useNavigate();
  const [checked, setChecked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const account = "signedInAs" in options ? options.signedInAs ?? null : checked;

  const fail = (e: unknown) => { setBusy(false); setError(message(e)); };

  const signIn = () => {
    setError(null);
    return loadSignIn()
      .then(async m => {
        const current = await m.signedInAccount();
        if (current) return setChecked(current.email);
        await m.startGoogleSignIn(as, options.next);
      })
      .catch(fail);
  };

  const continueAsCurrent = () => loadSignIn().then(m => navigate(m.continuePath(as))).catch(fail);

  const switchAccount = () => {
    setBusy(true);
    setError(null);
    return loadSignIn().then(m => m.switchGoogleAccount(as, options.next)).catch(fail);
  };

  return { account, busy, error, signIn, continueAsCurrent, switchAccount, dismiss: () => setChecked(null) };
}
