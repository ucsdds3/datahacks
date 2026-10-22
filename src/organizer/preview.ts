import type { Application, Decision, Row } from "./types";

/**
 * `npm run dev` with `?preview`: the console runs on sample applicants held in
 * memory, so it can be clicked through without an organizer account. Staging
 * works; releasing and emailing say they're preview-only. Never on in a build.
 */
export const isPreview = () => import.meta.env.DEV && new URLSearchParams(window.location.search).has("preview");

export const PREVIEW_EVENT_ID = "preview-event";

const base: Omit<Application, "id" | "applicant_type" | "status" | "first_name" | "last_name" | "email"> = {
  user_id: null, event_id: PREVIEW_EVENT_ID, submitted_at: "2026-11-10T12:00:00-08:00", phone: "(858) 555-0100",
  school: null, level_of_study: null, major: null, graduation_year: null, organization: null, role_title: null,
  resume_url: null, resume_path: null, linkedin_url: "https://www.linkedin.com/in/example", devpost_url: null,
  judging_track: null, bio: null, essay_proudest_project: null, essay_unique_thing: null, essay_goal: null,
  heard_about: null, decision: null, decision_released_at: null, decision_emailed_at: null,
};

const hacker = (id: number, first: string, last: string, school: string, extra: Partial<Row> = {}): Row => ({
  ...base, id: `h${id}`, applicant_type: "hacker", status: "submitted", first_name: first, last_name: last,
  email: `${first.toLowerCase()}@example.edu`, school, level_of_study: "Undergraduate", major: "Data Science",
  graduation_year: "2028", essay_proudest_project: "A model that predicts campus shuttle delays from GPS pings.",
  essay_unique_thing: "I've run three workshops on data visualization.", essay_goal: "Ship something end to end in a weekend.",
  heard_about: ["Tabling on campus"], code: null, checkedIn: false, passSentAt: null, ...extra,
});

const staff = (id: number, first: string, last: string, type: Application["applicant_type"], org: string, extra: Partial<Row> = {}): Row => ({
  ...base, id: `s${id}`, applicant_type: type, status: "submitted", first_name: first, last_name: last,
  email: `${first.toLowerCase()}@example.com`, organization: org, role_title: "Engineer",
  resume_url: "https://drive.google.com/file/d/example/view",
  bio: type === "judge" ? null : "I build data pipelines and love helping teams get unstuck on modelling questions.",
  judging_track: type === "mentor" ? null : "healthcare_health_tech", code: null, checkedIn: false, passSentAt: null, ...extra,
});

let rows: Row[] = [
  hacker(1, "Ava", "Chen", "UC San Diego", { submitted_at: "2026-11-02T10:00:00-08:00" }),
  hacker(2, "Ben", "Ortiz", "UC Irvine", { decision: "accepted" }),
  hacker(3, "Chloe", "Nguyen", "UC San Diego", { submitted_at: "2026-12-05T09:00:00-08:00", decision: "waitlisted" }),
  hacker(4, "Dev", "Patel", "SDSU", { status: "accepted", decision: "accepted", decision_released_at: "2026-12-01T00:00:00Z", decision_emailed_at: "2026-12-01T00:01:00Z", code: "DH27-H001", checkedIn: true }),
  hacker(5, "Ema", "Rossi", "UCLA", { status: "rejected", decision: "rejected", decision_released_at: "2026-12-01T00:00:00Z", decision_emailed_at: "2026-12-01T00:01:00Z" }),
  staff(1, "Jane", "Doe", "mentor", "Qualcomm"),
  staff(2, "Raj", "Iyer", "hybrid", "Intuit", { decision: "accepted" }),
  staff(3, "Mia", "Lopez", "judge", "UC San Diego", { status: "accepted", decision: "accepted", decision_released_at: "2026-12-01T00:00:00Z", code: "DH27-J001" }),
];

export const previewRows = (): Row[] => rows.map(r => ({ ...r }));

export function previewStage(ids: string[], decision: Decision | null) {
  rows = rows.map(r => (ids.includes(r.id) ? { ...r, decision } : r));
}

export class PreviewOnlyError extends Error {
  constructor() {
    super("Preview only: nothing is released or emailed.");
    this.name = "PreviewOnlyError";
  }
}
