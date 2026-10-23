import { useMemo, useState } from "react";
import { Check, Download, Search } from "lucide-react";
import { applicationBatch } from "@/staff-portal/config";
import ApplicationDetail from "./ApplicationDetail";
import { csvFilename, downloadCsv } from "./csv";
import { stageDecision } from "./data";
import { DECISION_LABEL, TAB_LABEL, TYPE_LABEL, fullName, isStaged, placeOf, tabOf, type Decision, type Kind, type Row, type Tab } from "./types";

const TABS: Tab[] = ["applied", "accepted", "waitlisted", "rejected"];

type Column = { header: string; value: (row: Row) => string };

const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "");

const COMMON_START: Column[] = [
  { header: "Name", value: fullName },
  { header: "Email", value: r => r.email ?? "" },
  { header: "Phone", value: r => r.phone ?? "" },
];
const COMMON_END: Column[] = [
  { header: "Batch", value: r => (applicationBatch(r.submitted_at) === "priority" ? "Priority" : "Regular") },
  { header: "Submitted", value: r => shortDate(r.submitted_at) },
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
  { header: "Status", value: r => r.status ?? "" },
  { header: "Staged decision", value: r => (isStaged(r) ? r.decision! : "") },
  { header: "Check-in code", value: r => r.code ?? "" },
];

const TABLE_SLUG: Record<Kind, string> = { hacker: "hackers", staff: "mentors-judges" };

export default function ApplicationsTable({ kind, rows, onChanged }: { kind: Kind; rows: Row[]; onChanged: () => void }) {
  const [tab, setTab] = useState<Tab>("applied");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns = COLUMNS[kind];
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { applied: 0, accepted: 0, waitlisted: 0, rejected: 0 };
    rows.forEach(r => c[placeOf(r)]++);
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => placeOf(r) === tab
      && (!q || [fullName(r), r.email, r.phone, r.school, r.organization].some(v => v?.toLowerCase().includes(q))));
  }, [rows, tab, query]);

  const allSelected = visible.length > 0 && visible.every(r => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visible.map(r => r.id)));
  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const switchTab = (t: Tab) => { setTab(t); setSelected(new Set()); };

  const stageSelected = async (decision: Decision | null) => {
    setBusy(true);
    setError(null);
    try {
      await stageDecision([...selected].filter(id => visible.some(r => r.id === id)), decision);
      setSelected(new Set());
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const cols = [...columns, ...CSV_EXTRA];
    downloadCsv(csvFilename(TABLE_SLUG[kind], tab), [cols.map(c => c.header), ...visible.map(r => cols.map(c => c.value(r)))]);
  };

  const open = rows.find(r => r.id === openId);
  const selectedCount = visible.filter(r => selected.has(r.id)).length;

  return (
    <section className="sp-card og-table-card">
      <div className="sp-card-header">
        <div className="sp-tabs" role="tablist">
          {TABS.map(t => (
            <button key={t} role="tab" aria-selected={t === tab} className={t === tab ? "active" : ""} onClick={() => switchTab(t)}>
              {TAB_LABEL[t]} <span className="og-count">{counts[t]}</span>
            </button>
          ))}
        </div>
        <div className="og-toolbar">
          <label className="og-search">
            <Search size={15} aria-hidden />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, school…" aria-label="Search" />
          </label>
          <button className="sp-button" onClick={exportCsv} disabled={visible.length === 0}>
            <Download size={15} aria-hidden /> CSV
          </button>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="og-bulk">
          <span>{selectedCount} selected</span>
          {(["accepted", "waitlisted", "rejected"] as const).map(d => (
            <button key={d} className={`sp-button og-decide-${d}`} disabled={busy} onClick={() => stageSelected(d)}>{DECISION_LABEL[d]}</button>
          ))}
          <button className="sp-button" disabled={busy} onClick={() => stageSelected(null)}>Clear decision</button>
        </div>
      )}
      {error && <p className="sp-error">{error}</p>}

      {visible.length === 0 ? (
        <p className="og-empty">{query ? "Nobody matches that search." : `No ${TAB_LABEL[tab].toLowerCase()} applications yet.`}</p>
      ) : (
        <div className="sp-table-wrap">
          <table className="sp-table og-table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" /></th>
                {columns.map(c => <th key={c.header}>{c.header}</th>)}
                <th>Release</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={r.id} className={r.id === openId ? "open" : undefined} onClick={() => setOpenId(r.id)}>
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${fullName(r)}`} />
                  </td>
                  {columns.map(c => (
                    <td key={c.header}>
                      {c.header === "Checked in" ? (r.checkedIn ? <Check size={15} className="og-check" aria-label="Checked in" /> : "") : c.value(r)}
                    </td>
                  ))}
                  <td>
                    {isStaged(r) && <span className={`og-badge ${r.decision}`}>Not released</span>}
                    {isStaged(r) && tabOf(r.status) !== "applied" && <span className="og-was">was {TAB_LABEL[tabOf(r.status)].toLowerCase()}</span>}
                  </td>
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
