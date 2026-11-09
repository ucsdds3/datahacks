import { useState } from "react";
import { MCP_LIVE } from "@/pages/applyWithAiConfig";
import { allowLeaving } from "@/portal/formDraft";
import { startGoogleSignIn, type SignInAs } from "@/portal/signIn";
import { friendlyError } from "@/lib/friendlyError";
import { formatPacificDate } from "@/lib/pacificTime";

/**
 * Shown on an application form when the person was signed out (here, in another
 * tab, or because the sign-in expired) or another tab switched this browser to a
 * different account. The form and its answers stay on screen and in the draft;
 * signing in again comes back to the form with them restored.
 */
export function SignedOutNotice({ as, otherAccount, onLeave }: { as: Exclude<SignInAs, "organizer">; otherAccount?: string | null; onLeave: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signIn = async () => {
    onLeave();
    allowLeaving();
    setBusy(true);
    setError(null);
    try {
      await startGoogleSignIn(as);
    } catch (e) {
      setBusy(false);
      setError(friendlyError(e));
    }
  };
  return (
    <div className="sp-signed-out" role="alert">
      <p>
        <strong>{otherAccount ? `This browser is now signed in as ${otherAccount}.` : "You were signed out."}</strong>{" "}
        {otherAccount
          ? "Sign in again with the account you started this application with to send it. Your answers are saved on this device."
          : "Sign in again to continue. Your answers are saved on this device."}
      </p>
      <button type="button" className="sp-button primary" onClick={signIn} disabled={busy}>
        {busy ? "Opening Google…" : "Sign in again"}
      </button>
      {error && <p className="sp-error">{error}</p>}
    </div>
  );
}

/** Under the form's intro: answers are kept on this device, and a way to start over after a restore. */
export function DraftNote({ restoredAt, onReset }: { restoredAt: string | null; onReset: () => void }) {
  if (!restoredAt) return <p className="sp-form-note">Your answers are saved on this device as you type, until you submit.</p>;
  const when = new Date(restoredAt);
  const label = Number.isNaN(when.getTime())
    ? ""
    : ` from ${formatPacificDate(when, { month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`;
  return (
    <p className="sp-form-note sp-draft-restored" role="status">
      We restored the answers you saved{label}.{" "}
      <button type="button" className="sp-link-button" onClick={onReset}>Start over</button>
    </p>
  );
}

/**
 * "Apply with AI", only once signing in from an assistant works (MCP_LIVE). It
 * opens in a new tab so the form, and what's typed in it, stays put.
 */
export function ApplyWithAiNote() {
  if (!MCP_LIVE) return null;
  return (
    <p className="sp-form-note">
      Rather answer by chatting? You can also{" "}
      <a href="/apply-with-ai" target="_blank" rel="noopener">apply with an AI assistant</a> (opens in a new tab).
    </p>
  );
}

/** Scrolls to a form control and focuses it (after the error state has rendered). */
export function focusField(id: string | undefined) {
  if (!id) return;
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView?.({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  });
}
