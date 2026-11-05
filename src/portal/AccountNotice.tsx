import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./accountNotice.css";

type NoticeProps = {
  /** The account this browser is signed in to. */
  email: string;
  /** "sp": the portal's sign-in cards. "mc": the public Minecraft site. */
  theme: "sp" | "mc";
  /** Organizer sign-in with an account that isn't one: only offer the switch. */
  notOrganizer?: boolean;
  busy?: boolean;
  onContinue: () => void;
  onSwitch: () => void;
};

const shown = (email: string) => email || "an account without an email";

/**
 * "You're signed in as …": shown by a Google sign-in button instead of starting
 * Google when the browser already has a session. See useAccountGuard.
 */
export function AccountNotice({ email, theme, notOrganizer, busy, onContinue, onSwitch }: NoticeProps) {
  const button = theme === "sp" ? "sp-button" : "mc-button";
  // The Minecraft site has no "primary" button: its secondary one is stone.
  const secondary = theme === "sp" ? "sp-button" : "mc-button mc-button-stone";
  return (
    <div className={`account-notice account-notice-${theme}`}>
      <p className="account-notice-text">
        {notOrganizer
          ? <><strong className="account-notice-email" title={email}>{shown(email)}</strong> isn't an organizer for this event.</>
          : <>You're signed in as <strong className="account-notice-email" title={email}>{shown(email)}</strong>.</>}
      </p>
      <div className="account-notice-actions">
        {!notOrganizer && (
          <button type="button" className={`${button} primary account-notice-continue`} onClick={onContinue} disabled={busy} title={`Continue as ${email}`}>
            <span className="account-notice-ellipsis">Continue as {shown(email)}</span>
          </button>
        )}
        <button type="button" className={notOrganizer ? `${button} primary` : secondary} onClick={onSwitch} disabled={busy}>
          {busy ? "Opening Google…" : "Use a different account"}
        </button>
      </div>
    </div>
  );
}

/**
 * The public site's apply buttons sit in the nav and hero, with no room for the
 * notice: it opens as a small dialog instead. Rendered into the theme's root so
 * its styles still apply, and as a modal so it isn't clipped by the nav.
 */
export function AccountDialog({ onClose, ...props }: NoticeProps & { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }, []);
  const host = (typeof document !== "undefined" && document.querySelector(".minecraft-root")) || document.body;
  return createPortal(
    <dialog
      ref={ref}
      className="account-dialog"
      aria-labelledby="account-dialog-title"
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself.
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="account-dialog-body">
        <h2 id="account-dialog-title" className="account-dialog-title">Already signed in</h2>
        <AccountNotice {...props} />
        <button type="button" className="account-dialog-close" onClick={onClose}>Cancel</button>
      </div>
    </dialog>,
    host,
  );
}
