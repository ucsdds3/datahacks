import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import { fromEventInput, toEventInput } from "./dayOf";
import {
  SCAN_KINDS, SCAN_KIND_LABEL, MAX_LABEL, addScanType, labelProblem, nextSort, reorder, updateScanType, useScanTypes, windowProblem,
  type ScanKind, type ScanType, type ScanTypePatch,
} from "./scanTypes";

/**
 * Day of → Meals & swag: the scan types the check-in desk can switch to
 * (Lunch · Sat, T-shirt…). Add, rename, change the kind, reorder, switch off,
 * and an optional time window the desk shows next to the name. Hidden on a
 * database without scan types yet.
 */
export default function ScanTypesCard({ eventId }: { eventId: string }) {
  const query = useScanTypes(eventId);
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  if (query.isPending || query.data === null) return null;
  if (query.isError) {
    return (
      <section className="sp-card og-dayof-card" aria-labelledby="og-scantypes">
        <h2 id="og-scantypes">Meals &amp; swag</h2>
        <p className="sp-error">Couldn't load scan types: {(query.error as Error).message}</p>
      </section>
    );
  }
  const types = query.data;

  /** Runs one change, reloads, and words what happened. */
  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setNote(null);
    try {
      await work();
      setNote({ ok: true, text: done });
      return true;
    } catch (e) {
      setNote({ ok: false, text: saveError(e) });
      return false;
    } finally {
      setBusy(false);
      await client.invalidateQueries({ queryKey: ["scan-types", eventId] });
    }
  };

  const move = (t: ScanType, direction: -1 | 1) => {
    const changes = reorder(types, t.id, direction);
    if (changes.length) run(() => Promise.all(changes.map(c => updateScanType(eventId, c.id, { sort: c.sort }))), `Moved ${t.label} ${direction < 0 ? "up" : "down"}.`);
  };

  return (
    <section className="sp-card og-dayof-card og-scantypes" aria-labelledby="og-scantypes">
      <h2 id="og-scantypes">Meals &amp; swag</h2>
      <p className="og-hint">
        What the check-in desk can scan for besides check-in. The desk lists the active ones in this order, and each
        person can be scanned once per type. Counts are on the Check-in tab.
      </p>
      {types.length > 0 && (
        <ul className="og-scantypes-list">
          {types.map((t, i) => (
            <ScanTypeRow
              key={t.id}
              t={t}
              types={types}
              busy={busy}
              first={i === 0}
              last={i === types.length - 1}
              onMove={d => move(t, d)}
              onSave={(patch, done) => run(() => updateScanType(eventId, t.id, patch), done)}
            />
          ))}
        </ul>
      )}
      <AddScanType types={types} busy={busy} onAdd={(label, kind) => run(() => addScanType(eventId, { label, kind, sort: nextSort(types) }), `Added ${label.trim()}.`)} />
      {note && <p className={note.ok ? "og-success" : "sp-error"} role="status">{note.text}</p>}
    </section>
  );
}

function saveError(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err?.code === "23505") return "There's already one with that name.";
  return err?.message ?? String(e);
}

function ScanTypeRow({ t, types, busy, first, last, onMove, onSave }: {
  t: ScanType; types: ScanType[]; busy: boolean; first: boolean; last: boolean;
  onMove: (direction: -1 | 1) => void;
  onSave: (patch: ScanTypePatch, done: string) => Promise<boolean>;
}) {
  const [label, setLabel] = useState(t.label);
  const [kind, setKind] = useState<ScanKind>(t.kind);
  const [opens, setOpens] = useState(toEventInput(t.opens_at));
  const [closes, setCloses] = useState(toEventInput(t.closes_at));
  // Pick up saves (and other organizers' changes) when the list reloads.
  useEffect(() => {
    setLabel(t.label);
    setKind(t.kind);
    setOpens(toEventInput(t.opens_at));
    setCloses(toEventInput(t.closes_at));
  }, [t.label, t.kind, t.opens_at, t.closes_at]);

  const opensAt = fromEventInput(opens);
  const closesAt = fromEventInput(closes);
  // Times compare as the inputs show them (to the minute), so a saved time with seconds isn't "changed".
  const dirty = label.trim() !== t.label || kind !== t.kind || opens !== toEventInput(t.opens_at) || closes !== toEventInput(t.closes_at);
  const problem = labelProblem(label, types, t.id) ?? windowProblem(opensAt, closesAt);
  const id = `og-st-${t.id}`;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || problem) return;
    onSave({ label, kind, opens_at: opensAt, closes_at: closesAt }, `Saved ${label.trim()}.`);
  };

  return (
    <li className={`og-scantype${t.active ? "" : " off"}`}>
      <form onSubmit={save} className="og-scantype-form" aria-label={t.label}>
        <span className="og-scantype-move">
          <button type="button" className="og-icon-button" disabled={busy || first} onClick={() => onMove(-1)} aria-label={`Move ${t.label} up`}><ArrowUp size={16} aria-hidden /></button>
          <button type="button" className="og-icon-button" disabled={busy || last} onClick={() => onMove(1)} aria-label={`Move ${t.label} down`}><ArrowDown size={16} aria-hidden /></button>
        </span>
        <label className="og-scantype-label">
          <span className="sr-only">Name</span>
          <input id={`${id}-label`} value={label} maxLength={MAX_LABEL + 10} onChange={e => setLabel(e.target.value)} aria-label={`Name of ${t.label}`} aria-invalid={!!labelProblem(label, types, t.id)} />
        </label>
        <select value={kind} onChange={e => setKind(e.target.value as ScanKind)} aria-label={`Kind of ${t.label}`}>
          {SCAN_KINDS.map(k => <option key={k} value={k}>{SCAN_KIND_LABEL[k]}</option>)}
        </select>
        <label className="og-scantype-time">
          <span>Opens</span>
          <input type="datetime-local" value={opens} onChange={e => setOpens(e.target.value)} aria-label={`${t.label} opens (Pacific, optional)`} />
        </label>
        <label className="og-scantype-time">
          <span>Closes</span>
          <input type="datetime-local" value={closes} onChange={e => setCloses(e.target.value)} aria-label={`${t.label} closes (Pacific, optional)`} />
        </label>
        <label className="og-ci-check og-scantype-active">
          <input
            type="checkbox"
            checked={t.active}
            disabled={busy}
            onChange={e => onSave({ active: e.target.checked }, e.target.checked ? `${t.label} is on at the desk.` : `${t.label} is off at the desk. Scans already made are kept.`)}
          />
          Active
        </label>
        <button type="submit" className="sp-button" disabled={busy || !dirty || !!problem}>Save</button>
        {dirty && problem && <span className="sp-error og-scantype-problem" role="alert">{problem}</span>}
      </form>
    </li>
  );
}

function AddScanType({ types, busy, onAdd }: { types: ScanType[]; busy: boolean; onAdd: (label: string, kind: ScanKind) => Promise<boolean> }) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<ScanKind>("meal");
  const [tried, setTried] = useState(false);
  const problem = labelProblem(label, types);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (problem) return;
    if (await onAdd(label, kind)) {
      setLabel("");
      setTried(false);
    }
  };

  return (
    <form onSubmit={add} className="og-scantype-add">
      <label className="og-scantype-label">
        <span>New scan</span>
        <input value={label} maxLength={MAX_LABEL + 10} onChange={e => setLabel(e.target.value)} placeholder="Lunch · Sat" />
      </label>
      <label>
        <span>Kind</span>
        <select value={kind} onChange={e => setKind(e.target.value as ScanKind)}>
          {SCAN_KINDS.map(k => <option key={k} value={k}>{SCAN_KIND_LABEL[k]}</option>)}
        </select>
      </label>
      <button type="submit" className="sp-button primary" disabled={busy}>Add</button>
      {tried && problem && <span className="sp-error og-scantype-problem" role="alert">{problem}</span>}
    </form>
  );
}
