import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { PassSendError, sendWalletPasses, useEmailQuota, useRefreshQuota, type WalletPassResult } from "./data";
import { errorText } from "./errors";
import QuotaNote from "./QuotaNote";
import type { PassPick } from "./ReleaseDialog";
import { PASS_ROLES, ROLE_NOUN, ROLE_PLURAL, TYPE_LABEL, acceptedNotReleased, fullName, passLists, type ApplicantType, type Row } from "./types";

/**
 * The console's Passes section. Emails check-in passes (QR code, Apple Wallet,
 * Google Wallet; each role has its own design) to accepted people. Same job as
 * send_emails.py in the check-in repo; both mark attendees.emailed_at, so
 * neither sends anyone a second pass unless asked to resend.
 *
 * "To send" lists everyone accepted without a pass. Some may be picked to
 * accept but not released yet: they have no check-in code until release, so
 * a send that includes them opens the Release dialog instead ("Release
 * decisions & send N passes"), which releases, emails and sends passes to the
 * newly accepted, then sends to the already-released people picked here.
 * "Sent" lists everyone with a pass, with a Resend per person. Anyone picked
 * for reject or waitlist is left out.
 *
 * Every row is in the page (no paging or "and N more"), and the role groups
 * are <details open>, so the browser's find-in-page reaches every name.
 *
 * Every send names exactly who it's for (applicationIds), never "everyone
 * without a pass", which the function would pick from the whole roster.
 */

type View = "toSend" | "sent";

const passes = (n: number, noun?: string) => `${n} ${noun ? `${noun} ` : ""}pass${n === 1 ? "" : "es"}`;

const matches = (r: Row, q: string) =>
  !q || [fullName(r), r.email, r.school, r.organization].some(v => v?.toLowerCase().includes(q));

const sentDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

const failedText = (failed: WalletPassResult["failed"]) =>
  `${failed.length} failed: ${failed.slice(0, 3).map(f => `${f.email || f.code} (${f.error})`).join("; ")}${failed.length > 3 ? "; …" : ""}`;

/** School for hackers, organization for mentors and judges. */
const affiliation = (r: Row) => (r.applicant_type === "hacker" ? r.school : r.organization || r.school) ?? "";

export default function PassesPage({ eventId, rows, initialSelected, onChanged, onReleaseAndSend }: {
  eventId: string;
  rows: Row[];
  /** Rows picked in a Hackers or Mentors & judges table ("Send pass"). */
  initialSelected?: string[];
  onChanged: () => void;
  /** Opens the Release dialog to release, then send passes to the people picked here. */
  onReleaseAndSend: (pick: PassPick) => void;
}) {
  const lists = useMemo(() => passLists(rows), [rows]);

  // What came over from a table: who could be selected, and what happened to the rest.
  const [picked] = useState(() => {
    if (!initialSelected) return null;
    const ids = new Set(initialSelected);
    const count = (list: Row[]) => list.filter(r => ids.has(r.id)).length;
    const selectable = lists.toSend.filter(r => ids.has(r.id)).map(r => r.id);
    const sent = count(lists.sent);
    return { selectable, sent, other: ids.size - selectable.length - sent };
  });

  const [view, setView] = useState<View>(() => (picked && picked.selectable.length === 0 && picked.sent > 0 ? "sent" : "toSend"));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(picked?.selectable ?? []));
  // Sent to (or tried) since these rows loaded, so they aren't offered again before the list reloads.
  const [tried, setTried] = useState<{ rows: Row[]; ids: ReadonlySet<string> }>({ rows, ids: new Set() });
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{ text: string; failed: WalletPassResult["failed"] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmResend, setConfirmResend] = useState<string | null>(null);
  // A send waiting for "Yes, send": every bulk send asks first (each person gets a real email and a WalletWallet pass).
  const [pending, setPending] = useState<{ people: Row[]; noun?: string } | null>(null);
  const quota = useEmailQuota(eventId);
  const refreshQuota = useRefreshQuota();

  const hidden = tried.rows === rows ? tried.ids : new Set<string>();
  const toSend = lists.toSend.filter(r => !hidden.has(r.id));
  const q = query.trim().toLowerCase();
  const chosen = toSend.filter(r => selected.has(r.id));
  const chosenHidden = chosen.filter(r => !matches(r, q)).length;

  const run = async (people: Row[], done: (sent: number) => string, resend = false) => {
    const ids = people.map(r => r.id);
    setWorking(true);
    setError(null);
    setResult(null);
    setProgress("");
    try {
      const outcome = await sendWalletPasses(eventId, sent => setProgress(`Sent ${sent} of ${ids.length}…`), { applicationIds: ids, resend });
      const notSent = new Set(outcome.notSent ?? []);
      const tried = ids.filter(id => !notSent.has(id));
      setTried(prev => ({ rows, ids: new Set([...(prev.rows === rows ? prev.ids : []), ...tried]) }));
      setSelected(prev => new Set([...prev].filter(id => !tried.includes(id))));
      const limit = outcome.stopped === "daily_limit" ? ` Gmail's daily limit is reached: ${notSent.size} not sent yet. Send them once it frees up.` : "";
      setResult({ text: done(outcome.sent) + limit, failed: outcome.failed });
    } catch (e) {
      if (e instanceof PassSendError && e.partial.sent > 0) setResult({ text: `${passes(e.partial.sent)} sent before it stopped.`, failed: e.partial.failed });
      setError(`${errorText(e)}${e instanceof PassSendError ? " Anyone who got a pass is recorded, so sending again only reaches the rest." : ""}`);
    } finally {
      setWorking(false);
      setConfirmResend(null);
      refreshQuota();
      onChanged();
    }
  };

  // Anyone not released yet has no code, so the send goes through the Release dialog.
  const send = (people: Row[], noun?: string) => {
    if (people.some(acceptedNotReleased)) {
      onReleaseAndSend({ count: people.length, releasedIds: people.filter(r => !acceptedNotReleased(r)).map(r => r.id) });
      return;
    }
    setPending({ people, noun });
  };
  const confirmSend = () => {
    if (!pending) return;
    const { people, noun } = pending;
    setPending(null);
    run(people, sent => `${passes(sent, noun)} sent.`);
  };

  const toggle = (ids: string[], on: boolean) => setSelected(prev => {
    const next = new Set(prev);
    ids.forEach(id => (on ? next.add(id) : next.delete(id)));
    return next;
  });

  const switchView = (v: View) => { setView(v); setConfirmResend(null); };

  return (
    <section className="sp-card og-passes">
      <div className="sp-card-header">
        <div className="sp-tabs" role="tablist" aria-label="Passes">
          <button role="tab" id="og-passes-tab-toSend" aria-controls="og-passes-panel" aria-selected={view === "toSend"} className={view === "toSend" ? "active" : ""} onClick={() => switchView("toSend")}>
            To send <span className="og-count">{toSend.length}</span>
          </button>
          <button role="tab" id="og-passes-tab-sent" aria-controls="og-passes-panel" aria-selected={view === "sent"} className={view === "sent" ? "active" : ""} onClick={() => switchView("sent")}>
            Sent <span className="og-count">{lists.sent.length}</span>
          </button>
        </div>
        <label className="og-search">
          <Search size={15} aria-hidden />
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, school…" aria-label="Search passes" />
        </label>
      </div>

      <p className="og-hint">Each person gets one email with their check-in QR code and Apple and Google Wallet buttons, in their role's design.</p>

      {picked && (
        <p className="og-pass-note">
          {picked.selectable.length > 0
            ? <>Selected {picked.selectable.length} of the {initialSelected!.length} you picked in the table.</>
            : <>None of the {initialSelected!.length} you picked in the table needs a pass.</>}
          {picked.sent > 0 && <> {picked.sent} already {picked.sent === 1 ? "has a pass" : "have passes"} (see Sent).</>}
          {picked.other > 0 && <> {picked.other} can't get one (not accepted).</>}
        </p>
      )}

      <div className="og-pass-status" aria-live="polite">
        {pending && (
          <div className="og-pass-note og-pass-confirm-send" role="group" aria-label="Confirm sending passes">
            <span>
              Send {passes(pending.people.length, pending.noun)} from DataHacks Team (info@ds3.club)? Each person gets an email with
              a new wallet pass.
            </span>
            <button className="sp-button" onClick={() => setPending(null)}>Cancel</button>
            <button className="sp-button primary" onClick={confirmSend}>Yes, send {passes(pending.people.length)}</button>
          </div>
        )}
        {pending && <QuotaNote quota={quota.data ?? null} need={pending.people.length} />}
        {working && <p className="og-progress">{progress || "Sending…"}</p>}
        {result && (
          <p className="og-success">
            {result.text}
            {result.failed.length > 0 && <span className="sp-error"> {failedText(result.failed)}</span>}
          </p>
        )}
        {error && <p className="sp-error">{error}</p>}
      </div>

      <div id="og-passes-panel" role="tabpanel" aria-labelledby={`og-passes-tab-${view}`}>
        {view === "toSend" ? (
          <ToSend
            toSend={toSend}
            query={q}
            selected={selected}
            chosen={chosen}
            chosenHidden={chosenHidden}
            working={working}
            onToggle={toggle}
            onClear={() => setSelected(new Set())}
            onSend={send}
          />
        ) : (
          <Sent
            sent={lists.sent}
            query={q}
            working={working}
            confirming={confirmResend}
            onConfirm={setConfirmResend}
            onResend={r => run([r], sent => (sent ? `New pass sent to ${fullName(r)}.` : `No pass sent to ${fullName(r)}.`), true)}
          />
        )}
      </div>
    </section>
  );
}

function RoleGroup({ type, summary, children }: { type: ApplicantType; summary: string; children: React.ReactNode }) {
  return (
    <details open className="og-pass-role">
      <summary>
        <ChevronRight size={16} className="og-pass-chevron" aria-hidden />
        <span className="og-pass-role-name">{ROLE_PLURAL[type]}</span>
        <span className="og-pass-count">{summary}</span>
      </summary>
      {children}
    </details>
  );
}

function Who({ r, showRole }: { r: Row; showRole: boolean }) {
  return (
    <span className="og-pass-who">
      <strong>{fullName(r)}</strong>
      {showRole && <span className="og-pass-role-label">{TYPE_LABEL[r.applicant_type]}</span>}
    </span>
  );
}

/** "Send 3 hacker passes", or "Release decisions & send 3 hacker passes" when someone in it isn't released. */
const sendLabel = (people: Row[], text: string) =>
  people.some(acceptedNotReleased) ? `Release decisions & ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;

function ToSend({ toSend, query, selected, chosen, chosenHidden, working, onToggle, onClear, onSend }: {
  toSend: Row[];
  query: string;
  selected: ReadonlySet<string>;
  chosen: Row[];
  chosenHidden: number;
  working: boolean;
  onToggle: (ids: string[], on: boolean) => void;
  onClear: () => void;
  onSend: (people: Row[], noun?: string) => void;
}) {
  if (toSend.length === 0) return <p className="og-empty">Everyone accepted has their pass.</p>;
  const groups = PASS_ROLES
    .map(type => ({ type, all: toSend.filter(r => r.applicant_type === type) }))
    .filter(g => g.all.length > 0)
    .map(g => ({ ...g, shown: g.all.filter(r => matches(r, query)) }));
  const unreleased = toSend.filter(acceptedNotReleased).length;

  return (
    <>
      {unreleased > 0 && (
        <p className="og-pass-note">
          {unreleased} of these {unreleased === 1 ? "isn't" : "aren't"} released yet. They get a check-in code when decisions are released,
          so a send that includes them releases decisions first.
        </p>
      )}

      <div className="og-pass-actions">
        <span className="og-pass-selected">
          {chosen.length} selected{chosenHidden > 0 && <> ({chosenHidden} hidden by search)</>}
        </span>
        <button className="sp-button primary" disabled={working || chosen.length === 0} onClick={() => onSend(chosen)}>
          {sendLabel(chosen, `Send passes to ${chosen.length} selected`)}
        </button>
        {chosen.length > 0 && <button className="sp-button" disabled={working} onClick={onClear}>Clear selection</button>}
        <button className="sp-button" disabled={working} onClick={() => onSend(toSend)}>
          {sendLabel(toSend, `Send all ${toSend.length}`)}
        </button>
      </div>

      {groups.every(g => g.shown.length === 0) && <p className="og-empty">Nobody matches that search.</p>}

      {groups.map(g => {
        if (g.shown.length === 0) return null;
        const allOn = g.shown.every(r => selected.has(r.id));
        const noun = ROLE_NOUN[g.type];
        const waiting = g.all.filter(acceptedNotReleased).length;
        const summary = [`${g.all.length} to send`, waiting > 0 && `${waiting} not released`].filter(Boolean).join(" · ");
        return (
          <RoleGroup key={g.type} type={g.type} summary={summary}>
            <div className="og-pass-role-bar">
              <label className="og-pass-all">
                <input type="checkbox" checked={allOn} disabled={working} onChange={() => onToggle(g.shown.map(r => r.id), !allOn)} />
                Select all {g.shown.length} shown
              </label>
              <button className="sp-button" disabled={working} onClick={() => onSend(g.all, noun)}>
                {sendLabel(g.all, `Send ${passes(g.all.length, noun)}`)}
              </button>
            </div>
            <ul className="og-pass-rows">
              {g.shown.map(r => (
                <li key={r.id}>
                  <label className={`og-pass-row${selected.has(r.id) ? " selected" : ""}`}>
                    <input type="checkbox" checked={selected.has(r.id)} disabled={working} onChange={e => onToggle([r.id], e.target.checked)} aria-label={`Select ${fullName(r)}`} />
                    <Who r={r} showRole={g.type === "hybrid" || !!query} />
                    <span className="og-pass-email">{r.email}</span>
                    <span className="og-pass-school">{affiliation(r)}</span>
                    <span className="og-pass-tag-cell">{acceptedNotReleased(r) && <span className="og-badge accepted">Not released</span>}</span>
                  </label>
                </li>
              ))}
            </ul>
          </RoleGroup>
        );
      })}
    </>
  );
}

function Sent({ sent, query, working, confirming, onConfirm, onResend }: {
  sent: Row[];
  query: string;
  working: boolean;
  confirming: string | null;
  onConfirm: (id: string | null) => void;
  onResend: (r: Row) => void;
}) {
  if (sent.length === 0) return <p className="og-empty">No passes sent yet.</p>;
  const groups = PASS_ROLES
    .map(type => ({ type, all: sent.filter(r => r.applicant_type === type) }))
    .filter(g => g.all.length > 0)
    .map(g => ({ ...g, shown: g.all.filter(r => matches(r, query)) }));
  if (groups.every(g => g.shown.length === 0)) return <p className="og-empty">Nobody matches that search.</p>;

  return (
    <>
      {groups.map(g => g.shown.length > 0 && (
        <RoleGroup key={g.type} type={g.type} summary={`${g.all.length} sent`}>
          <ul className="og-pass-rows">
            {g.shown.map(r => (
              <li key={r.id}>
                <div className="og-pass-row sent">
                  <Who r={r} showRole={g.type === "hybrid" || !!query} />
                  <span className="og-pass-email">{r.email}</span>
                  <span className="og-pass-date">Sent {sentDate(r.passSentAt)}</span>
                  <span className="og-pass-resend-cell">
                    {confirming === r.id ? (
                      <span className="og-pass-confirm" role="group" aria-label={`Resend to ${fullName(r)}?`}>
                        <span>Send a new copy?</span>
                        <button className="sp-button primary" disabled={working} onClick={() => onResend(r)}>Yes, resend</button>
                        <button className="sp-button" disabled={working} onClick={() => onConfirm(null)} autoFocus>Cancel</button>
                      </span>
                    ) : (
                      <button className="sp-button" disabled={working} onClick={() => onConfirm(r.id)} aria-label={`Resend pass to ${fullName(r)}`}>Resend</button>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </RoleGroup>
      ))}
    </>
  );
}
