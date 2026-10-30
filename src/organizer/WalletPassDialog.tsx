import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { sendWalletPasses, type WalletPassResult } from "./data";
import { PASS_ROLES, ROLE_NOUN, ROLE_PLURAL, fullName, passGroups, passTargets, someNames, type ApplicantType, type PassGroup, type Row } from "./types";

/**
 * Emails check-in passes (QR code, Apple Wallet, Google Wallet) to accepted
 * people who don't have one yet. Same job as send_emails.py in the check-in
 * repo; both mark attendees.emailed_at, so neither sends anyone a second pass.
 *
 * Each role gets its own pass design, and its own section and Send button
 * here, so hackers, mentors, judges and mentors & judges can go out at
 * different times. Every send names exactly who it's for (applicationIds),
 * never "everyone without a pass", which the function would pick from the
 * whole roster.
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
  return selectedIds
    ? <SelectedPasses eventId={eventId} rows={rows} selectedIds={selectedIds} onClose={onClose} onChanged={onChanged} />
    : <PassesByRole eventId={eventId} rows={rows} onClose={onClose} onChanged={onChanged} />;
}

const INTRO = "Emails each person their check-in QR code with Apple and Google Wallet buttons.";

const passes = (n: number, noun?: string) => `${n} ${noun ? `${noun} ` : ""}pass${n === 1 ? "" : "es"}`;

function Modal({ title, locked, onClose, children }: { title: string; locked: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <div className="og-overlay" role="presentation" onClick={locked ? undefined : onClose}>
      <div className="og-modal" role="dialog" aria-modal="true" aria-labelledby="og-wallet-title" onClick={e => e.stopPropagation()}>
        <header className="og-modal-header">
          <h2 id="og-wallet-title">{title}</h2>
          {!locked && <button className="og-icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>}
        </header>
        <div className="og-modal-body">{children}</div>
      </div>
    </div>
  );
}

/** One role: its people by name, and who's waiting on a release. */
function RoleSection({ group, children }: { group: PassGroup<Row>; children?: ReactNode }) {
  const headingId = `og-pass-${group.type}`;
  return (
    <section className="og-pass-group" aria-labelledby={headingId}>
      <h3 id={headingId}>{group.label} <span className="og-pass-count">{group.send.length}</span></h3>
      {group.send.length > 0 && (
        <ul className="og-pass-list">
          {group.send.slice(0, 8).map(r => <li key={r.id}>{fullName(r)}</li>)}
          {group.send.length > 8 && <li>and {group.send.length - 8} more</li>}
        </ul>
      )}
      {group.notReleased.length > 0 && (
        <p className="og-pass-skip">Not released yet: {someNames(group.notReleased)} — release decisions to include them.</p>
      )}
      {children}
    </section>
  );
}

const failedText = (failed: WalletPassResult["failed"]) =>
  `${failed.length} failed: ${failed.slice(0, 3).map(f => `${f.code || f.email} (${f.error})`).join("; ")}`;

/** "Send wallet passes": everyone accepted without a pass, a section and a Send button per role. */
function PassesByRole({ eventId, rows, onClose, onChanged }: {
  eventId: string;
  rows: Row[];
  onClose: () => void;
  onChanged: () => void;
}) {
  // Ids sent to (or tried) in this dialog, so a section doesn't offer them again before the list reloads.
  const [tried, setTried] = useState<ReadonlySet<string>>(new Set());
  const [working, setWorking] = useState<ApplicantType | "all" | null>(null);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<Partial<Record<ApplicantType | "all", WalletPassResult>>>({});
  const [error, setError] = useState<string | null>(null);

  const targets = passTargets(rows);
  const live = passGroups(targets.due.filter(r => !tried.has(r.id)), targets.notReleased);
  // A role stays on screen after its passes go out, to say how it went.
  const shown: PassGroup<Row>[] = PASS_ROLES
    .filter(type => live.some(g => g.type === type) || results[type])
    .map(type => live.find(g => g.type === type) ?? { type, label: ROLE_PLURAL[type], send: [], notReleased: [] });
  const sendable = shown.filter(g => g.send.length > 0);
  const allDue = sendable.flatMap(g => g.send);

  const run = async (which: ApplicantType | "all", people: Row[]) => {
    const ids = people.map(r => r.id);
    setWorking(which);
    setError(null);
    setProgress("");
    try {
      const outcome = await sendWalletPasses(eventId, sent => setProgress(`Sent ${sent} of ${ids.length}…`), { applicationIds: ids });
      setTried(prev => new Set([...prev, ...ids]));
      setResults(prev => ({ ...prev, [which]: outcome }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(null);
      onChanged();
    }
  };

  return (
    <Modal title="Send wallet passes" locked={working !== null} onClose={onClose}>
      <p>{INTRO}</p>
      {shown.length === 0 && <p>Everyone released as accepted already has their pass.</p>}
      {shown.map(group => {
        const result = results[group.type];
        return (
          <RoleSection key={group.type} group={group}>
            {result && (
              <p className="og-pass-result">
                {passes(result.sent, ROLE_NOUN[group.type])} sent.
                {result.failed.length > 0 && <span className="sp-error"> {failedText(result.failed)}</span>}
              </p>
            )}
            {group.send.length > 0 && (
              <div className="og-pass-send">
                <button className="sp-button primary" onClick={() => run(group.type, group.send)} disabled={working !== null}>
                  Send {passes(group.send.length, ROLE_NOUN[group.type])}
                </button>
              </div>
            )}
          </RoleSection>
        );
      })}
      {results.all && (
        <p className="og-pass-result">
          {passes(results.all.sent)} sent.
          {results.all.failed.length > 0 && <span className="sp-error"> {failedText(results.all.failed)}</span>}
        </p>
      )}
      {error && <p className="sp-error">{error}</p>}
      {working && <p className="og-progress">{progress || "Sending…"}</p>}
      <div className="og-modal-actions">
        <button className="sp-button" onClick={onClose} disabled={working !== null}>Close</button>
        {sendable.length > 1 && (
          <button className="sp-button" onClick={() => run("all", allDue)} disabled={working !== null}>
            Send all {passes(allDue.length)}
          </button>
        )}
      </div>
    </Modal>
  );
}

/** "Send pass" for rows picked in a table: just those people, by role, with one Send button. */
function SelectedPasses({ eventId, rows, selectedIds, onClose, onChanged }: {
  eventId: string;
  rows: Row[];
  selectedIds: string[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [resend, setResend] = useState(false);
  const targets = passTargets(rows, selectedIds);
  const pending = [...targets.due, ...(resend ? targets.alreadySent : [])];
  const groups = passGroups(pending, targets.notReleased);
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
        { applicationIds: pending.map(r => r.id), resend },
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
    <Modal title="Send passes to selected people" locked={phase === "working"} onClose={onClose}>
      {phase === "done" && result ? (
        <>
          <p><strong>{result.sent}</strong> pass{result.sent === 1 ? "" : "es"} sent.</p>
          {result.failed.length > 0 && <p className="sp-error">{failedText(result.failed)}</p>}
          <div className="og-modal-actions"><button className="sp-button primary" onClick={onClose}>Done</button></div>
        </>
      ) : (
        <>
          <p>{INTRO}</p>
          {pending.length === 0 && <p>Nobody you selected needs a pass.</p>}
          {groups.map(group => <RoleSection key={group.type} group={group} />)}
          {targets.alreadySent.length > 0 && (
            <label className="og-pass-resend">
              <input type="checkbox" checked={resend} onChange={e => setResend(e.target.checked)} disabled={phase === "working"} />
              Also send a new copy to the {targets.alreadySent.length} who already {targets.alreadySent.length === 1 ? "has a pass" : "have passes"}
            </label>
          )}
          {targets.noCode.length > 0 && (
            <p className="og-pass-skip">Skipping {targets.noCode.length} without a check-in code (not accepted).</p>
          )}
          {error && <p className="sp-error">{error}</p>}
          {phase === "working" && <p className="og-progress">{progress || "Sending…"}</p>}
          <div className="og-modal-actions">
            <button className="sp-button" onClick={onClose} disabled={phase === "working"}>Cancel</button>
            <button className="sp-button primary" onClick={run} disabled={pending.length === 0 || phase === "working"}>
              Send {passes(pending.length)}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
