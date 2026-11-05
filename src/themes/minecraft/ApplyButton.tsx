import type { ReactNode } from "react";
import { AccountDialog } from "@/portal/AccountNotice";
import { useAccountGuard } from "@/portal/useAccountGuard";

/**
 * Straight to Google's account picker, then into the hacker or mentor/judge
 * application. The portal's sign-in code is loaded on click so the Supabase
 * client stays out of the site's own bundle. Already signed in? A small dialog
 * asks whether to continue as that account or use a different one.
 */
export function ApplyButton({ as, className = "mc-button", onClick, children }: {
  as: "hacker" | "staff";
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const guard = useAccountGuard(as);
  const signIn = () => {
    onClick?.();
    guard.signIn();
  };
  return <>
    <button type="button" className={className} onClick={signIn}>{children}</button>
    {guard.error && <span className="mc-apply-error" role="alert">{guard.error}</span>}
    {guard.account !== null && (
      <AccountDialog
        theme="mc"
        email={guard.account}
        busy={guard.busy}
        onContinue={guard.continueAsCurrent}
        onSwitch={guard.switchAccount}
        onClose={guard.dismiss}
      />
    )}
  </>;
}
