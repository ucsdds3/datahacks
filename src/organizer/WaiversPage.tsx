import { useMemo, useRef, useState } from "react";
import { Check, FileUp, Search } from "lucide-react";
import { DOCUSIGN } from "@/staff-portal/config";
import { FORMAT_LABEL, importRows, matchWaivers, readDocuSignExport, type MatchKind, type ParsedExport } from "./waiverImport";
import { MARK_FAILED, SKIP_LABEL, markWaiverSeen, recordWaiverImport, type WaiverImportResult } from "./waivers";
import { TYPE_LABEL, fullName, type Row } from "./types";
import { errorText } from "./errors";

/**
 * The console's Waivers section, for the DocuSign PowerForm: how many accepted
 * people have a waiver on file, importing DocuSign's CSV export (preview, then
 * record), and marking someone signed by hand after seeing their DocuSign
 * completion email.
 */
export default function WaiversPage({ eventId, rows, onChanged }: { eventId: string; rows: Row[]; onChanged: () => void }) {
  const accepted = useMemo(() => rows.filter(r => r.status === "accepted"), [rows]);
  const onFile = accepted.filter(r => r.waiverSignedAt).length;
  const percent = accepted.length ? Math.round((onFile / accepted.length) * 100) : 0;
  return (
    <div className="og-dayof og-waivers">
      <section className="sp-card" aria-label="Waivers on file">
        <dl className="og-stats og-waiver-stats">
          <div><dt>On file</dt><dd>{onFile}<span> of {accepted.length} accepted</span></dd></div>
          <div><dt>Still missing</dt><dd>{accepted.length - onFile}</dd></div>
          <div><dt>Coverage</dt><dd>{percent}%</dd></div>
        </dl>
        <p className="og-hint">
          People sign on UC San Diego's DocuSign (a PowerForm linked from their portal). DocuSign doesn't tell us
          directly: import its CSV below, about once a day. The portal and the check-in desk show "Waiver ✓" from here.
        </p>
      </section>
      <ImportCard eventId={eventId} rows={rows} onChanged={onChanged} />
      <MissingCard eventId={eventId} rows={accepted.filter(r => !r.waiverSignedAt)} onChanged={onChanged} />
    </div>
  );
}

const KIND_LABEL: Record<MatchKind, string> = {
  ready: "To record",
  already: "Already on file",
  unmatched: "Not matched",
  not_completed: "Not completed",
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "–");

function ImportCard({ eventId, rows, onChanged }: { eventId: string; rows: Row[]; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; parsed: ParsedExport } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MatchKind>("ready");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<WaiverImportResult | null>(null);

  // Re-matched whenever the applications reload, so recorded rows move to "Already on file".
  const match = useMemo(() => (file ? matchWaivers(file.parsed.entries, rows) : null), [file, rows]);

  const choose = async (f: File | undefined) => {
    setError(null);
    setResult(null);
    if (!f) return;
    try {
      const parsed = readDocuSignExport(await f.text(), { idLabel: DOCUSIGN.idFieldLabel, roleName: DOCUSIGN.roleName });
      setFile({ name: f.name, parsed });
      const m = matchWaivers(parsed.entries, rows);
      setFilter((["ready", "unmatched", "already", "not_completed"] as MatchKind[]).find(k => m.counts[k] > 0) ?? "ready");
    } catch (e) {
      setFile(null);
      setError(errorText(e));
    }
    if (input.current) input.current.value = "";
  };

  const ready = match ? importRows(match.items) : [];
  const record = async () => {
    if (!file || ready.length === 0) return;
    const ok = window.confirm(
      `Record ${ready.length} waiver${ready.length === 1 ? "" : "s"} from ${file.name}?\n\n` +
      "They show as signed in the portal, the console and at the check-in desk right away. People who already have one keep it.",
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await recordWaiverImport(eventId, ready));
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const shown = match?.items.filter(i => i.kind === filter) ?? [];

  return (
    <section className="sp-card og-waiver-import">
      <h2>Import from DocuSign</h2>
      <p className="og-hint">
        In DocuSign: Agreements → PowerForms → "DataHacks 2027 Liability Waiver" → Download, pick the dates, CSV.
        An Envelope Recipient Report export works too (matched by email only). Steps: docs/docusign-powerform-setup.md.
        Nothing is saved until you press Record.
      </p>
      <div className="og-ci-row-actions">
        <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={e => choose(e.target.files?.[0])} />
        <button className="sp-button" onClick={() => input.current?.click()}><FileUp size={15} aria-hidden /> Choose CSV…</button>
        {file && <span className="og-hint og-waiver-file">{file.name} · {FORMAT_LABEL[file.parsed.format]} · {file.parsed.entries.length} row{file.parsed.entries.length === 1 ? "" : "s"}</span>}
      </div>
      {error && <p className="sp-error" role="alert">{error}</p>}

      {file && match && (
        <>
          {!file.parsed.columns.id && <p className="og-hint">This file has no {DOCUSIGN.idFieldLabel} column, so rows are matched by email.</p>}
          <div className="sp-tabs og-waiver-tabs" role="tablist" aria-label="Import rows">
            {(Object.keys(KIND_LABEL) as MatchKind[]).map(k => (
              <button key={k} role="tab" aria-selected={k === filter} className={k === filter ? "active" : ""} onClick={() => setFilter(k)}>
                {KIND_LABEL[k]} <span className="og-count">{match.counts[k]}</span>
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="og-empty">None.</p>
          ) : (
            <div className="sp-table-wrap og-waiver-table">
              <table className="sp-table og-table">
                <thead>
                  <tr><th>Line</th><th>In DocuSign</th><th>Matched to</th><th>Signed</th><th>{filter === "ready" ? "Envelope" : "Why"}</th></tr>
                </thead>
                <tbody>
                  {shown.map(i => (
                    <tr key={`${i.entry.line}-${i.entry.envelopeId}`}>
                      <td>{i.entry.line}</td>
                      <td><strong>{i.entry.name || "(no name)"}</strong><br /><span className="og-hint-inline">{i.entry.email || "(no email)"}</span></td>
                      <td>
                        {i.row ? <>{fullName(i.row)} <span className="og-hint-inline">· {TYPE_LABEL[i.row.applicant_type]}</span></> : "–"}
                        {i.by && <><br /><span className="og-hint-inline">by {i.by === "id" ? DOCUSIGN.idFieldLabel : "email"}</span></>}
                      </td>
                      <td>{when(i.entry.completedAt)}</td>
                      <td>{filter === "ready" ? <code>{i.entry.envelopeId ? `${i.entry.envelopeId.slice(0, 8)}…` : "–"}</code> : i.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="og-ci-row-actions">
            <button className="sp-button primary" disabled={busy || ready.length === 0} onClick={record}>
              {busy ? "Recording…" : `Record ${ready.length} waiver${ready.length === 1 ? "" : "s"}`}
            </button>
            {result && (
              <span className={result.skipped ? "og-hint" : "og-success"} role="status">
                Recorded {result.recorded}.{result.already_on_file > 0 && ` ${result.already_on_file} already had one.`}
                {result.skipped > 0 && ` ${result.skipped} skipped: ${[...new Set(result.skipped_rows.map(s => SKIP_LABEL[s.reason] ?? s.reason))].join("; ")}.`}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function MissingCard({ eventId, rows, onChanged }: { eventId: string; rows: Row[]; onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const q = query.trim().toLowerCase();
  const shown = rows.filter(r => !q || [fullName(r), r.email, r.code, r.school, r.organization].some(v => v?.toLowerCase().includes(q)));

  const mark = async (r: Row) => {
    const note = window.prompt(
      `Mark ${fullName(r)}'s waiver as signed?\n\n` +
      `Only after seeing their DocuSign "Completed" email for the DataHacks waiver. Note (optional):`,
      "Showed DocuSign completion email",
    );
    if (note === null) return;
    setBusyId(r.id);
    setMessage(null);
    try {
      const res = await markWaiverSeen(eventId, r.id, note.trim() || null);
      if (res.status === "marked" || res.status === "already_on_file") {
        setMessage({ ok: true, text: res.status === "marked" ? `Marked ${fullName(r)} signed.` : `${fullName(r)} already had a waiver on file.` });
        onChanged();
      } else setMessage({ ok: false, text: MARK_FAILED[res.status] });
    } catch (e) {
      setMessage({ ok: false, text: errorText(e) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="sp-card og-waiver-missing">
      <div className="og-waiver-missing-head">
        <h2>No waiver yet <span className="og-count">{rows.length}</span></h2>
        <label className="og-search">
          <Search size={15} aria-hidden />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, code…" aria-label="Search people without a waiver" />
        </label>
      </div>
      <p className="og-hint">Accepted people with no waiver on file. Mark signed only after seeing their DocuSign completion email.</p>
      {message && <p className={message.ok ? "og-success" : "sp-error"} role="status">{message.text}</p>}
      {rows.length === 0 ? (
        <p className="og-success"><Check size={15} aria-hidden /> Everyone accepted has a waiver on file.</p>
      ) : shown.length === 0 ? (
        <p className="og-empty">Nobody matches that search.</p>
      ) : (
        <div className="sp-table-wrap">
          <table className="sp-table og-table">
            <thead><tr><th>Name</th><th>Type</th><th>Email</th><th>Code</th><th>Checked in</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.id}>
                  <td>{fullName(r)}</td>
                  <td>{TYPE_LABEL[r.applicant_type]}</td>
                  <td>{r.email ?? ""}</td>
                  <td>{r.code ? <code>{r.code}</code> : ""}</td>
                  <td>{r.checkedIn ? <Check size={15} className="og-check" aria-label="Checked in" /> : ""}</td>
                  <td><button className="sp-button og-mark-signed" disabled={busyId !== null} onClick={() => mark(r)}>{busyId === r.id ? "Marking…" : "Mark signed"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
