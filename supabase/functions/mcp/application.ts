// The application forms' questions and checks, for the MCP server. The same
// answers the portal's forms accept (src/staff-portal/HackerApplication.tsx and
// StaffApplication.tsx), cleaned the same way and turned into the row those
// forms insert. The database enforces the same rules again
// (supabase/migrations/*_application_checks.sql); these let the assistant fix
// everything with the applicant before it gets that far.
//
// An edge function can't import the portal's files, so the rules below are
// copies of src/lib/applicantInput.ts and the option lists copies of
// src/staff-portal/formOptions.ts. No imports except ./countries.ts, so vitest
// loads this file too: src/portal/mcpApplication.test.ts fails when a copy
// drifts from the original (or from the database's constraints).

import { COUNTRIES } from "./countries.ts";

export { COUNTRIES };

/** The event applications go to. Must match EVENT_CODE in src/portal/event.ts. */
export const EVENT_CODE = "DH27BETA";

// ---------------------------------------------------------------------------
// Copied from src/lib/applicantInput.ts (see docs/untrusted-input.md).
/* eslint-disable no-control-regex -- matching control characters is the point */

/** Longest answer each kind of field accepts in the forms; each is below the database's cap. */
export const MAX_LENGTH = {
  name: 80, // first_name, last_name [100]
  short: 150, // city, school, major, organization, role, travel region [200]
  link: 400, // every *_url [500]
  essay: 3000, // essays, travel note [4000]
  bio: 1500, // mentor blurb [4000]
  brief: 500, // funniest joke, lifetime goal [1000]
} as const;

/** Mirrors application_email_check: one plain address, nothing that could add recipients or headers. */
const EMAIL = /^[A-Za-z0-9._+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
export const isValidEmail = (value: string) => value.length <= 254 && EMAIL.test(value);

/** Mirrors the database's link rule: https only, a plain host, no whitespace, quotes, <>, \ or control characters. */
// deno-lint-ignore no-control-regex
const HTTPS_LINK = /^https:\/\/[a-z0-9.-]+(:[0-9]+)?([/?#][^\s"<>\\\x00-\x1f\x7f]*)?$/i;
export const isHttpsLink = (value: string) => value.length <= 500 && HTTPS_LINK.test(value);

// deno-lint-ignore no-control-regex
const CONTROL = /[\x00-\x1f\x7f]/g;
// deno-lint-ignore no-control-regex
const CONTROL_EXCEPT_LINE_BREAKS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

/** A one-line answer as saved: pasted tabs or line breaks become spaces, ends trimmed. */
export const cleanLine = (value: string) => value.replace(CONTROL, " ").trim();

/** A long answer as saved: keeps line breaks and tabs, drops other control characters, ends trimmed. */
export const cleanText = (value: string) => value.replace(CONTROL_EXCEPT_LINE_BREAKS, "").trim();
/* eslint-enable no-control-regex */

const pad = (n: number) => String(n).padStart(2, "0");

/** 1900-01-01 to 18 years before today (DataHacks is 18+), as the database checks. Feb 29 counts back to Feb 28. */
export function birthdateBounds(today = new Date()) {
  const year = today.getFullYear() - 18;
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(today.getDate(), lastDay);
  return { min: "1900-01-01", max: `${year}-${pad(month + 1)}-${pad(day)}` };
}

// ---------------------------------------------------------------------------
// Copied from src/staff-portal/formOptions.ts. The database accepts only these
// exact values (application_*_check).

export const GENDERS = ["Woman", "Man", "Non-binary", "Prefer to self-describe", "Prefer not to say"] as const;

export const RACES = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Hispanic or Latino",
  "Middle Eastern or North African",
  "Native Hawaiian or Other Pacific Islander",
  "White",
  "Other",
  "Prefer not to say",
] as const;

export const LEVELS_OF_STUDY = [
  "High school",
  "Undergraduate (2-year: community college, associate's)",
  "Undergraduate (3+ year: bachelor's)",
  "Graduate (master's, doctoral)",
  "Post-doctorate",
  "Code school or bootcamp",
  "Other vocational or trade program",
  "Not currently a student",
  "Other",
] as const;

export const graduationYears = (now = new Date()) => {
  const year = now.getFullYear();
  return [...Array.from({ length: 8 }, (_, i) => String(year + i)), "Already graduated", "Not applicable"];
};

export const HACKATHON_EXPERIENCE = ["This will be my first", "1–2 hackathons", "3–5 hackathons", "6 or more"] as const;

export const HEARD_ABOUT = [
  "DS3 club or event",
  "Email newsletter",
  "Friend or word of mouth",
  "Instagram",
  "LinkedIn",
  "Major League Hacking (MLH)",
  "Past DataHacks",
  "Professor or class",
  "Tabling on campus",
  "Other",
] as const;

export const TRAVEL_METHODS = ["Car", "Bus", "Train", "Plane", "Other"] as const;

export const TRAVEL_DISTANCES = ["Under 50 miles", "50–200 miles", "200–500 miles", "Over 500 miles", "From outside the US"] as const;

// The mentor/judge form's choices (StaffApplication.tsx), which the baseline's
// applications_*_check constraints restrict.
export const STAFF_TYPES = ["mentor", "judge", "hybrid"] as const;

export const UCSD_AFFILIATIONS = ["student", "alumni", "faculty", "none"] as const;

export const JUDGING_TRACKS = [
  "social_good_wellbeing",
  "healthcare_health_tech",
  "defense_cybersecurity",
  "fintech_econ_finance",
  "entertainment",
] as const;

/** The mentor blurb is optional; when given it needs some substance (applications_staff_fields_check). */
export const BIO_MIN_LENGTH = 50;

// ---------------------------------------------------------------------------

/** 10 digits as (858) 370-2478, dropping a leading country code 1, like the portal's phone field. Null if it isn't 10 digits. */
export function toPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  const d = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : null;
}

/** A real calendar date written YYYY-MM-DD. */
const isDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const oneOf = (list: readonly string[], value: string | undefined) => value !== undefined && list.includes(value);

/** A link as the forms save it: trimmed, and https:// within the form's length. */
const link = (value: string | undefined) => {
  const v = (value ?? "").trim();
  return { value: v, ok: v.length <= MAX_LENGTH.link && isHttpsLink(v) };
};

export type HackerAnswers = {
  first_name: string;
  last_name: string;
  phone: string;
  gender: string;
  race_ethnicity: string[];
  birthdate: string;
  country_of_residence: string;
  city_of_residence: string;
  level_of_study: string;
  school: string;
  major: string;
  graduation_year: string;
  hackathon_experience: string;
  attended_before: boolean;
  linkedin_url: string;
  github_url: string;
  devpost_url?: string;
  resume_url: string;
  essay_proudest_project: string;
  essay_unique_thing: string;
  essay_goal: string;
  funniest_joke?: string;
  lifetime_goal?: string;
  heard_about: string[];
  wants_travel_stipend: boolean;
  travel_region?: string;
  travel_method?: string;
  travel_distance?: string;
  travel_stipend_reason?: string;
  agreed_to_terms: boolean;
};

export type StaffAnswers = {
  first_name: string;
  last_name: string;
  phone: string;
  organization: string;
  role_title: string;
  linkedin_url: string;
  ucsd_affiliation: string;
  applicant_type: string;
  judging_track?: string;
  bio?: string;
  acknowledged_in_person_judging?: boolean;
  acknowledged_onsite_mentoring?: boolean;
  acknowledged_both_priority: boolean;
};

export type Checked = { row: Record<string, unknown> } | { problems: string[] };

/** Cleans each text answer the way the form saves it, and notes any that are missing or too long. */
function texts<K extends string>(
  answers: object,
  fields: Record<K, { clean: (v: string) => string; max: number; required: boolean }>,
  problems: string[],
) {
  const out = {} as Record<K, string>;
  for (const key of Object.keys(fields) as K[]) {
    const { clean, max, required } = fields[key];
    const given = (answers as Record<string, unknown>)[key];
    const value = clean(typeof given === "string" ? given : "");
    if (required && !value) problems.push(`${key} is required.`);
    else if (value.length > max) problems.push(`${key} is too long: at most ${max} characters (it has ${value.length}).`);
    out[key] = value;
  }
  return out;
}

const line = (max: number, required = true) => ({ clean: cleanLine, max, required });
const prose = (max: number, required = true) => ({ clean: cleanText, max, required });

/** The hacker form's checks. Every problem at once, so the assistant can ask about them together. */
export function checkHacker(a: HackerAnswers, now = new Date()): Checked {
  const problems: string[] = [];
  const travel = a.wants_travel_stipend === true;
  const t = texts(a, {
    first_name: line(MAX_LENGTH.name),
    last_name: line(MAX_LENGTH.name),
    city_of_residence: line(MAX_LENGTH.short),
    school: line(MAX_LENGTH.short),
    major: line(MAX_LENGTH.short),
    essay_proudest_project: prose(MAX_LENGTH.essay),
    essay_unique_thing: prose(MAX_LENGTH.essay),
    essay_goal: prose(MAX_LENGTH.essay),
    funniest_joke: prose(MAX_LENGTH.brief, false),
    lifetime_goal: prose(MAX_LENGTH.brief, false),
    travel_region: line(MAX_LENGTH.short, travel),
    travel_stipend_reason: prose(MAX_LENGTH.essay, false),
  }, problems);

  const phone = toPhone(a.phone ?? "");
  if (!phone) problems.push("phone must be a 10-digit US number.");
  if (!oneOf(GENDERS, a.gender)) problems.push(`gender must be one of: ${GENDERS.join(", ")}.`);
  const races = [...new Set(a.race_ethnicity ?? [])];
  if (races.length === 0 || !races.every(r => oneOf(RACES, r))) {
    problems.push(`race_ethnicity needs at least one of, and only: ${RACES.join(", ")}.`);
  }
  const { min, max } = birthdateBounds(now);
  if (!isDate(a.birthdate ?? "")) problems.push("birthdate must be a real date written YYYY-MM-DD.");
  else if (a.birthdate < min || a.birthdate > max) problems.push(`birthdate: DataHacks is for people 18 and over (born on or before ${max}).`);
  const country = cleanLine(a.country_of_residence ?? "");
  if (!oneOf(COUNTRIES, country)) {
    problems.push("country_of_residence must be the country's English name as the form lists it, e.g. United States, United Kingdom, South Korea, Türkiye.");
  }
  if (!oneOf(LEVELS_OF_STUDY, a.level_of_study)) problems.push(`level_of_study must be one of: ${LEVELS_OF_STUDY.join(", ")}.`);
  if (!oneOf(graduationYears(now), a.graduation_year)) problems.push(`graduation_year must be one of: ${graduationYears(now).join(", ")}.`);
  if (!oneOf(HACKATHON_EXPERIENCE, a.hackathon_experience)) {
    problems.push(`hackathon_experience must be one of: ${HACKATHON_EXPERIENCE.join(", ")}.`);
  }
  const linkedin = link(a.linkedin_url);
  const github = link(a.github_url);
  const devpost = link(a.devpost_url);
  const resume = link(a.resume_url);
  if (!linkedin.ok) problems.push("linkedin_url must be a link to their LinkedIn profile starting with https://.");
  if (!github.ok) problems.push("github_url must be a link to their GitHub profile starting with https://.");
  if (devpost.value && !devpost.ok) problems.push("devpost_url is optional, but when given it must start with https://.");
  if (!resume.ok) problems.push("resume_url must be a link to their resume that organizers can open, starting with https://.");
  const heard = [...new Set(a.heard_about ?? [])];
  if (heard.length === 0 || !heard.every(h => oneOf(HEARD_ABOUT, h))) {
    problems.push(`heard_about needs at least one of, and only: ${HEARD_ABOUT.join(", ")}.`);
  }
  if (travel) {
    if (!oneOf(TRAVEL_METHODS, a.travel_method)) problems.push(`travel_method must be one of: ${TRAVEL_METHODS.join(", ")}.`);
    if (!oneOf(TRAVEL_DISTANCES, a.travel_distance)) problems.push(`travel_distance must be one of: ${TRAVEL_DISTANCES.join(", ")}.`);
  }
  if (a.agreed_to_terms !== true) problems.push("agreed_to_terms: they must agree that the info is correct and to follow the code of conduct.");
  if (problems.length) return { problems };

  return {
    row: {
      applicant_type: "hacker",
      first_name: t.first_name,
      last_name: t.last_name,
      phone,
      gender: a.gender,
      race_ethnicity: races.join("; "),
      birthdate: a.birthdate,
      country_of_residence: country,
      city_of_residence: t.city_of_residence,
      level_of_study: a.level_of_study,
      school: t.school,
      major: t.major,
      graduation_year: a.graduation_year,
      hackathon_experience: a.hackathon_experience,
      attended_before: a.attended_before === true,
      linkedin_url: linkedin.value,
      github_url: github.value,
      devpost_url: devpost.value || null,
      resume_url: resume.value,
      essay_proudest_project: t.essay_proudest_project,
      essay_unique_thing: t.essay_unique_thing,
      essay_goal: t.essay_goal,
      funniest_joke: t.funniest_joke,
      lifetime_goal: t.lifetime_goal,
      heard_about: heard,
      wants_travel_stipend: travel,
      travel_region: travel ? t.travel_region : null,
      travel_method: travel ? a.travel_method : null,
      travel_distance: travel ? a.travel_distance : null,
      travel_stipend_reason: travel ? t.travel_stipend_reason || null : null,
      agreed_to_terms: true,
    },
  };
}

/** The mentor/judge form's checks. */
export function checkStaff(a: StaffAnswers): Checked {
  const problems: string[] = [];
  const judging = a.applicant_type === "judge" || a.applicant_type === "hybrid";
  const mentoring = a.applicant_type === "mentor" || a.applicant_type === "hybrid";
  const t = texts(a, {
    first_name: line(MAX_LENGTH.name),
    last_name: line(MAX_LENGTH.name),
    organization: line(MAX_LENGTH.short),
    role_title: line(MAX_LENGTH.short),
    bio: prose(MAX_LENGTH.bio, false),
  }, problems);
  const phone = toPhone(a.phone ?? "");
  if (!phone) problems.push("phone must be a 10-digit US number.");
  const linkedin = link(a.linkedin_url);
  if (!linkedin.ok) problems.push("linkedin_url must be a link to their LinkedIn profile starting with https://.");
  if (!oneOf(UCSD_AFFILIATIONS, a.ucsd_affiliation)) problems.push(`ucsd_affiliation must be one of: ${UCSD_AFFILIATIONS.join(", ")}.`);
  if (!oneOf(STAFF_TYPES, a.applicant_type)) problems.push(`applicant_type must be one of: ${STAFF_TYPES.join(", ")}.`);
  if (judging && !oneOf(JUDGING_TRACKS, a.judging_track)) {
    problems.push(`judging_track is required for judges, one of: ${JUDGING_TRACKS.join(", ")}.`);
  }
  const bio = t.bio;
  if (mentoring && bio.length > 0 && bio.length < BIO_MIN_LENGTH) {
    problems.push(`bio is optional, but when given it needs at least ${BIO_MIN_LENGTH} characters (it has ${bio.length}).`);
  }
  if (judging && a.acknowledged_in_person_judging !== true) {
    problems.push("acknowledged_in_person_judging: judges must confirm they'll judge in person (online judging isn't allowed).");
  }
  if (mentoring && a.acknowledged_onsite_mentoring !== true) {
    problems.push("acknowledged_onsite_mentoring: mentors must confirm they'll be onsite 12:30–3:30 PM on Saturday, January 16th (check-in from 11:30 AM).");
  }
  if (a.acknowledged_both_priority !== true) {
    problems.push("acknowledged_both_priority: they must confirm they understand people who both mentor and judge get priority.");
  }
  if (problems.length) return { problems };

  return {
    row: {
      applicant_type: a.applicant_type,
      first_name: t.first_name,
      last_name: t.last_name,
      phone,
      organization: t.organization,
      role_title: t.role_title,
      linkedin_url: linkedin.value,
      ucsd_affiliation: a.ucsd_affiliation,
      judging_track: judging ? a.judging_track : null,
      bio: mentoring && bio.length > 0 ? bio : null,
      acknowledged_in_person_judging: judging,
      acknowledged_onsite_mentoring: mentoring,
      acknowledged_both_priority: true,
    },
  };
}

// ---------------------------------------------------------------------------
// The event's "applications open" switch (events.applications_open). The
// database refuses an applicant's insert while it's off
// (applications_require_open_event); these say so before it gets that far.

export type EventWindow = { name: string; applications_open: boolean | null; applications_open_at: string | null };

/** Null while applications are open, otherwise what to tell the person, in the trigger's words. */
export function closedMessage(event: EventWindow, now = new Date()): string | null {
  if (event.applications_open === true) return null;
  const opensAt = event.applications_open_at ? new Date(event.applications_open_at) : null;
  if (opensAt && !Number.isNaN(opensAt.getTime()) && opensAt > now) {
    const date = opensAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
    return `Applications for ${event.name} aren't open yet. They open on ${date}.`;
  }
  return `Applications for ${event.name} aren't open right now.`;
}

/** What to tell the assistant when the database refuses the insert. */
export function insertErrorMessage(error: { code?: string; message: string }): string {
  // 23505 = unique violation: one application per account per event (and one per staff email per event).
  if (error.code === "23505") return "Not submitted: there's already an application for this account or email in this event.";
  if (error.code === "23514") {
    // The applications-open trigger raises a check violation with a message meant for people.
    if (error.message.startsWith("Applications for ")) return `Not submitted: ${error.message}`;
    const field = error.message.match(/application_([a-z_]+)_check/)?.[1];
    if (field) return `Not submitted: the database refused ${field} (too long, or in a format it can't accept). Check it with the applicant and try again.`;
    return "Not submitted: some answers are missing or in a format the database can't accept. Check them with the applicant and try again.";
  }
  return `Not submitted: ${error.message}`;
}
