import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RotateCcw, X } from "lucide-react";
import { EVENT_CODE } from "@/portal/event";
import { SendError, fetchApplicationRows, releaseDecisions, sendEmails, sendWalletPasses, useEmailQuota, useRefreshQuota, type Quota } from "./data";
import { errorText } from "./errors";
import { PLACEHOLDERS, type Template } from "./templates";
import { loadDecisionTemplates, saveDecisionTemplates, type DecisionTemplates } from "./templateStore";
import { isStaged, kindOf, passTargets, unsentDecisionRows, type ApplicantType, type Decision, type Kind, type Row } from "./types";
import QuotaNote from "./QuotaNote";

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

type Target = { id: string; decision: Decision | null; type: string; decision_version: number };

function groupIds(items: { id: string; decision: string | null; type: string }[]) {
  const groups = new Map<GroupKey, string[]>();
  for (const item of items) {
    if (!isDecision(item.decision)) continue;
    const key = `${item.decision}:${kindOf(item.type as ApplicantType)}` as GroupKey;
    groups.set(key, [...(groups.get(key) ?? []), item.id]);
  }
  return groups;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Ends with a full stop, so another sentence can follow. */
const sentence = (text: string) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

type Phase = "review" | "working" | "done";
/** Wallet passes sent after a release: who got one, and who didn't and why. */
type PassOutcome = { sent: number; failed: number; alreadyHad: number; noCode: number; error: string | null };
type Outcome = {
  /** Released by this dialog (or found released after the reply was lost). */
  releasedIds: string[];
  /** Shown but not released: changed by someone else since, or already released. */
  notReleased: number;
  /** The release's reply was lost, but checking showed it went through. */
  releaseInterrupted: string | null;
  sent: number;
  /** Already had this decision's email, so not emailed again. */
  skipped: number;
  failed: { id: string; error: string }[];
  emailError: string | null;
  stoppedAtLimit: boolean;
  /** Released by this dialog (or, in retry mode, targeted) and still without their decision email. */
  stillToSend: number | null;
  passes: PassOutcome | null;
  /** Passes for the already-released people picked on the Passes page (passPick). */
  pickedPasses: { sent: number; failed: number; error: string | null } | null;
  quota: Quota | null;
};

const emptyOutcome = (): Outcome => ({
  releasedIds: [], notReleased: 0, releaseInterrupted: null, sent: 0, skipped: 0, failed: [], emailError: null,
  stoppedAtLimit: false, stillToSend: null, passes: null, pickedPasses: null, quota: null,
});

/**
 * Opened from the Passes page's "Release decisions & send N passes": how many
 * people the organizer picked there, and which of them were already released
 * (they get their pass straight after the release; the rest are newly
 * accepted and get theirs from "Also send wallet passes").
 */
export type PassPick = { count: number; releasedIds: string[] };

/**
 * After a release: emails a wallet pass to the people it just accepted, once
 * the roster has their new check-in codes (the database makes them on release).
 * Only people who got their acceptance email, have a code and have no pass yet;
 * passTargets also leaves out anyone whose picked decision isn't accepted.
 * sendWalletPasses checks the deployed function can take a list of people first
 * and sends nothing if it can't, so this never falls back to "everyone".
 */
async function sendPassesToNewlyAccepted(eventId: string, acceptedIds: string[], onProgress: (text: string) => void): Promise<PassOutcome> {
  onProgress("Loading check-in codes…");
  const rows = await fetchApplicationRows(eventId);
  const targets = passTargets(rows, acceptedIds);
  const outcome: PassOutcome = {
    sent: 0,
    failed: 0,
    alreadyHad: targets.alreadySent.length,
    noCode: acceptedIds.length - targets.due.length - targets.alreadySent.length,
    error: null,
  };
  const ids = targets.due.map(r => r.id);
  if (ids.length === 0) return outcome;
  onProgress(`Sending wallet passes (0 of ${ids.length})…`);
  const result = await sendWalletPasses(eventId, sent => onProgress(`Sending wallet passes (${sent} of ${ids.length})…`), { applicationIds: ids });
  outcome.sent = result.sent;
  outcome.failed = result.failed.length;
  return outcome;
}

/**
 * Releases exactly the staged decisions it shows (by id and version, so
 * anything someone else changed since stays staged), then emails each person.
 * In "retry" mode it only sends the decision emails that didn't go out.
 *
 * Every email is recorded the moment it's sent, so any retry (the button here,
 * or "Send unsent decision emails") only reaches people still waiting. If the
 * connection drops during the release, it reloads to see what went through
 * before saying anything. Edited emails are kept for this event (templateStore),
 * so a retry sends the same words.
 */
export default function ReleaseDialog({ mode: initialMode, eventId, rows, passPick, onClose, onChanged }: {
  mode: "release" | "retry";
  eventId: string;
  rows: Row[];
  passPick?: PassPick;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState(initialMode);
  // The rows this dialog works from; a retry reloads them.
  const [current, setCurrent] = useState(rows);
  const targets: Target[] = useMemo(
    () => (mode === "release"
      ? current.filter(isStaged).map(r => ({ id: r.id, decision: r.decision, type: r.applicant_type, decision_version: r.decision_version }))
      : unsentDecisionRows(current).map(r => ({ id: r.id, decision: r.status as Decision, type: r.applicant_type, decision_version: r.decision_version }))),
    [mode, current],
  );
  const groups = useMemo(() => groupIds(targets), [targets]);
  const presentKeys = GROUP_ORDER.filter(k => groups.has(k));

  const [stored] = useState(() => loadDecisionTemplates(eventId));
  const [templates, setTemplates] = useState<DecisionTemplates>(stored.templates);
  const [edited, setEdited] = useState(stored.savedAt !== null);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<Phase>("review");
  const [progress, setProgress] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendPasses, setSendPasses] = useState(true);
  const quota = useEmailQuota(eventId);
  const refreshQuota = useRefreshQuota();
  const accepting = mode === "release" && (groups.has("accepted:hacker") || groups.has("accepted:staff"));

  // Sending is driven from this tab: closing it mid-send stops the rest (they stay unsent, never double-sent).
  useEffect(() => {
    if (phase !== "working") return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  const editTemplate = (key: GroupKey, field: keyof Template, value: string) =>
    setTemplates(prev => {
      const next = { ...prev, [key]: { ...prev[key], [field]: value } };
      saveDecisionTemplates(eventId, next);
      setEdited(true);
      return next;
    });
  const resetTemplates = () => {
    saveDecisionTemplates(eventId, null);
    setTemplates(loadDecisionTemplates(eventId).templates);
    setEdited(false);
  };

  /** Emails each group with its template; stops at the first error (what went out is recorded). */
  const emailGroups = async (emailing: Map<GroupKey, string[]>, result: Outcome) => {
    for (const key of GROUP_ORDER) {
      const ids = emailing.get(key);
      if (!ids?.length) continue;
      const label = GROUP_LABEL[key].toLowerCase();
      setProgress(`Emailing ${label} (0 of ${ids.length})…`);
      try {
        const sent = await sendEmails(eventId, ids, templates[key].subject, templates[key].body, "decision",
          done => setProgress(`Emailing ${label} (${done} of ${ids.length})…`), { expectStatus: key.split(":")[0] as Decision });
        result.sent += sent.sent;
        result.skipped += sent.skipped.length;
        result.failed.push(...sent.failed);
        result.quota = sent.quota ?? result.quota;
        if (sent.stopped === "daily_limit") {
          result.stoppedAtLimit = true;
          return;
        }
      } catch (e) {
        if (e instanceof SendError) {
          result.sent += e.partial.sent;
          result.skipped += e.partial.skipped.length;
          result.failed.push(...e.partial.failed);
        }
        result.emailError = errorText(e);
        return;
      }
    }
  };

  /** Who of `ids` still has no decision email, from a fresh load (null if it can't be loaded). */
  const stillToSend = async (ids: string[]) => {
    try {
      const fresh = await fetchApplicationRows(eventId);
      const wanted = new Set(ids);
      return { fresh, count: unsentDecisionRows(fresh).filter(r => wanted.has(r.id)).length };
    } catch {
      return { fresh: null, count: null };
    }
  };

  const finish = async (result: Outcome, emailedIds: string[]) => {
    if (result.emailError || result.failed.length > 0 || result.stoppedAtLimit) {
      setProgress("Checking who still needs an email…");
      const left = await stillToSend(emailedIds);
      result.stillToSend = left.count;
      if (left.fresh) setCurrent(left.fresh);
    }
    setOutcome(result);
    setPhase("done");
    onChanged();
    refreshQuota();
  };

  const run = async () => {
    setPhase("working");
    setError(null);
    const result = emptyOutcome();
    let emailing = groups;
    let newlyAccepted: string[] = [];

    if (mode === "release") {
      setProgress("Releasing decisions…");
      try {
        const { released, notReleased } = await releaseDecisions(eventId, targets.map(t => ({ id: t.id, decision_version: t.decision_version })));
        result.releasedIds = released.map(r => r.application_id);
        result.notReleased = notReleased.length;
        emailing = groupIds(released.map(r => ({ id: r.application_id, decision: r.status, type: r.applicant_type })));
        newlyAccepted = released.filter(r => r.status === "accepted").map(r => r.application_id);
      } catch (e) {
        // The release may have gone through even though its reply was lost: look before saying anything.
        setProgress("The connection dropped. Checking what was released…");
        onChanged();
        let fresh: Row[] | null = null;
        try {
          fresh = await fetchApplicationRows(eventId);
        } catch { /* still offline */ }
        const byId = new Map((fresh ?? []).map(r => [r.id, r]));
        const releasedNow = targets.filter(t => {
          const r = byId.get(t.id);
          return r && r.status === t.decision && !!r.decision_released_at && !r.decision_emailed_at;
        });
        if (releasedNow.length === 0) {
          if (fresh) setCurrent(fresh);
          setError(fresh
            ? `${sentence(errorText(e))} Nothing was released, so it's safe to try again.`
            : `${sentence(errorText(e))} Couldn't check whether anything was released. Reload the page before trying again.`);
          setPhase("review");
          return;
        }
        result.releaseInterrupted = errorText(e);
        result.releasedIds = releasedNow.map(t => t.id);
        result.notReleased = targets.length - releasedNow.length;
        emailing = groupIds(releasedNow);
        newlyAccepted = releasedNow.filter(t => t.decision === "accepted").map(t => t.id);
      }
      onChanged();
    }

    const emailedIds = [...emailing.values()].flat();
    await emailGroups(emailing, result);

    // A pass shouldn't arrive before the acceptance email, so only people whose email went out.
    if (sendPasses && newlyAccepted.length > 0 && !result.emailError && !result.stoppedAtLimit) {
      const emailFailed = new Set(result.failed.map(f => f.id));
      const ids = newlyAccepted.filter(id => !emailFailed.has(id));
      try {
        result.passes = await sendPassesToNewlyAccepted(eventId, ids, setProgress);
      } catch (e) {
        result.passes = { sent: 0, failed: 0, alreadyHad: 0, noCode: 0, error: errorText(e) };
      }
    }
    // People picked on the Passes page who were already released: the release doesn't touch them,
    // and their acceptance email went out before, so they get their pass either way.
    const pickedIds = mode === "release" && sendPasses && passPick ? passTargets(rows, passPick.releasedIds).due.map(r => r.id) : [];
    if (pickedIds.length > 0) {
      setProgress(`Sending the passes you picked (0 of ${pickedIds.length})…`);
      try {
        const sent = await sendWalletPasses(eventId, n => setProgress(`Sending the passes you picked (${n} of ${pickedIds.length})…`), { applicationIds: pickedIds });
        result.pickedPasses = { sent: sent.sent, failed: sent.failed.length, error: null };
      } catch (e) {
        result.pickedPasses = { sent: 0, failed: 0, error: errorText(e) };
      }
    }
    await finish(result, emailedIds);
  };

  /** "Send the N still to send": the unsent decision emails from this release, with the same templates. */
  const retry = async () => {
    const ids = new Set(outcome?.releasedIds.length ? outcome.releasedIds : targets.map(t => t.id));
    setPhase("working");
    setError(null);
    setProgress("Loading who still needs an email…");
    let fresh: Row[];
    try {
      fresh = await fetchApplicationRows(eventId);
    } catch (e) {
      setError(`Couldn't load the list: ${errorText(e)}. Try again in a moment.`);
      setPhase("done");
      return;
    }
    setCurrent(fresh);
    setMode("retry");
    const unsent = unsentDecisionRows(fresh).filter(r => ids.has(r.id));
    const result = { ...emptyOutcome(), releasedIds: outcome?.releasedIds ?? [] };
    const emailing = groupIds(unsent.map(r => ({ id: r.id, decision: r.status, type: r.applicant_type })));
    await emailGroups(emailing, result);
    await finish(result, unsent.map(r => r.id));
  };

  const canConfirm = typed.trim() === EVENT_CODE && targets.length > 0;
  const title = mode === "release" ? "Release decisions" : "Send unsent decision emails";
  const remaining = quota.data?.remaining;
  const overQuota = typeof remaining === "number" && targets.length > remaining;

  return (
    <div className="og-overlay" role="presentation" onClick={phase === "working" ? undefined : onClose}>
      <div className="og-modal" role="dialog" aria-modal="true" aria-labelledby="og-release-title" onClick={e => e.stopPropagation()}>
        <header className="og-modal-header">
          <h2 id="og-release-title">{title}</h2>
          {phase !== "working" && <button className="og-icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>}
        </header>

        {phase !== "review" && outcome ? (
          <div className="og-modal-body">
            {outcome.releasedIds.length > 0 && initialMode === "release" && (
              <p><strong>{outcome.releasedIds.length}</strong> decision{outcome.releasedIds.length === 1 ? "" : "s"} released.</p>
            )}
            {outcome.releaseInterrupted && (
              <p className="og-hint">The connection dropped during the release ({outcome.releaseInterrupted}), but the release went through. Emails were sent from a fresh copy of the list.</p>
            )}
            {outcome.notReleased > 0 && (
              <p className="og-hint">
                {plural(outcome.notReleased, "decision")} you saw {outcome.notReleased === 1 ? "wasn't" : "weren't"} released: someone changed {outcome.notReleased === 1 ? "it" : "them"} after
                you opened this, or {outcome.notReleased === 1 ? "it was" : "they were"} already released. Anything still staged stays staged; check and release again.
              </p>
            )}
            <p><strong>{outcome.sent}</strong> email{outcome.sent === 1 ? "" : "s"} sent.</p>
            {outcome.skipped > 0 && <p className="og-hint">{plural(outcome.skipped, "person", "people")} already had this email, so {outcome.skipped === 1 ? "wasn't" : "weren't"} emailed again.</p>}
            {outcome.failed.length > 0 && (
              <p className="sp-error">{plural(outcome.failed.length, "email")} failed: {outcome.failed.slice(0, 3).map(f => f.error).join("; ")}{outcome.failed.length > 3 ? "; …" : ""}</p>
            )}
            {(outcome.emailError || outcome.stoppedAtLimit || (outcome.stillToSend ?? 0) > 0) && (
              <div className="og-warning" role="alert">
                <AlertTriangle size={16} aria-hidden />
                <div>
                  <strong>
                    {initialMode === "release" && outcome.releasedIds.length > 0 && `${outcome.releasedIds.length} released, `}
                    {outcome.stillToSend === null ? "some emails still to send." : `${plural(outcome.stillToSend, "email")} still to send.`}
                  </strong>
                  {outcome.emailError && <p>{outcome.emailError}</p>}
                  {outcome.stoppedAtLimit && <p>Gmail's daily sending limit is reached, so the rest wait. Send them once it frees up.</p>}
                  <p>
                    The decisions are saved.
                    {!outcome.emailError && " Everyone already emailed is recorded, so sending again only reaches the people still waiting."}
                  </p>
                </div>
              </div>
            )}
            {outcome.passes && !outcome.passes.error && (
              <p>
                Sent <strong>{outcome.passes.sent}</strong> wallet pass{outcome.passes.sent === 1 ? "" : "es"}; {outcome.passes.failed} failed.
                {outcome.passes.alreadyHad > 0 && <> {outcome.passes.alreadyHad} already had one.</>}
                {outcome.passes.noCode > 0 && <> {outcome.passes.noCode} without a check-in code yet; send them from Passes later.</>}
              </p>
            )}
            {outcome.passes?.error && (
              <div className="og-warning">
                <AlertTriangle size={16} aria-hidden />
                <div>
                  <strong>Wallet passes not sent.</strong>
                  <p>{outcome.passes.error}</p>
                  <p>Send them from Passes once it's fixed.</p>
                </div>
              </div>
            )}
            {outcome.pickedPasses && !outcome.pickedPasses.error && (
              <p>
                Sent <strong>{outcome.pickedPasses.sent}</strong> wallet pass{outcome.pickedPasses.sent === 1 ? "" : "es"} to people you picked who were already released; {outcome.pickedPasses.failed} failed.
              </p>
            )}
            {outcome.pickedPasses?.error && (
              <div className="og-warning">
                <AlertTriangle size={16} aria-hidden />
                <div>
                  <strong>Passes for the already-released people you picked weren't sent.</strong>
                  <p>{outcome.pickedPasses.error}</p>
                </div>
              </div>
            )}
            {(outcome.emailError || outcome.stoppedAtLimit) && sendPasses && accepting && (
              <p className="og-pass-skip">Wallet passes weren't sent either, since not every acceptance email went out. Send them from Passes after.</p>
            )}
            <QuotaNote quota={outcome.quota ?? quota.data ?? null} />
            {error && <p className="sp-error">{error}</p>}
            {phase === "working" && <p className="og-progress" aria-live="polite">{progress}</p>}
            <div className="og-modal-actions">
              {phase === "done" && (outcome.stillToSend ?? (outcome.emailError ? 1 : 0)) > 0 && !outcome.stoppedAtLimit && (
                <button className="sp-button og-danger" onClick={retry}>
                  <RotateCcw size={15} aria-hidden /> {outcome.stillToSend ? `Send the ${plural(outcome.stillToSend, "email")} still to send` : "Send the rest"}
                </button>
              )}
              <button className="sp-button primary" onClick={onClose} disabled={phase === "working"}>Done</button>
            </div>
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
                      This releases exactly the {plural(targets.length, "decision")} above, for real. Accepted people get their
                      role and a check-in code straight away, and everyone above is emailed. It can't be undone from here.
                      Anything another organizer stages or changes after you opened this isn't included.
                    </p>
                  </div>
                )}

                <h3>Emails</h3>
                <p className="og-hint">Placeholders: {PLACEHOLDERS.map(p => `{{${p}}}`).join(" ")}</p>
                {edited && (
                  <p className="og-hint og-templates-saved">
                    Using your edited emails for {EVENT_CODE} (kept in this browser, so a retry sends the same words).{" "}
                    <button type="button" className="og-link-button" onClick={resetTemplates} disabled={phase === "working"}>Reset to the defaults</button>
                  </p>
                )}
                {presentKeys.map(k => (
                  <details key={k} className="og-template">
                    <summary>{GROUP_LABEL[k]}: <em>{templates[k].subject}</em></summary>
                    <label>Subject<input value={templates[k].subject} onChange={e => editTemplate(k, "subject", e.target.value)} disabled={phase === "working"} /></label>
                    <label>Body<textarea rows={8} value={templates[k].body} onChange={e => editTemplate(k, "body", e.target.value)} disabled={phase === "working"} /></label>
                  </details>
                ))}

                {accepting && (
                  <label className="og-pass-resend">
                    <input type="checkbox" checked={sendPasses} onChange={e => setSendPasses(e.target.checked)} disabled={phase === "working"} />
                    Also send wallet passes to everyone newly accepted
                  </label>
                )}
                {passPick && mode === "release" && (
                  <p className="og-pass-skip og-pass-pick">
                    From Passes: you picked {passPick.count} {passPick.count === 1 ? "person" : "people"} to send a pass to. Releasing
                    covers every staged decision listed above, and with the box ticked everyone newly accepted gets a pass, not only
                    the people you picked.
                    {passPick.releasedIds.length === 1 && <> The 1 you picked who was already released gets theirs right after.</>}
                    {passPick.releasedIds.length > 1 && <> The {passPick.releasedIds.length} you picked who were already released get theirs right after.</>}
                  </p>
                )}

                <QuotaNote quota={quota.data ?? null} need={targets.length} />
                {overQuota && (
                  <p className="sp-error">
                    Only {remaining} more email{remaining === 1 ? "" : "s"} can go out today (Gmail's daily limit). The rest will stop and wait;
                    send them with "Send unsent decision emails" once it frees up.
                  </p>
                )}

                <label className="og-confirm">
                  Type <code>{EVENT_CODE}</code> to confirm
                  <input value={typed} onChange={e => setTyped(e.target.value)} disabled={phase === "working"} autoComplete="off" spellCheck={false} />
                </label>
              </>
            )}
            {error && <p className="sp-error" role="alert">{error}</p>}
            {phase === "working" && <p className="og-progress" aria-live="polite">{progress}</p>}
            <div className="og-modal-actions">
              <button className="sp-button" onClick={onClose} disabled={phase === "working"}>Cancel</button>
              <button className="sp-button og-danger" onClick={run} disabled={!canConfirm || phase === "working"}>
                {mode === "release" ? `Release ${plural(targets.length, "decision")}` : `Send ${plural(targets.length, "email")}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
