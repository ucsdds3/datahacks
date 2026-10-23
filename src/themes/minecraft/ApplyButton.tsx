import { useState, type ReactNode } from "react";

/**
 * Straight to Google's account picker, then into the hacker or mentor/judge
 * application. The portal's sign-in code is loaded on click so the Supabase
 * client stays out of the site's own bundle.
 */
export function ApplyButton({ as, className = "mc-button", onClick, children }: {
  as: "hacker" | "staff";
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const signIn = () => {
    onClick?.();
    setError(null);
    import("@/portal/signIn")
      .then(m => m.startGoogleSignIn(as))
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  };
  return <>
    <button type="button" className={className} onClick={signIn}>{children}</button>
    {error && <span className="mc-apply-error" role="alert">{error}</span>}
  </>;
}
