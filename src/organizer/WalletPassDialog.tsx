import { useState } from "react";
import { X } from "lucide-react";
import { sendWalletPasses, type WalletPassResult } from "./data";
import { TYPE_LABEL, fullName, passTargets, someNames, type Row } from "./types";

/**
 * Emails check-in passes (QR code, Apple Wallet, Google Wallet) to accepted
 * people who don't have one yet. Same job as send_emails.py in the check-in
 * repo; both mark attendees.emailed_at, so neither sends anyone a second pass.
 *
 * With selectedIds (rows picked in a table) it only sends to those people,
 * and can send a second pass to any of them who already has one.
 *
 * Passes go by the released status (only released acceptances have a code),
 * while the tables go by the picked decision. So it never sends to someone
 * released as accepted whose picked decision is now something else, and says
 * who's picked to accept but has no code until decisions are released.
 */
export default function WalletPassDialog({ eventId, rows, selectedIds, onClose, onChanged }: {
  eventId: string;
  rows: Row[];
  selectedIds?: string[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [resend, setResend] = useState(false);
  const targets = passTargets(rows, selectedIds);
  const chosen = selectedIds ? targets : null;
  const pending = [...targets.due, ...(chosen && resend ? targets.alreadySent : [])];
  // Sending to "everyone without a pass" lets the function pick from the roster,
  // which would include people on hold; name exactly who to send to instead.
  const sendOptions = chosen
    ? { applicationIds: pending.map(r => r.id), resend }
    : targets.onHold.length > 0 ? { applicationIds: pending.map(r => r.id) } : {};
  const [phase, setPhase] = useState<"review" | "working" | "done">("review");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<WalletPassResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setPhase("working");
    setError(null);
    try {
      const outcome = await sendWalletPasses(
        eventId,
        sent => setProgress(`Sent ${sent} of ${pending.length}…`),
        sendOptions,
      );
      setResult(outcome);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("review");
    } finally {
      onChanged();
    }
  };

  return (
    <div className="og-overlay" role="presentation" onClick={phase === "working" ? undefined : onClose}>
      <div className="og-modal" role="dialog" aria-modal="true" aria-labelledby="og-wallet-title" onClick={e => e.stopPropagation()}>
        <header className="og-modal-header">
          <h2 id="og-wallet-title">{chosen ? "Send passes to selected people" : "Send wallet passes"}</h2>
          {phase !== "working" && <button className="og-icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>}
        </header>
        <div className="og-modal-body">
          {phase === "done" && result ? (
            <>
              <p><strong>{result.sent}</strong> pass{result.sent === 1 ? "" : "es"} sent.</p>
              {result.failed.length > 0 && (
                <p className="sp-error">
                  {result.failed.length} failed: {result.failed.slice(0, 3).map(f => `${f.code || f.email} (${f.error})`).join("; ")}
                </p>
              )}
              <div className="og-modal-actions"><button className="sp-button primary" onClick={onClose}>Done</button></div>
            </>
          ) : (
            <>
              {pending.length === 0 ? (
                <p>{chosen ? "Nobody you selected needs a pass." : "Everyone released as accepted already has their pass."}</p>
              ) : (
                <>
                  <p>
                    {chosen
                      ? <>Emails a check-in pass to <strong>{pending.length}</strong> of the {selectedIds!.length} {selectedIds!.length === 1 ? "person" : "people"} you selected:</>
                      : <>Emails a check-in pass to <strong>{pending.length}</strong> accepted {pending.length === 1 ? "person who doesn't" : "people who don't"} have one yet:</>}
                    {" "}the QR code in the email, an Add to Apple Wallet button with the pass attached, and an Add to Google
                    Wallet button for Android.
                  </p>
                  <ul className="og-pass-list">
                    {pending.slice(0, 8).map(r => <li key={r.id}>{fullName(r)} · {TYPE_LABEL[r.applicant_type]} · <code>{r.code}</code></li>)}
                    {pending.length > 8 && <li>and {pending.length - 8} more</li>}
                  </ul>
                </>
              )}
              {chosen && chosen.alreadySent.length > 0 && (
                <label className="og-pass-resend">
                  <input type="checkbox" checked={resend} onChange={e => setResend(e.target.checked)} disabled={phase === "working"} />
                  Also send a new copy to the {chosen.alreadySent.length} who already {chosen.alreadySent.length === 1 ? "has a pass" : "have passes"}
                </label>
              )}
              {targets.onHold.length > 0 && (
                <p className="og-pass-skip">
                  {targets.onHold.length} skipped: you've picked a different decision for them that
                  isn't released yet — release decisions first. ({someNames(targets.onHold)})
                </p>
              )}
              {targets.notReleased.length > 0 && (
                <p className="og-pass-skip">
                  {targets.notReleased.length} accepted but not released yet — release decisions to give them a check-in
                  code: {someNames(targets.notReleased)}.
                </p>
              )}
              {chosen && chosen.noCode.length > 0 && (
                <p className="og-pass-skip">
                  Skipping {chosen.noCode.length} without a check-in code (not accepted).
                </p>
              )}
              {error && <p className="sp-error">{error}</p>}
              {phase === "working" && <p className="og-progress">{progress || "Sending…"}</p>}
              <div className="og-modal-actions">
                <button className="sp-button" onClick={onClose} disabled={phase === "working"}>Cancel</button>
                <button className="sp-button primary" onClick={run} disabled={pending.length === 0 || phase === "working"}>
                  Send {pending.length} pass{pending.length === 1 ? "" : "es"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
