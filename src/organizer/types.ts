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
  /** Who last changed the decision (their email), when, and how many times it has changed. */
  decided_by: string | null;
  decided_at: string | null;
  decision_version: number;
};

/**
 * The review columns: organizers only. Applicants can't read them through the
 * API (column privileges), so they don't come with the row; the console loads
 * them with the staged_decisions function and merges them in.
 */
export const REVIEW_FIELDS = ["decision", "decided_by", "decided_at", "decision_version"] as const satisfies readonly (keyof Application)[];
export type Review = Pick<Application, (typeof REVIEW_FIELDS)[number]>;
export const NO_REVIEW: Review = { decision: null, decided_by: null, decided_at: null, decision_version: 0 };

/**
 * The columns the console's tables load for every application: what the
 * table, search, tab counts, CSV, decisions, emails and passes use. Essays and
 * the rest are fetched one application at a time when an organizer opens it
 * (see useApplication), which keeps a 1,500-applicant load small.
 */
export const LIST_FIELDS = [
  "id", "applicant_type", "status", "submitted_at",
  "first_name", "last_name", "email", "phone", "school", "level_of_study", "organization",
  "decision_released_at", "decision_emailed_at",
] as const satisfies readonly (keyof Application)[];

export type ListApplication = Pick<Application, (typeof LIST_FIELDS)[number]> & Review;

/**
 * One table row: the list columns plus what the check-in roster knows.
 * passSentAt: when the check-in pass was emailed (attendees.emailed_at).
 * waiverSignedAt: when their liability waiver was recorded (attendees.waiver_signed_at,
 * copied from public.waivers). Only accepted people are on the roster, so it's null for the rest.
 */
export type Row = ListApplication & {
  code: string | null; checkedIn: boolean; passSentAt: string | null; waiverSignedAt: string | null;
  /** Hackers' MLH agreements (docs/mlh.md). Missing when they couldn't be read (a database from before MLH). */
  mlh?: MlhConsent;
};

/** A hacker's answers to MLH's checkboxes, with when each was given (null: not given). */
export type MlhConsent = {
  codeOfConductAt: string | null;
  dataSharingAt: string | null;
  emailsOptIn: boolean;
};

/** Agreed to both of MLH's required checkboxes. */
export const mlhAgreed = (r: Pick<Row, "mlh">) => !!r.mlh?.codeOfConductAt && !!r.mlh?.dataSharingAt;

export const kindOf = (type: ApplicantType): Kind => (type === "hacker" ? "hacker" : "staff");

export const tabOf = (status: Status | null): Tab =>
  status === "accepted" || status === "waitlisted" || status === "rejected" ? status : "applied";

/** Started but never submitted: not reviewed, decided, released or emailed. */
export const isDraft = (app: Pick<ListApplication, "status">) => app.status === "draft";

/** A decision is staged when it's been chosen but not released yet. Drafts never are. */
export const isStaged = (app: ListApplication) => app.decision !== null && app.decision !== app.status && !isDraft(app);

/**
 * The tab a row sits in on the console: the decision an organizer picked, as
 * soon as they pick it. Applicants only see it once decisions are released.
 */
export const placeOf = (app: ListApplication): Tab => (isDraft(app) ? "applied" : app.decision ?? tabOf(app.status));

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

export const fullName = (app: Pick<Application, "first_name" | "last_name">) =>
  [app.first_name, app.last_name].filter(Boolean).join(" ").trim() || "(no name)";

const DECISIONS: readonly string[] = ["accepted", "waitlisted", "rejected"];

/** Released, but the decision email never went out (for example, sending wasn't set up yet). */
export const unsentDecisionRows = <T extends ListApplication>(rows: T[]) =>
  rows.filter(r => r.decision_released_at && !r.decision_emailed_at && r.status !== null && DECISIONS.includes(r.status));

/**
 * Released as accepted and on the check-in roster, but the organizer has since
 * picked a different decision that isn't released yet. They're about to stop
 * being accepted, so the console doesn't offer them a pass.
 */
export const passOnHold = (r: Row) => r.status === "accepted" && !!r.code && isStaged(r) && r.decision !== "accepted";

/** Picked to accept but not released yet, so not on the check-in roster and no code to put on a pass. */
export const acceptedNotReleased = (r: Row) => isStaged(r) && r.decision === "accepted" && !r.code;

/** Accepted (released), on the check-in roster, and not about to be un-accepted, so a pass can be made for them. */
export const canGetPass = (r: Row) => r.status === "accepted" && !!r.code && !passOnHold(r);

/** Accepted, on the check-in roster, and not sent a pass yet (by the console or the check-in repo's script). */
export const needsPass = (r: Row) => canGetPass(r) && !r.passSentAt;

/**
 * Who a wallet pass send would email (rows passed in), split by what it does
 * for them. With ids, only those rows are considered.
 *   due          get their first pass
 *   alreadySent  only get one again if the organizer asks
 *   onHold       released as accepted, but a different decision is picked and not released yet
 *   notReleased  picked to accept, not released yet, so no code
 *   noCode       everyone else without a code (not accepted)
 * Without ids, onHold only counts people who'd otherwise get a first pass.
 */
export function passTargets(rows: Row[], ids?: Iterable<string>) {
  const chosen = ids ? new Set(ids) : null;
  const picked = chosen ? rows.filter(r => chosen.has(r.id)) : rows;
  return {
    due: picked.filter(needsPass),
    alreadySent: chosen ? picked.filter(r => canGetPass(r) && !!r.passSentAt) : [],
    onHold: picked.filter(r => passOnHold(r) && (chosen !== null || !r.passSentAt)),
    notReleased: picked.filter(acceptedNotReleased),
    noCode: chosen ? picked.filter(r => !canGetPass(r) && !passOnHold(r) && !acceptedNotReleased(r)) : [],
  };
}

/** The order the Passes page lists roles in, and what it calls each. */
export const PASS_ROLES: readonly ApplicantType[] = ["hacker", "mentor", "judge", "hybrid"];

export const ROLE_PLURAL: Record<ApplicantType, string> = {
  hacker: "Hackers",
  mentor: "Mentors",
  judge: "Judges",
  hybrid: "Mentors & judges",
};

/** For "Send 3 mentor passes". */
export const ROLE_NOUN: Record<ApplicantType, string> = {
  hacker: "hacker",
  mentor: "mentor",
  judge: "judge",
  hybrid: "mentor & judge",
};

/** Accepted without a pass yet: released (with a code), or picked to accept and waiting on a release. */
export const passDue = (r: Row) => needsPass(r) || acceptedNotReleased(r);

/**
 * The Passes page's two tabs.
 *   toSend  everyone accepted without a pass: released with a code, or picked
 *           to accept and not released yet (no code until release, so sending
 *           to them releases decisions first)
 *   sent    has a pass (attendees.emailed_at) and is still accepted
 * Anyone picked for reject or waitlist is in neither, even if they were
 * released as accepted earlier.
 */
export function passLists(rows: Row[]) {
  return {
    toSend: rows.filter(passDue),
    sent: rows.filter(r => canGetPass(r) && !!r.passSentAt),
  };
}
