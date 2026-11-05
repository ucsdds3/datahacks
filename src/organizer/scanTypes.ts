import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { isPreview } from "./preview";
import { previewAddScanType, previewScanTypes, previewUpdateScanType } from "./checkinPreview";

/**
 * Meal and swag scans: what the check-in desk can scan for besides check-in
 * (public.scan_types, migration *_checkin_log_scans.sql). Organizers add,
 * rename, reorder and switch them off here; the desk offers the active ones
 * and record_scan keeps one scan per person per type. There's no delete,
 * because scans point at their type.
 */

export type ScanKind = "meal" | "swag" | "other";
export const SCAN_KINDS: readonly ScanKind[] = ["meal", "swag", "other"];
export const SCAN_KIND_LABEL: Record<ScanKind, string> = { meal: "Meal", swag: "Swag", other: "Other" };

export type ScanType = {
  id: string;
  event_id: string;
  label: string;
  kind: ScanKind;
  active: boolean;
  sort: number;
  opens_at: string | null;
  closes_at: string | null;
};

export type ScanTypePatch = Partial<Pick<ScanType, "label" | "kind" | "active" | "sort" | "opens_at" | "closes_at">>;

const COLUMNS = "id, event_id, label, kind, active, sort, opens_at, closes_at";
export const MAX_LABEL = 60;

/**
 * The database has no such table yet (before the migration): Postgres 42P01,
 * PostgREST's PGRST205 "Could not find the table", or a bare 404.
 */
export function isMissingTable(error: unknown): boolean {
  const e = error as { code?: string; status?: number; message?: string } | null;
  if (!e) return false;
  return e.code === "42P01" || e.code === "PGRST205" || e.status === 404
    || /could not find the table|does not exist/i.test(e.message ?? "");
}

/** The desk's order: sort, then label. */
export const byDeskOrder = (a: ScanType, b: ScanType) => a.sort - b.sort || a.label.localeCompare(b.label);

/** Why a label can't be saved, or null. Labels are unique per event, ignoring case and spaces at the ends. */
export function labelProblem(label: string, types: ScanType[], selfId?: string): string | null {
  const clean = label.trim();
  if (!clean) return "Give it a name, like “Lunch · Sat”.";
  if (clean.length > MAX_LABEL) return `Keep it under ${MAX_LABEL} characters.`;
  // eslint-disable-next-line no-control-regex
  if (/[\x01-\x1f\x7f]/.test(clean)) return "One line, no tabs.";
  if (types.some(t => t.id !== selfId && t.label.trim().toLowerCase() === clean.toLowerCase())) return "There's already one with that name.";
  return null;
}

/** Why a window can't be saved, or null. Either end may be empty. */
export function windowProblem(opensAt: string | null, closesAt: string | null): string | null {
  if (opensAt && closesAt && Date.parse(closesAt) <= Date.parse(opensAt)) return "It has to close after it opens.";
  return null;
}

/** sort for a new type: after the last one. */
export const nextSort = (types: ScanType[]) => (types.length ? Math.max(...types.map(t => t.sort)) + 10 : 10);

/**
 * Moving one type up or down a place: the new sort values, for the types
 * whose value changes. Renumbers in steps of 10 so equal sorts (two types
 * both at 0) still move.
 */
export function reorder(types: ScanType[], id: string, direction: -1 | 1): { id: string; sort: number }[] {
  const list = [...types].sort(byDeskOrder);
  const i = list.findIndex(t => t.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return [];
  [list[i], list[j]] = [list[j], list[i]];
  return list.map((t, k) => ({ id: t.id, sort: (k + 1) * 10 })).filter(({ id: tid, sort }) => types.find(t => t.id === tid)!.sort !== sort);
}

/** The event's scan types in desk order, or null when the database doesn't have scan types yet. */
export async function fetchScanTypes(eventId: string): Promise<ScanType[] | null> {
  if (isPreview()) return previewScanTypes();
  const { data, error } = await supabase.from("scan_types").select(COLUMNS).eq("event_id", eventId)
    .order("sort", { ascending: true }).order("label", { ascending: true });
  if (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
  return ((data ?? []) as ScanType[]).sort(byDeskOrder);
}

export function useScanTypes(eventId: string) {
  return useQuery({ queryKey: ["scan-types", eventId], queryFn: () => fetchScanTypes(eventId), staleTime: 60_000 });
}

export async function addScanType(eventId: string, fields: { label: string; kind: ScanKind; sort: number }) {
  const row = { event_id: eventId, label: fields.label.trim(), kind: fields.kind, sort: fields.sort, active: true };
  if (isPreview()) return previewAddScanType(row);
  const { error } = await supabase.from("scan_types").insert(row);
  if (error) throw error;
}

export async function updateScanType(eventId: string, id: string, patch: ScanTypePatch) {
  const clean = patch.label === undefined ? patch : { ...patch, label: patch.label.trim() };
  if (isPreview()) return previewUpdateScanType(id, clean);
  const { error } = await supabase.from("scan_types").update(clean).eq("id", id).eq("event_id", eventId);
  if (error) throw error;
}
