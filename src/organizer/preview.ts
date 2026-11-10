import type { Quota, ReleasedRow, SendResult, StageOutcome, WalletPassResult } from "./data";
import { LIST_FIELDS, REVIEW_FIELDS, type Application, type Decision, type ListApplication, type Row } from "./types";
import type { MlhExportApp } from "./mlhExport";

/**
 * `npm run dev` with `?preview`: the console runs on sample applicants held in
 * memory, so it can be clicked through without an organizer account. Staging
 * works; releasing and emailing say they're preview-only. Never on in a build.
 */
export const isPreview = () => import.meta.env.DEV && new URLSearchParams(window.location.search).has("preview");

export const PREVIEW_EVENT_ID = "preview-event";

/**
 * `?preview=<mode>` acts out a failure, to see how the console handles it:
 *   release-drop   the release goes through but its reply is lost (network drop)
 *   release-error  the release is refused (a database error object, as Supabase returns it)
 *   email-fails    the decision emails stop partway with a network error (once)
 *   conflict       someone else changed the first application you stage
 *   daily-limit    the Gmail daily limit is almost used up
 * Modes combine with commas (?preview=release-drop,email-fails). Nothing is
 * ever sent: releases and emails only change the sample rows.
 */
const hasMode = (mode: string) => (new URLSearchParams(window.location.search).get("preview") ?? "").split(",").includes(mode);

const base: Omit<Application, "id" | "applicant_type" | "status" | "first_name" | "last_name" | "email"> = {
  user_id: null, event_id: PREVIEW_EVENT_ID, submitted_at: "2026-11-10T12:00:00-08:00", phone: "(858) 555-0100",
  school: null, level_of_study: null, major: null, graduation_year: null, organization: null, role_title: null,
  resume_url: null, linkedin_url: "https://www.linkedin.com/in/example", devpost_url: null,
  judging_track: null, bio: null, essay_proudest_project: null, essay_unique_thing: null, essay_goal: null,
  suggested_food: null, suggested_activity: null, heard_about: null, decision: null, decision_released_at: null, decision_emailed_at: null,
  decided_by: null, decided_at: null, decision_version: 0,
  gender: null, race_ethnicity: null, city_of_residence: "San Diego", country_of_residence: "United States",
  hackathon_experience: null, github_url: "https://github.com/example", wants_travel_stipend: false,
  travel_region: null, travel_method: null, travel_distance: null, travel_stipend_reason: null,
};

/** A whole sample application plus its roster fields; the tables only get the list columns of it. */
type Sample = Application & Pick<Row, "code" | "checkedIn" | "passSentAt" | "waiverSignedAt" | "mlh">;

const hacker = (id: number, first: string, last: string, school: string, extra: Partial<Sample> = {}): Sample => ({
  ...base, id: `h${id}`, applicant_type: "hacker", status: "submitted", first_name: first, last_name: last,
  email: `${first.toLowerCase()}@example.edu`, school, level_of_study: "Undergraduate", major: "Data Science",
  graduation_year: "2028", essay_proudest_project: "A model that predicts campus shuttle delays from GPS pings.",
  essay_unique_thing: "I've run three workshops on data visualization.", essay_goal: "Ship something end to end in a weekend.",
  suggested_food: "Boba", suggested_activity: "Smash tournament", heard_about: ["Tabling on campus"], code: null, checkedIn: false, passSentAt: null, waiverSignedAt: null,
  // Every other sample hacker has agreed to MLH's checkboxes (shown with ?preview&mlh).
  mlh: id % 2 === 0
    ? { codeOfConductAt: "2026-11-12T10:00:00-08:00", dataSharingAt: "2026-11-12T10:00:00-08:00", emailsOptIn: id % 4 === 0 }
    : { codeOfConductAt: null, dataSharingAt: null, emailsOptIn: false },
  ...extra,
});

const staff = (id: number, first: string, last: string, type: Application["applicant_type"], org: string, extra: Partial<Sample> = {}): Sample => ({
  ...base, id: `s${id}`, applicant_type: type, status: "submitted", first_name: first, last_name: last,
  email: `${first.toLowerCase()}@example.com`, organization: org, role_title: "Engineer",
  resume_url: "https://drive.google.com/file/d/example/view",
  bio: type === "judge" ? null : "I build data pipelines and love helping teams get unstuck on modelling questions.",
  judging_track: type === "mentor" ? null : "biotech_life_sciences", code: null, checkedIn: false, passSentAt: null, waiverSignedAt: null, ...extra,
});

let rows: Sample[] = [
  hacker(1, "Ava", "Chen", "UC San Diego", { submitted_at: "2026-11-02T10:00:00-08:00" }),
  hacker(2, "Ben", "Ortiz", "UC Irvine", { decision: "accepted", decided_by: "tijil@ds3.club", decided_at: "2026-12-04T15:04:00-08:00", decision_version: 1 }),
  hacker(3, "Chloe", "Nguyen", "UC San Diego", { submitted_at: "2026-12-05T09:00:00-08:00", decision: "waitlisted" }),
  hacker(4, "Dev", "Patel", "SDSU", { status: "accepted", decision: "accepted", decision_released_at: "2026-12-01T00:00:00Z", decision_emailed_at: "2026-12-01T00:01:00Z", code: "DH27-H001", checkedIn: true, passSentAt: "2026-12-01T00:05:00Z", waiverSignedAt: "2026-12-02T18:00:00Z" }),
  hacker(5, "Ema", "Rossi", "UCLA", { status: "rejected", decision: "rejected", decision_released_at: "2026-12-01T00:00:00Z", decision_emailed_at: "2026-12-01T00:01:00Z" }),
  hacker(6, "Farah", "Haddad", "UC San Diego", { status: "accepted", decision: "accepted", decision_released_at: "2026-12-01T00:00:00Z", decision_emailed_at: "2026-12-01T00:01:00Z", code: "DH27-H002" }),
  hacker(7, "Gus", "Kim", "UC Davis", { status: "draft", submitted_at: null }),
  hacker(8, "Hana", "Sato", "UC San Diego", { decision: "rejected", decision_version: 1 }),
  staff(1, "Jane", "Doe", "mentor", "Qualcomm"),
  staff(2, "Raj", "Iyer", "hybrid", "Intuit", { decision: "accepted" }),
  staff(3, "Mia", "Lopez", "judge", "UC San Diego", { status: "accepted", decision: "accepted", decision_released_at: "2026-12-01T00:00:00Z", code: "DH27-J001" }),
];

export const previewRows = (): Row[] => rows.map(r => ({
  ...(Object.fromEntries([...LIST_FIELDS, ...REVIEW_FIELDS].map(f => [f, r[f]])) as ListApplication),
  code: r.code, checkedIn: r.checkedIn, passSentAt: r.passSentAt, waiverSignedAt: r.waiverSignedAt,
  ...(r.mlh ? { mlh: r.mlh } : {}),
}));

/** The MLH export's columns for the sample hackers who agreed to share their data. */
export const previewMlhExport = (): MlhExportApp[] =>
  rows.filter(r => r.applicant_type === "hacker" && r.mlh?.dataSharingAt).map((r, i) => ({
    id: r.id, first_name: r.first_name, last_name: r.last_name, email: r.email, phone: r.phone, school: r.school,
    level_of_study: "Undergraduate (3+ year: bachelor's)", country_of_residence: r.country_of_residence,
    birthdate: `200${i % 7}-0${(i % 9) + 1}-15`,
    mlh_code_of_conduct_at: r.mlh!.codeOfConductAt, mlh_data_sharing_at: r.mlh!.dataSharingAt, mlh_emails_opt_in: r.mlh!.emailsOptIn,
  }));

/** The whole sample application, as the detail drawer loads it. */
export function previewApplication(id: string): Application | null {
  const found = rows.find(r => r.id === id);
  if (!found) return null;
  const { code, checkedIn, passSentAt, waiverSignedAt, mlh, ...app } = found;
  return app;
}

let conflictShown = false;

export function previewStage(items: { id: string; decision_version?: number }[], decision: Decision | null): StageOutcome {
  const outcome: StageOutcome = { updated: [], conflicts: [], drafts: [], missing: [] };
  for (const item of items) {
    const r = rows.find(x => x.id === item.id);
    if (!r) { outcome.missing.push(item.id); continue; }
    if (r.status === "draft" && decision) { outcome.drafts.push(item.id); continue; }
    if (hasMode("conflict") && !conflictShown) {
      // Someone else accepted this one a minute ago.
      conflictShown = true;
      Object.assign(r, { decision: "accepted", decided_by: "ansh@ds3.club", decided_at: new Date(Date.now() - 60_000).toISOString(), decision_version: r.decision_version + 1 });
      outcome.conflicts.push({ id: r.id, decision: r.decision, decided_by: r.decided_by, decided_at: r.decided_at, version: r.decision_version });
      continue;
    }
    if (r.decision !== decision) {
      Object.assign(r, { decision, decided_by: "preview@ds3.club", decided_at: new Date().toISOString(), decision_version: r.decision_version + 1 });
    }
    outcome.updated.push({ id: r.id, version: r.decision_version });
  }
  rows = [...rows];
  return outcome;
}

let nextCode = 10;

/** Releases the sample rows shown (like the database: only unchanged versions, never drafts). */
export async function previewRelease(targets: { id: string; decision_version: number }[]): Promise<{ released: ReleasedRow[]; notReleased: string[] }> {
  await new Promise(resolve => setTimeout(resolve, 400));
  if (hasMode("release-error")) throw { message: "Not authorized", code: "P0001", details: null, hint: null };
  const released: ReleasedRow[] = [];
  for (const t of targets) {
    const r = rows.find(x => x.id === t.id);
    if (!r || !r.decision || r.status === "draft" || r.status === r.decision || r.decision_version !== t.decision_version) continue;
    Object.assign(r, {
      status: r.decision, decision_released_at: new Date().toISOString(), decision_emailed_at: null,
      code: r.decision === "accepted" ? r.code ?? `DH27-${r.applicant_type === "hacker" ? "H" : "M"}0${nextCode++}` : null,
    });
    released.push({ application_id: r.id, email: r.email, first_name: r.first_name, applicant_type: r.applicant_type, status: r.status! });
  }
  rows = [...rows];
  if (hasMode("release-drop")) {
    throw Object.assign(new TypeError("Failed to fetch"), { name: "TypeError" });
  }
  const done = new Set(released.map(r => r.application_id));
  return { released, notReleased: targets.map(t => t.id).filter(id => !done.has(id)) };
}

let emailsSentInPreview = 0;
let emailFailedOnce = false;

/** Marks the sample rows as emailed (decisions); in email-fails mode, stops with a network error after the first one. */
export async function previewSendEmails(ids: string[], kind: string, onProgress?: (done: number) => void): Promise<SendResult> {
  const result: SendResult = { sent: 0, skipped: [], failed: [], notSent: [], stopped: null, quota: previewQuota() };
  for (const [i, id] of ids.entries()) {
    await new Promise(resolve => setTimeout(resolve, 150));
    if (hasMode("email-fails") && !emailFailedOnce && emailsSentInPreview >= 1) {
      emailFailedOnce = true;
      const { SendError } = await import("./data");
      result.notSent = ids.slice(i);
      throw new SendError("Couldn't reach the email service (a network problem, or it timed out). Anyone already sent to is recorded, so sending again only reaches the rest.", result, "network");
    }
    const r = rows.find(x => x.id === id);
    if (kind !== "blast" && r?.decision_emailed_at) { result.skipped.push({ id, reason: "already_sent" }); continue; }
    if (r && kind !== "blast") r.decision_emailed_at = new Date().toISOString();
    result.sent++;
    emailsSentInPreview++;
    onProgress?.(i + 1);
  }
  rows = [...rows];
  return result;
}

export async function previewSendPasses(ids: string[], onProgress?: (sent: number) => void): Promise<WalletPassResult> {
  let sent = 0;
  for (const id of ids) {
    await new Promise(resolve => setTimeout(resolve, 200));
    const r = rows.find(x => x.id === id);
    if (r?.code) { r.passSentAt = new Date().toISOString(); sent++; onProgress?.(sent); }
  }
  rows = [...rows];
  return { sent, failed: [] };
}

export const previewQuota = (): Quota =>
  hasMode("daily-limit")
    ? { used: 1797, limit: 1800, remaining: 3, frees_at: new Date(Date.now() + 5 * 3600_000).toISOString() }
    : { used: 412 + emailsSentInPreview, limit: 1800, remaining: 1800 - 412 - emailsSentInPreview, frees_at: null };

export class PreviewOnlyError extends Error {
  constructor() {
    super("Preview only: nothing is released or emailed.");
    this.name = "PreviewOnlyError";
  }
}

/** Preview: record waivers for these sample applications (accepted ones without one). Returns how many were new. */
export function previewRecordWaivers(ids: string[], signedAt: string): { recorded: number; already: number; skipped: string[] } {
  let recorded = 0;
  let already = 0;
  const skipped: string[] = [];
  for (const id of ids) {
    const r = rows.find(x => x.id === id);
    if (!r || r.status !== "accepted") { skipped.push(id); continue; }
    if (r.waiverSignedAt) { already++; continue; }
    r.waiverSignedAt = signedAt;
    recorded++;
  }
  rows = [...rows];
  return { recorded, already, skipped };
}
