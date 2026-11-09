import { TIMELINE } from "@/staff-portal/config";
import { TAB_LABEL, tabOf, type Row } from "./types";

/**
 * The "MLH export" CSV (docs/mlh.md): the registration data MLH asks Member
 * Events to share, in MLH's format, for hackers who agreed to share it
 * (applications.mlh_data_sharing). MLH's required fields (2027 Member Event
 * Guidelines): first name, last name, age, email, school, phone number,
 * country of residence, level of study, and the three checkboxes. MLH also
 * asks for check-in data: the same rows with whether they attended.
 */

/** What the export reads for each hacker, beyond the console's list columns. */
export type MlhExportApp = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  school: string | null;
  level_of_study: string | null;
  country_of_residence: string | null;
  birthdate: string | null;
  mlh_code_of_conduct_at: string | null;
  mlh_data_sharing_at: string | null;
  mlh_emails_opt_in: boolean | null;
};

export const MLH_EXPORT_COLUMNS =
  "id, first_name, last_name, email, phone, school, level_of_study, country_of_residence, birthdate, mlh_code_of_conduct_at, mlh_data_sharing_at, mlh_emails_opt_in";

/**
 * Our level-of-study options (formOptions.ts) in MLH's wording, from the MLH
 * Organizer Guide's "Important Registration Fields". Anything else is passed
 * through as it is.
 */
export const MLH_LEVEL_OF_STUDY: Record<string, string> = {
  "High school": "Secondary / High School",
  "Undergraduate (2-year: community college, associate's)": "Undergraduate University (2 year - community college or similar)",
  "Undergraduate (3+ year: bachelor's)": "Undergraduate University (3+ year)",
  "Graduate (master's, doctoral)": "Graduate University (Masters, Professional, Doctoral, etc)",
  "Post-doctorate": "Post Doctorate",
  "Code school or bootcamp": "Code School / Bootcamp",
  "Other vocational or trade program": "Other Vocational / Trade Program or Apprenticeship",
  "Not currently a student": "I’m not currently a student",
  "Other": "Other",
};

/** The calendar date in San Diego on `when`, as [year, month, day]. */
function pacificDate(when: Date): [number, number, number] {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(when);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return [get("year"), get("month"), get("day")];
}

/** Age in whole years on `on` (Pacific date), from a YYYY-MM-DD birthdate. Null if there's no usable birthdate. */
export function ageOn(birthdate: string | null, on: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate ?? "");
  if (!m) return null;
  const [by, bm, bd] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [y, mo, d] = pacificDate(on);
  const age = y - by - (mo < bm || (mo === bm && d < bd) ? 1 : 0);
  return age >= 0 && age < 130 ? age : null;
}

export const MLH_EXPORT_HEADER = [
  "First Name", "Last Name", "Email", "Phone Number", "Age", "School", "Level of Study", "Country of Residence",
  "MLH Code of Conduct (agreed at)", "MLH Privacy Policy and Contest Terms (agreed at)", "MLH Emails Opt-In",
  "Status", "Checked In",
];

/**
 * The export's rows (header first): each application in `rows`, in that
 * order, that agreed to share its data with MLH. `apps` are the export
 * columns for the event's hackers; ages are on the first day of the event.
 */
export function mlhExportRows(apps: MlhExportApp[], rows: Row[], on: Date = TIMELINE.eventStart): unknown[][] {
  const byId = new Map(apps.map(a => [a.id, a]));
  const out: unknown[][] = [MLH_EXPORT_HEADER];
  for (const row of rows) {
    const a = byId.get(row.id);
    if (row.status === "draft" || !a?.mlh_data_sharing_at || !a.mlh_code_of_conduct_at) continue;
    out.push([
      a.first_name ?? "", a.last_name ?? "", a.email ?? "", a.phone ?? "",
      ageOn(a.birthdate, on) ?? "",
      a.school ?? "",
      a.level_of_study ? MLH_LEVEL_OF_STUDY[a.level_of_study] ?? a.level_of_study : "",
      a.country_of_residence ?? "",
      a.mlh_code_of_conduct_at, a.mlh_data_sharing_at, a.mlh_emails_opt_in ? "Yes" : "No",
      TAB_LABEL[tabOf(row.status)], row.checkedIn ? "Yes" : "No",
    ]);
  }
  return out;
}
