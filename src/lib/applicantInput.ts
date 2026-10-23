// What an applicant may type, and how what they typed is shown back. The
// database enforces the same rules (supabase/migrations/*_application_checks.sql)
// for anyone who skips the website; these keep a person from hitting them.
// See docs/untrusted-input.md.

/**
 * Longest answer each kind of field accepts in the forms. Each is below the
 * database's cap for that column (in brackets), so the form always stops first.
 */
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

/**
 * Mirrors the database's link rule: https only, a plain host (no user@ part),
 * no whitespace, quotes, angle brackets, backslashes or control characters.
 */
// eslint-disable-next-line no-control-regex
const HTTPS_LINK = /^https:\/\/[a-z0-9.-]+(:[0-9]+)?([/?#][^\s"<>\\\x00-\x1f\x7f]*)?$/i;
export const isHttpsLink = (value: string) => value.length <= 500 && HTTPS_LINK.test(value);

// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x1f\x7f]/g;
// eslint-disable-next-line no-control-regex
const CONTROL_EXCEPT_LINE_BREAKS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

/** A one-line answer as saved: pasted tabs or line breaks become spaces, ends trimmed. */
export const cleanLine = (value: string) => value.replace(CONTROL, " ").trim();

/** A long answer as saved: keeps line breaks and tabs, drops other control characters, ends trimmed. */
export const cleanText = (value: string) => value.replace(CONTROL_EXCEPT_LINE_BREAKS, "").trim();

/**
 * An applicant-supplied link, safe to put in an href: http(s) only, so a
 * javascript: or data: "link" is shown as text instead of becoming clickable.
 */
export function safeHref(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** mailto: for a plain address only, so "a@b.com?cc=..." can't prefill anything. */
export const safeMailto = (email: string | null | undefined) =>
  email && isValidEmail(email) ? `mailto:${email}` : null;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The birthdate input's range: 1900-01-01 to 18 years before today (DataHacks is 18+), which the
 * database checks too. Feb 29 counts back to Feb 28, as Postgres does.
 */
export function birthdateBounds(today = new Date()) {
  const year = today.getFullYear() - 18;
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(today.getDate(), lastDay);
  return { min: "1900-01-01", max: `${year}-${pad(month + 1)}-${pad(day)}` };
}

const FIELD_LABEL: Record<string, string> = {
  first_name: "first name", last_name: "last name", email: "email", phone: "phone number",
  country_of_residence: "country", city_of_residence: "city", school: "school", major: "major",
  organization: "company or lab", role_title: "role", travel_region: "travel origin",
  linkedin_url: "LinkedIn link", github_url: "GitHub link", devpost_url: "Devpost link", resume_url: "resume link",
  essay_proudest_project: "proudest project", essay_unique_thing: "something unique", essay_goal: "event goal",
  bio: "blurb", travel_stipend_reason: "travel note", funniest_joke: "funniest joke", lifetime_goal: "lifetime goal",
  gender: "gender", race_ethnicity: "race/ethnicity", level_of_study: "level of study",
  graduation_year: "graduation year", hackathon_experience: "hackathon experience", travel_method: "travel method",
  travel_distance: "travel distance", heard_about: "how you heard about us", birthdate: "birthdate",
};

/** What to tell an applicant when saving their application fails. */
export function applicationErrorMessage(error: { code?: string; message: string }): string {
  // 23505 = unique violation: one application per account per event
  if (error.code === "23505") return "You've already applied. Your status is on the portal's Status page.";
  if (error.code === "23514") {
    const field = error.message.match(/application_([a-z_]+)_check/)?.[1];
    const label = field && FIELD_LABEL[field];
    if (label) return `We couldn't save your ${label}: it may be too long or in a format we can't accept. Check it and try again.`;
    return "Some answers are missing or in a format we can't accept. Check the form and try again.";
  }
  return error.message;
}
