import { useMemo, useState } from "react";
import { Check, Download, Search, Ticket } from "lucide-react";
import { applicationBatch } from "@/staff-portal/config";
import ApplicationDetail from "./ApplicationDetail";
import { csvFilename, downloadCsv } from "./csv";
import { fetchMlhExport, stageDecision, stageProblems } from "./data";
import { mlhExportRows } from "./mlhExport";
import { errorText } from "./errors";
import { DECISION_LABEL, TAB_LABEL, TYPE_LABEL, acceptedNotReleased, canGetPass, fullName, isDraft, isStaged, mlhAgreed, passOnHold, placeOf, tabOf, type Decision, type Kind, type Row, type Tab } from "./types";

/** The table's tabs: the four decision tabs, plus drafts (started, never submitted) on their own. */
type View = Tab | "draft";
const TABS: Tab[] = ["applied", "accepted", "waitlisted", "rejected"];
const viewOf = (r: Row): View => (isDraft(r) ? "draft" : placeOf(r));

type Column = { header: string; value: (row: Row) => string };

const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "");

const COMMON_START: Column[] = [
  { header: "Name", value: fullName },
  { header: "Email", value: r => r.email ?? "" },
  { header: "Phone", value: r => r.phone ?? "" },
];
const COMMON_END: Column[] = [
  { header: "Batch", value: r => (isDraft(r) ? "Draft" : applicationBatch(r.submitted_at) === "priority" ? "Priority" : "Regular") },
  { header: "Submitted", value: r => shortDate(r.submitted_at) },
  // Signed liability waiver (from the check-in roster, so accepted people only).
  { header: "Waiver", value: r => (r.waiverSignedAt ? "Signed" : "") },
  { header: "Checked in", value: r => (r.checkedIn ? "Yes" : "") },
];
const COLUMNS: Record<Kind, Column[]> = {
  hacker: [
    ...COMMON_START,
    { header: "School", value: r => r.school ?? "" },
    { header: "Level", value: r => r.level_of_study ?? "" },
    ...COMMON_END,
  ],
  staff: [
    ...COMMON_START,
    { header: "Type", value: r => TYPE_LABEL[r.applicant_type] },
    { header: "Organization", value: r => r.organization ?? "" },
    ...COMMON_END,
  ],
};

/** Extra columns only in the CSV, so an export has what a spreadsheet needs. */
const CSV_EXTRA: Column[] = [
  { header: "Status", value: r => (isDraft(r) ? "draft (not submitted)" : r.status ?? "") },
  { header: "Staged decision", value: r => (isStaged(r) ? r.decision! : "") },
  { header: "Check-in code", value: r => r.code ?? "" },
];

/**
 * While MLH is on (docs/mlh.md), hackers get an "MLH consent" column and
 * filter, the agreements in the CSV, and an MLH export.
 */
const MLH_COLUMN: Column = { header: "MLH consent", value: r => (mlhAgreed(r) ? "Agreed" : "Not yet") };
const MLH_CSV: Column[] = [
  { header: "MLH Code of Conduct (agreed at)", value: r => r.mlh?.codeOfConductAt ?? "" },
  { header: "MLH data sharing (agreed at)", value: r => r.mlh?.dataSharingAt ?? "" },
  { header: "MLH emails opt-in", value: r => (r.mlh?.emailsOptIn ? "Yes" : "No") },
];
type MlhFilter = "all" | "agreed" | "not-yet";

const TABLE_SLUG: Record<Kind, string> = { hacker: "hackers", staff: "mentors-judges" };

export default function ApplicationsTable({ kind, rows, onChanged, onSendPasses, mlhOn = false, eventId }: {
  kind: Kind;
  rows: Row[];
  onChanged: () => void;
  /** Opens the Passes page with these application ids selected. */
  onSendPasses?: (ids: string[]) => void;
  /** MLH is on (useMlhOn): the hackers table shows MLH consent and offers the MLH export, for this event. */
  mlhOn?: boolean;
  eventId?: string;
}) {
  const [tab, setTab] = useState<View>("applied");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mlh = mlhOn && kind === "hacker";
  const [mlhFilter, setMlhFilter] = useState<MlhFilter>("all");

  const columns = useMemo(() => {
    if (!mlh) return COLUMNS[kind];
    const cols = [...COLUMNS[kind]];
    cols.splice(cols.findIndex(c => c.header === "Batch"), 0, MLH_COLUMN);
    return cols;
  }, [kind, mlh]);
  const [counts, unreleased] = useMemo(() => {
    const c: Record<View, number> = { applied: 0, accepted: 0, waitlisted: 0, rejected: 0, draft: 0 };
    const u: Record<View, number> = { applied: 0, accepted: 0, waitlisted: 0, rejected: 0, draft: 0 };
    rows.forEach(r => {
      c[viewOf(r)]++;
      if (isStaged(r)) u[viewOf(r)]++;
    });
    return [c, u];
  }, [rows]);
  const views: View[] = counts.draft > 0 || tab === "draft" ? [...TABS, "draft"] : TABS;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => viewOf(r) === tab
      && (!mlh || mlhFilter === "all" || (mlhFilter === "agreed") === mlhAgreed(r))
      && (!q || [fullName(r), r.email, r.phone, r.school, r.organization].some(v => v?.toLowerCase().includes(q))));
  }, [rows, tab, query, mlh, mlhFilter]);
  // Drafts can't be decided, so they're never selectable (select all included).
  const selectable = useMemo(() => visible.filter(r => !isDraft(r)), [visible]);

  const allSelected = selectable.length > 0 && selectable.every(r => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map(r => r.id)));
  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const switchTab = (t: View) => { setTab(t); setSelected(new Set()); };

  const stageSelected = async (decision: Decision | null) => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await stageDecision(selectable.filter(r => selected.has(r.id)), decision);
      const names = new Map(rows.map(r => [r.id, fullName(r)]));
      setError(stageProblems(outcome, id => names.get(id) ?? "Someone"));
      setSelected(new Set());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const exportCsv = () => {
    const cols = [...columns, ...CSV_EXTRA, ...(mlh ? MLH_CSV : [])];
    downloadCsv(csvFilename(TABLE_SLUG[kind], tab), [cols.map(c => c.header), ...visible.map(r => cols.map(c => c.value(r)))]);
  };

  /** MLH's registration (and check-in) data for the people in this list who agreed to share it. */
  const exportMlh = async () => {
    if (!eventId) return;
    setBusy(true);
    setError(null);
    try {
      const csv = mlhExportRows(await fetchMlhExport(eventId), visible);
      if (csv.length === 1) setError("Nobody in this list has agreed to share their data with MLH, so there's nothing to export.");
      else downloadCsv(csvFilename("mlh-hackers", tab), csv);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const open = rows.find(r => r.id === openId);
  const selectedRows = selectable.filter(r => selected.has(r.id));
  const selectedCount = selectedRows.length;
  // Also shown for people not released yet (the Passes page releases first) or about to be un-accepted (it says why not).
  const canSendPasses = !!onSendPasses && selectedRows.some(r => canGetPass(r) || passOnHold(r) || acceptedNotReleased(r));

  return (
    <section className="sp-card og-table-card">
      <div className="sp-card-header">
        <div className="sp-tabs" role="tablist">
          {views.map(t => (
            <button key={t} role="tab" aria-selected={t === tab} className={t === tab ? "active" : ""} onClick={() => switchTab(t)}>
              {t === "draft" ? "Drafts" : TAB_LABEL[t]} <span className="og-count">{counts[t]}</span>
              {unreleased[t] > 0 && <span className="og-count-unreleased"> ({unreleased[t]} not released)</span>}
            </button>
          ))}
        </div>
        <div className="og-toolbar">
          <label className="og-search">
            <Search size={15} aria-hidden />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, school…" aria-label="Search" />
          </label>
          {mlh && (
            <label className="og-mlh-filter">
              <span>MLH consent</span>
              <select value={mlhFilter} onChange={e => setMlhFilter(e.target.value as MlhFilter)}>
                <option value="all">All</option>
                <option value="agreed">Agreed</option>
                <option value="not-yet">Not yet</option>
              </select>
            </label>
          )}
          <button className="sp-button" onClick={exportCsv} disabled={visible.length === 0}>
            <Download size={15} aria-hidden /> CSV
          </button>
          {mlh && (
            <button className="sp-button" onClick={exportMlh} disabled={busy || visible.length === 0 || !eventId}>
              <Download size={15} aria-hidden /> MLH export
            </button>
          )}
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="og-bulk">
          <span>{selectedCount} selected</span>
          {(["accepted", "waitlisted", "rejected"] as const).map(d => (
            <button key={d} className={`sp-button og-decide-${d}`} disabled={busy} onClick={() => stageSelected(d)}>{DECISION_LABEL[d]}</button>
          ))}
          <button className="sp-button" disabled={busy} onClick={() => stageSelected(null)}>Clear decision</button>
          {canSendPasses && (
            <button className="sp-button" disabled={busy} onClick={() => onSendPasses!(selectedRows.map(r => r.id))}>
              <Ticket size={15} aria-hidden /> Send pass
            </button>
          )}
        </div>
      )}
      {error && <p className="sp-error" role="alert">{error}</p>}
      {tab === "draft" && visible.length > 0 && (
        <p className="og-hint">Started but never submitted. Drafts can't be decided, released or emailed; they move to Applied once submitted.</p>
      )}

      {visible.length === 0 ? (
        <p className="og-empty">{query || (mlh && mlhFilter !== "all") ? "Nobody matches that search." : tab === "draft" ? "No drafts." : `No ${TAB_LABEL[tab].toLowerCase()} applications yet.`}</p>
      ) : (
        <div className="sp-table-wrap">
          <table className="sp-table og-table">
            <thead>
              <tr>
                <th>{selectable.length > 0 && <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />}</th>
                <th>{columns[0].header}</th>
                {/* Right after the name, so it's visible without scrolling sideways. */}
                <th className="og-release-col">Release</th>
                {columns.slice(1).map(c => <th key={c.header}>{c.header}</th>)}
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={r.id} className={r.id === openId ? "open" : undefined} onClick={() => setOpenId(r.id)}>
                  <td onClick={e => e.stopPropagation()}>
                    {!isDraft(r) && <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${fullName(r)}`} />}
                  </td>
                  <td>{columns[0].value(r)}</td>
                  <td className="og-release-col">
                    {isDraft(r) && <span className="og-badge draft">Draft</span>}
                    {isStaged(r) && <span className={`og-badge ${r.decision}`}>Not released</span>}
                    {isStaged(r) && tabOf(r.status) !== "applied" && <span className="og-was">was {TAB_LABEL[tabOf(r.status)].toLowerCase()}</span>}
                  </td>
                  {columns.slice(1).map(c => (
                    <td key={c.header}>
                      {c.header === "Checked in" ? (r.checkedIn ? <Check size={15} className="og-check" aria-label="Checked in" /> : "")
                        : c.header === "Waiver" ? (r.waiverSignedAt ? <Check size={15} className="og-check" aria-label="Waiver signed" /> : "")
                        : c.value(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <ApplicationDetail row={open} onClose={() => setOpenId(null)} onChanged={onChanged} />}
    </section>
  );
}
