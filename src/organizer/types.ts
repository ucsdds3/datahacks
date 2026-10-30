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

/**
 * The columns the console's tables load for every application: what the
 * table, search, tab counts, CSV, decisions, emails and passes use. Essays and
 * the rest are fetched one application at a time when an organizer opens it
 * (see useApplication), which keeps a 1,500-applicant load small.
 */
export const LIST_FIELDS = [
  "id", "applicant_type", "status", "submitted_at",
  "first_name", "last_name", "email", "phone", "school", "level_of_study", "organization",
  "decision", "decision_released_at", "decision_emailed_at",
] as const satisfies readonly (keyof Application)[];

export type ListApplication = Pick<Application, (typeof LIST_FIELDS)[number]>;

/**
 * One table row: the list columns plus what the check-in roster knows.
 * passSentAt: when the check-in pass was emailed (attendees.emailed_at).
 */
export type Row = ListApplication & { code: string | null; checkedIn: boolean; passSentAt: string | null };

export const kindOf = (type: ApplicantType): Kind => (type === "hacker" ? "hacker" : "staff");

export const tabOf = (status: Status | null): Tab =>
  status === "accepted" || status === "waitlisted" || status === "rejected" ? status : "applied";

/** A decision is staged when it's been chosen but not released yet. */
export const isStaged = (app: ListApplication) => app.decision !== null && app.decision !== app.status;

/**
 * The tab a row sits in on the console: the decision an organizer picked, as
 * soon as they pick it. Applicants only see it once decisions are released.
 */
export const placeOf = (app: ListApplication): Tab => app.decision ?? tabOf(app.status);

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
 * Who "Send wallet passes" would email (rows passed in), split by what it does
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

/** The order the wallet pass dialog lists roles in, and what it calls each. */
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

export type PassGroup<T> = { type: ApplicantType; label: string; send: T[]; notReleased: T[] };

/**
 * Splits who'd get a pass (send) and who's waiting on a release (notReleased)
 * by role, in PASS_ROLES order, leaving out roles with nobody in either.
 */
export function passGroups<T extends Pick<Row, "applicant_type">>(send: T[], notReleased: T[] = []): PassGroup<T>[] {
  return PASS_ROLES
    .map(type => ({
      type,
      label: ROLE_PLURAL[type],
      send: send.filter(r => r.applicant_type === type),
      notReleased: notReleased.filter(r => r.applicant_type === type),
    }))
    .filter(g => g.send.length > 0 || g.notReleased.length > 0);
}

/** "Ana, Ben and 3 more": the first few names in a list. */
export function someNames(rows: Pick<Application, "first_name" | "last_name">[], show = 5) {
  const names = rows.slice(0, show).map(fullName);
  const rest = rows.length - names.length;
  if (rest > 0) return `${names.join(", ")} and ${rest} more`;
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
