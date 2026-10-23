import { useState } from "react";
import { X } from "lucide-react";
import { sendWalletPasses, type WalletPassResult } from "./data";
import { TYPE_LABEL, fullName, needsPass, type Row } from "./types";

/**
 * Emails check-in passes (QR code, Apple Wallet, Google Wallet) to accepted
 * people who don't have one yet. Same job as send_emails.py in the check-in
 * repo; both mark attendees.emailed_at, so neither sends anyone a second pass.
 */
export default function WalletPassDialog({ eventId, rows, onClose, onChanged }: {
  eventId: string;
  rows: Row[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const pending = rows.filter(needsPass);
  const [phase, setPhase] = useState<"review" | "working" | "done">("review");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<WalletPassResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setPhase("working");
    setError(null);
    try {
      const outcome = await sendWalletPasses(eventId, sent => setProgress(`Sent ${sent} of ${pending.length}…`));
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
          <h2 id="og-wallet-title">Send wallet passes</h2>
          {phase !== "working" && <button className="og-icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>}
        </header>
        <div className="og-modal-body">
          {phase === "done" && result ? (
            <>
              <p><strong>{result.sent}</strong> pass{result.sent === 1 ? "" : "es"} sent.</p>
              {result.failed.length > 0 && (
                <p className="sp-error">
                  {result.failed.length} failed: {result.failed.slice(0, 3).map(f => `${f.code} (${f.error})`).join("; ")}
                </p>
              )}
              <div className="og-modal-actions"><button className="sp-button primary" onClick={onClose}>Done</button></div>
            </>
          ) : (
            <>
              {pending.length === 0 ? (
                <p>Everyone accepted already has their pass.</p>
              ) : (
                <>
                  <p>
                    Emails a check-in pass to <strong>{pending.length}</strong> accepted {pending.length === 1 ? "person who doesn't" : "people who don't"} have
                    one yet: the QR code in the email, an Add to Apple Wallet button with the pass attached, and an Add to Google
                    Wallet button for Android.
                  </p>
                  <ul className="og-pass-list">
                    {pending.slice(0, 8).map(r => <li key={r.id}>{fullName(r)} · {TYPE_LABEL[r.applicant_type]} · <code>{r.code}</code></li>)}
                    {pending.length > 8 && <li>and {pending.length - 8} more</li>}
                  </ul>
                </>
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
