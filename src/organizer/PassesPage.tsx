import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { sendWalletPasses, type WalletPassResult } from "./data";
import { PASS_ROLES, ROLE_NOUN, ROLE_PLURAL, TYPE_LABEL, fullName, passLists, passGroups, type ApplicantType, type Row } from "./types";

/**
 * The console's Passes section. Emails check-in passes (QR code, Apple Wallet,
 * Google Wallet; each role has its own design) to accepted people. Same job as
 * send_emails.py in the check-in repo; both mark attendees.emailed_at, so
 * neither sends anyone a second pass unless asked to resend.
 *
 * "To send" lists everyone released as accepted without a pass, plus people
 * picked to accept but not released yet (no check-in code until release), who
 * are shown but can't be selected. "Sent" lists everyone with a pass, with a
 * Resend per person. Anyone picked for reject or waitlist is left out.
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

export default function PassesPage({ eventId, rows, initialSelected, onChanged, onRelease }: {
  eventId: string;
  rows: Row[];
  /** Rows picked in a Hackers or Mentors & judges table ("Send pass"). */
  initialSelected?: string[];
  onChanged: () => void;
  /** Opens the Release dialog. */
  onRelease: () => void;
}) {
  const lists = useMemo(() => passLists(rows), [rows]);

  // What came over from a table: who could be selected, and what happened to the rest.
  const [picked] = useState(() => {
    if (!initialSelected) return null;
    const ids = new Set(initialSelected);
    const count = (list: Row[]) => list.filter(r => ids.has(r.id)).length;
    const selectable = lists.toSend.filter(r => ids.has(r.id)).map(r => r.id);
    const sent = count(lists.sent);
    const releaseFirst = count(lists.releaseFirst);
    return { selectable, sent, releaseFirst, other: ids.size - selectable.length - sent - releaseFirst };
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
      setTried(prev => ({ rows, ids: new Set([...(prev.rows === rows ? prev.ids : []), ...ids]) }));
      setSelected(prev => new Set([...prev].filter(id => !ids.includes(id))));
      setResult({ text: done(outcome.sent), failed: outcome.failed });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
      setConfirmResend(null);
      onChanged();
    }
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
            : <>None of the {initialSelected!.length} you picked in the table can get a first pass.</>}
          {picked.sent > 0 && <> {picked.sent} already {picked.sent === 1 ? "has a pass" : "have passes"} (see Sent).</>}
          {picked.releaseFirst > 0 && <> {picked.releaseFirst} need{picked.releaseFirst === 1 ? "s" : ""} decisions released first.</>}
          {picked.other > 0 && <> {picked.other} can't get one (not accepted).</>}
        </p>
      )}

      <div className="og-pass-status" aria-live="polite">
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
            releaseFirst={lists.releaseFirst}
            query={q}
            selected={selected}
            chosen={chosen}
            chosenHidden={chosenHidden}
            working={working}
            onToggle={toggle}
            onClear={() => setSelected(new Set())}
            onSend={run}
            onRelease={onRelease}
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

function ToSend({ toSend, releaseFirst, query, selected, chosen, chosenHidden, working, onToggle, onClear, onSend, onRelease }: {
  toSend: Row[];
  releaseFirst: Row[];
  query: string;
  selected: ReadonlySet<string>;
  chosen: Row[];
  chosenHidden: number;
  working: boolean;
  onToggle: (ids: string[], on: boolean) => void;
  onClear: () => void;
  onSend: (people: Row[], done: (sent: number) => string) => void;
  onRelease: () => void;
}) {
  const groups = passGroups(toSend, releaseFirst);
  const anyShown = groups.some(g => [...g.send, ...g.notReleased].some(r => matches(r, query)));

  return (
    <>
      {releaseFirst.length > 0 && (
        <div className="og-pass-release">
          <span>
            <strong>{releaseFirst.length}</strong> accepted but not released yet. They get a check-in code, and can get a pass, once decisions are released.
          </span>
          <button className="sp-button" onClick={onRelease} disabled={working}>Release decisions</button>
        </div>
      )}

      {toSend.length > 0 && (
        <div className="og-pass-actions">
          <span className="og-pass-selected">
            {chosen.length} selected{chosenHidden > 0 && <> ({chosenHidden} hidden by search)</>}
          </span>
          <button className="sp-button primary" disabled={working || chosen.length === 0} onClick={() => onSend(chosen, sent => `${passes(sent)} sent.`)}>
            Send passes to {chosen.length} selected
          </button>
          {chosen.length > 0 && <button className="sp-button" disabled={working} onClick={onClear}>Clear selection</button>}
          <button className="sp-button" disabled={working} onClick={() => onSend(toSend, sent => `${passes(sent)} sent.`)}>
            Send all {toSend.length}
          </button>
        </div>
      )}

      {toSend.length === 0 && <p className="og-empty">Everyone released as accepted has their pass.</p>}
      {groups.length > 0 && !anyShown && <p className="og-empty">Nobody matches that search.</p>}

      {groups.map(g => {
        const shown = g.send.filter(r => matches(r, query));
        const waiting = g.notReleased.filter(r => matches(r, query));
        if (shown.length === 0 && waiting.length === 0) return null;
        const allOn = shown.length > 0 && shown.every(r => selected.has(r.id));
        const noun = ROLE_NOUN[g.type];
        const summary = [`${g.send.length} to send`, g.notReleased.length > 0 && `${g.notReleased.length} release first`].filter(Boolean).join(" · ");
        return (
          <RoleGroup key={g.type} type={g.type} summary={summary}>
            <div className="og-pass-role-bar">
              {shown.length > 0 && (
                <label className="og-pass-all">
                  <input type="checkbox" checked={allOn} disabled={working} onChange={() => onToggle(shown.map(r => r.id), !allOn)} />
                  Select all {shown.length} shown
                </label>
              )}
              {g.send.length > 0 && (
                <button className="sp-button" disabled={working} onClick={() => onSend(g.send, sent => `${passes(sent, noun)} sent.`)}>
                  Send {passes(g.send.length, noun)}
                </button>
              )}
            </div>
            <ul className="og-pass-rows">
              {shown.map(r => (
                <li key={r.id}>
                  <label className={`og-pass-row${selected.has(r.id) ? " selected" : ""}`}>
                    <input type="checkbox" checked={selected.has(r.id)} disabled={working} onChange={e => onToggle([r.id], e.target.checked)} aria-label={`Select ${fullName(r)}`} />
                    <Who r={r} showRole={g.type === "hybrid" || !!query} />
                    <span className="og-pass-email">{r.email}</span>
                    <span className="og-pass-school">{affiliation(r)}</span>
                    <span className="og-pass-tag-cell" />
                  </label>
                </li>
              ))}
              {waiting.map(r => (
                <li key={r.id}>
                  <div className="og-pass-row waiting">
                    <input type="checkbox" disabled aria-label={`${fullName(r)}: release decisions first`} />
                    <Who r={r} showRole={g.type === "hybrid" || !!query} />
                    <span className="og-pass-email">{r.email}</span>
                    <span className="og-pass-school">{affiliation(r)}</span>
                    <span className="og-pass-tag-cell"><span className="og-pass-tag">Release first</span></span>
                  </div>
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
