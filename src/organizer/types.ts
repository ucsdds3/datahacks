export type ApplicantType = "hacker" | "mentor" | "judge" | "hybrid";
export type Decision = "accepted" | "waitlisted" | "rejected";
export type Status = "draft" | "submitted" | Decision;

/** Which of the two organizer tables a row belongs to. */
export type Kind = "hacker" | "staff";

/** The tabs on each table. "applied" covers draft and submitted. */
export type Tab = "applied" | Decision;

export type Application = {
  id: string;
  user_id: string | null;
  event_id: string;
  applicant_type: ApplicantType;
  status: Status | null;
  submitted_at: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  school: string | null;
  level_of_study: string | null;
  major: string | null;
  graduation_year: string | null;
  organization: string | null;
  role_title: string | null;
  resume_url: string | null;
  linkedin_url: string | null;
  devpost_url: string | null;
  judging_track: string | null;
  bio: string | null;
  essay_proudest_project: string | null;
  essay_unique_thing: string | null;
  essay_goal: string | null;
  heard_about: string[] | null;
  gender: string | null;
  race_ethnicity: string | null;
  city_of_residence: string | null;
  country_of_residence: string | null;
  hackathon_experience: string | null;
  github_url: string | null;
  wants_travel_stipend: boolean | null;
  travel_region: string | null;
  travel_method: string | null;
  travel_distance: string | null;
  travel_stipend_reason: string | null;
  decision: Decision | null;
  decision_released_at: string | null;
  decision_emailed_at: string | null;
};

/** An application with what the check-in roster knows about it. */
/** passSentAt: when the check-in pass was emailed (attendees.emailed_at). */
export type Row = Application & { code: string | null; checkedIn: boolean; passSentAt: string | null };

export const kindOf = (type: ApplicantType): Kind => (type === "hacker" ? "hacker" : "staff");

export const tabOf = (status: Status | null): Tab =>
  status === "accepted" || status === "waitlisted" || status === "rejected" ? status : "applied";

/** A decision is staged when it's been chosen but not released yet. */
export const isStaged = (app: Application) => app.decision !== null && app.decision !== app.status;

/**
 * The tab a row sits in on the console: the decision an organizer picked, as
 * soon as they pick it. Applicants only see it once decisions are released.
 */
export const placeOf = (app: Application): Tab => app.decision ?? tabOf(app.status);

export const TYPE_LABEL: Record<ApplicantType, string> = {
  hacker: "Hacker",
  mentor: "Mentor",
  judge: "Judge",
  hybrid: "Mentor & judge",
};

export const TAB_LABEL: Record<Tab, string> = {
  applied: "Applied",
  accepted: "Accepted",
  waitlisted: "Waitlisted",
  rejected: "Rejected",
};

export const DECISION_LABEL: Record<Decision, string> = {
  accepted: "Accept",
  waitlisted: "Waitlist",
  rejected: "Reject",
};

export const fullName = (app: Application) =>
  [app.first_name, app.last_name].filter(Boolean).join(" ").trim() || "(no name)";

const DECISIONS: readonly string[] = ["accepted", "waitlisted", "rejected"];

/** Released, but the decision email never went out (for example, sending wasn't set up yet). */
export const unsentDecisionRows = <T extends Application>(rows: T[]) =>
  rows.filter(r => r.decision_released_at && !r.decision_emailed_at && r.status !== null && DECISIONS.includes(r.status));

/** Accepted, on the check-in roster, and not sent a pass yet (by the console or the check-in repo's script). */
export const needsPass = (r: Row) => r.status === "accepted" && !!r.code && !r.passSentAt;
