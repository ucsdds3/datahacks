import { supabase } from "@/lib/supabaseClient";
import { isPreview, previewRecordWaivers } from "./preview";

/** One matched signature for record_waivers_import. */
export type WaiverImportRow = { application_id: string; envelope_id: string | null; signed_at: string | null };

export type SkipReason = "bad_id" | "bad_envelope" | "not_in_event" | "not_accepted" | "no_account";

export type WaiverImportResult = {
  recorded: number;
  already_on_file: number;
  skipped: number;
  skipped_rows: { application_id: string | null; reason: SkipReason }[];
};

export const SKIP_LABEL: Record<SkipReason, string> = {
  bad_id: "not a valid application id",
  bad_envelope: "envelope id isn't valid",
  not_in_event: "not an application at this event",
  not_accepted: "application isn't accepted",
  no_account: "no portal account to attach it to",
};

const CHUNK = 500;

/**
 * Records the matched signatures (organizers only; the database checks the event,
 * that each person is accepted, and keeps a waiver that's already on file). Sent in
 * chunks; the counts are added up.
 */
export async function recordWaiverImport(eventId: string, rows: WaiverImportRow[]): Promise<WaiverImportResult> {
  const total: WaiverImportResult = { recorded: 0, already_on_file: 0, skipped: 0, skipped_rows: [] };
  if (isPreview()) {
    const r = previewRecordWaivers(rows.map(x => x.application_id), new Date().toISOString());
    return { recorded: r.recorded, already_on_file: r.already, skipped: r.skipped.length, skipped_rows: r.skipped.map(id => ({ application_id: id, reason: "not_accepted" })) };
  }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { data, error } = await supabase.rpc("record_waivers_import", { p_event_id: eventId, p_rows: rows.slice(i, i + CHUNK) });
    if (error) throw error;
    const r = data as WaiverImportResult;
    total.recorded += r.recorded;
    total.already_on_file += r.already_on_file;
    total.skipped += r.skipped;
    total.skipped_rows.push(...(r.skipped_rows ?? []));
  }
  return total;
}

export type MarkResult =
  | { status: "marked" | "already_on_file"; signed_at: string; source?: string; code?: string | null; name?: string | null }
  | { status: "not_found" | "not_accepted" | "no_account"; application_status?: string };

/** Marks one person's waiver signed after seeing their DocuSign completion email (source 'manual'). */
export async function markWaiverSeen(eventId: string, applicationId: string, note: string | null): Promise<MarkResult> {
  if (isPreview()) {
    const r = previewRecordWaivers([applicationId], new Date().toISOString());
    return r.recorded ? { status: "marked", signed_at: new Date().toISOString() } : r.already ? { status: "already_on_file", signed_at: "" } : { status: "not_accepted" };
  }
  const { data, error } = await supabase.rpc("mark_waiver_seen", { p_event_id: eventId, p_person_id: applicationId, p_note: note });
  if (error) throw error;
  return data as MarkResult;
}

export const MARK_FAILED: Record<"not_found" | "not_accepted" | "no_account", string> = {
  not_found: "That person isn't at this event.",
  not_accepted: "Their application isn't accepted.",
  no_account: "They don't have a portal account, so there's nothing to attach a waiver to.",
};
