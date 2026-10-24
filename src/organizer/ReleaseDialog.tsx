import { useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { EVENT_CODE } from "@/portal/event";
import { EmailNotSetUpError, releaseDecisions, sendEmails } from "./data";
import { DEFAULT_TEMPLATES, PLACEHOLDERS, type Template } from "./templates";
import { kindOf, unsentDecisionRows, type ApplicantType, type Decision, type Kind, type Row } from "./types";

type GroupKey = `${Decision}:${Kind}`;
// Emails go out rejections first, then the waitlist, then acceptances.
const GROUP_ORDER: GroupKey[] = ["rejected:hacker", "rejected:staff", "waitlisted:hacker", "waitlisted:staff", "accepted:hacker", "accepted:staff"];
const GROUP_LABEL: Record<GroupKey, string> = {
  "accepted:hacker": "Accepted hackers",
  "accepted:staff": "Accepted mentors & judges",
  "waitlisted:hacker": "Waitlisted hackers",
  "waitlisted:staff": "Waitlisted mentors & judges",
  "rejected:hacker": "Rejected hackers",
  "rejected:staff": "Rejected mentors & judges",
};

const isDecision = (s: string | null): s is Decision => s === "accepted" || s === "waitlisted" || s === "rejected";

function groupIds(items: { id: string; decision: string | null; type: string }[]) {
  const groups = new Map<GroupKey, string[]>();
  for (const item of items) {
    if (!isDecision(item.decision)) continue;
    const key = `${item.decision}:${kindOf(item.type as ApplicantType)}` as GroupKey;
    groups.set(key, [...(groups.get(key) ?? []), item.id]);
  }
  return groups;
}

type Phase = "review" | "working" | "done";
type Outcome = { released: number; sent: number; failed: { id: string; error: string }[]; emailError: string | null };

/**
 * Releases every staged decision, then emails each person. In "retry" mode it
 * only sends the decision emails that didn't go out last time.
 */
export default function ReleaseDialog({ mode, eventId, rows, onClose, onChanged }: {
  mode: "release" | "retry";
  eventId: string;
  rows: Row[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const targets = useMemo(
    () => (mode === "release"
      ? rows.filter(r => r.decision !== null && r.decision !== r.status).map(r => ({ id: r.id, decision: r.decision, type: r.applicant_type }))
      : unsentDecisionRows(rows).map(r => ({ id: r.id, decision: r.status, type: r.applicant_type }))),
    [mode, rows],
  );
  const groups = useMemo(() => groupIds(targets), [targets]);
  const presentKeys = GROUP_ORDER.filter(k => groups.has(k));

  const [templates, setTemplates] = useState<Record<GroupKey, Template>>(() => ({ ...DEFAULT_TEMPLATES }));
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<Phase>("review");
  const [progress, setProgress] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editTemplate = (key: GroupKey, field: keyof Template, value: string) =>
    setTemplates(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const run = async () => {
    setPhase("working");
    setError(null);
    const result: Outcome = { released: 0, sent: 0, failed: [], emailError: null };
    let emailGroups = groups;
    try {
      if (mode === "release") {
        setProgress("Releasing decisions…");
        const released = await releaseDecisions(eventId, unsentDecisionRows(rows).map(r => r.id));
        result.released = released.length;
        emailGroups = groupIds(released.map(r => ({ id: r.application_id, decision: r.status, type: r.applicant_type })));
        onChanged();
      }
      try {
        for (const key of GROUP_ORDER) {
          const ids = emailGroups.get(key);
          if (!ids?.length) continue;
          setProgress(`Emailing ${GROUP_LABEL[key].toLowerCase()} (0 of ${ids.length})…`);
          const sent = await sendEmails(eventId, ids, templates[key].subject, templates[key].body, "decision",
            done => setProgress(`Emailing ${GROUP_LABEL[key].toLowerCase()} (${done} of ${ids.length})…`));
          result.sent += sent.sent;
          result.failed.push(...sent.failed);
        }
      } catch (e) {
        result.emailError = e instanceof EmailNotSetUpError || e instanceof Error ? e.message : String(e);
      }
      setOutcome(result);
      setPhase("done");
      onChanged();
    } catch (e) {
      // Releasing itself failed: nothing changed, so let them try again.
      setError(e instanceof Error ? e.message : String(e));
      setPhase("review");
    }
  };

  const canConfirm = typed.trim() === EVENT_CODE && targets.length > 0;
  const title = mode === "release" ? "Release decisions" : "Send unsent decision emails";

  return (
    <div className="og-overlay" role="presentation" onClick={phase === "working" ? undefined : onClose}>
      <div className="og-modal" role="dialog" aria-modal="true" aria-labelledby="og-release-title" onClick={e => e.stopPropagation()}>
        <header className="og-modal-header">
          <h2 id="og-release-title">{title}</h2>
          {phase !== "working" && <button className="og-icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>}
        </header>

        {phase === "done" && outcome ? (
          <div className="og-modal-body">
            {mode === "release" && <p><strong>{outcome.released}</strong> decision{outcome.released === 1 ? "" : "s"} released.</p>}
            <p><strong>{outcome.sent}</strong> email{outcome.sent === 1 ? "" : "s"} sent.</p>
            {outcome.failed.length > 0 && (
              <p className="sp-error">{outcome.failed.length} email{outcome.failed.length === 1 ? "" : "s"} failed: {outcome.failed.slice(0, 3).map(f => f.error).join("; ")}</p>
            )}
            {outcome.emailError && (
              <div className="og-warning">
                <AlertTriangle size={16} aria-hidden />
                <div>
                  <strong>{mode === "release" ? `${outcome.released} released, emails not sent.` : "Emails not sent."}</strong>
                  <p>{outcome.emailError}</p>
                  <p>Use "Send unsent decision emails" once it's fixed. The decisions themselves are saved.</p>
                </div>
              </div>
            )}
            <div className="og-modal-actions"><button className="sp-button primary" onClick={onClose}>Done</button></div>
          </div>
        ) : (
          <div className="og-modal-body">
            {targets.length === 0 ? (
              <p>Nothing to {mode === "release" ? "release" : "send"}.</p>
            ) : (
              <>
                <ul className="og-group-counts">
                  {presentKeys.map(k => <li key={k}><strong>{groups.get(k)!.length}</strong> {GROUP_LABEL[k].toLowerCase()}</li>)}
                </ul>
                {mode === "release" && (
                  <div className="og-warning">
                    <AlertTriangle size={16} aria-hidden />
                    <p>
                      This changes {targets.length} application status{targets.length === 1 ? "" : "es"} for real. Accepted people get their
                      role and a check-in code straight away, and everyone below is emailed. It can't be undone from here.
                    </p>
                  </div>
                )}

                <h3>Emails</h3>
                <p className="og-hint">Placeholders: {PLACEHOLDERS.map(p => `{{${p}}}`).join(" ")}</p>
                {presentKeys.map(k => (
                  <details key={k} className="og-template">
                    <summary>{GROUP_LABEL[k]}: <em>{templates[k].subject}</em></summary>
                    <label>Subject<input value={templates[k].subject} onChange={e => editTemplate(k, "subject", e.target.value)} disabled={phase === "working"} /></label>
                    <label>Body<textarea rows={8} value={templates[k].body} onChange={e => editTemplate(k, "body", e.target.value)} disabled={phase === "working"} /></label>
                  </details>
                ))}

                <label className="og-confirm">
                  Type <code>{EVENT_CODE}</code> to confirm
                  <input value={typed} onChange={e => setTyped(e.target.value)} disabled={phase === "working"} autoComplete="off" spellCheck={false} />
                </label>
              </>
            )}
            {error && <p className="sp-error">{error}</p>}
            {phase === "working" && <p className="og-progress">{progress}</p>}
            <div className="og-modal-actions">
              <button className="sp-button" onClick={onClose} disabled={phase === "working"}>Cancel</button>
              <button className="sp-button og-danger" onClick={run} disabled={!canConfirm || phase === "working"}>
                {mode === "release" ? `Release ${targets.length} decision${targets.length === 1 ? "" : "s"}` : `Send ${targets.length} email${targets.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
