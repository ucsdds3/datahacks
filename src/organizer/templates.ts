import { TYPE_LABEL, fullName, type Decision, type Kind, type Row } from "./types";

export type Template = { subject: string; body: string };

export const PLACEHOLDERS = ["first_name", "last_name", "status", "type", "code"] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];
export type TemplateVars = Partial<Record<Placeholder, string>>;

/** Replaces {{name}} with its value. Unknown or missing names become empty. */
export function fillTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, name: string) => vars[name as Placeholder] ?? "");
}

const STATUS_WORD: Record<string, string> = {
  accepted: "accepted",
  waitlisted: "waitlisted",
  rejected: "not accepted",
  submitted: "under review",
  draft: "in progress",
};

export function varsFor(row: Row): TemplateVars {
  return {
    first_name: row.first_name?.trim() || fullName(row),
    last_name: row.last_name?.trim() ?? "",
    status: STATUS_WORD[row.status ?? "submitted"] ?? row.status ?? "",
    type: TYPE_LABEL[row.applicant_type],
    code: row.code ?? "",
  };
}

const SIGN_OFF = "\n\nSee you soon,\nThe DataHacks team\ninfo@ds3.club";

/** Starting points for the decision emails; organizers edit them before releasing. */
export const DEFAULT_TEMPLATES: Record<`${Decision}:${Kind}`, Template> = {
  "accepted:hacker": {
    subject: "You're in: welcome to DataHacks 2027!",
    body:
      "Hi {{first_name}},\n\nCongratulations! You've been accepted to DataHacks 2027.\n\n" +
      "Your check-in code is {{code}}. Keep it handy: you'll show it at check-in.\n\n" +
      "Sign in to the DataHacks portal to read the hacker handbook, see the run of show and sign the liability waiver." +
      SIGN_OFF,
  },
  "accepted:staff": {
    subject: "Welcome to the DataHacks 2027 team",
    body:
      "Hi {{first_name}},\n\nThank you for applying. We're excited to confirm you as a {{type}} at DataHacks 2027!\n\n" +
      "Your check-in code is {{code}}.\n\n" +
      "Sign in to the DataHacks portal for your handbook, the run of show and the liability waiver." +
      SIGN_OFF,
  },
  "waitlisted:hacker": {
    subject: "Your DataHacks 2027 application: waitlist",
    body:
      "Hi {{first_name}},\n\nThank you for applying to DataHacks 2027. We had far more applicants than spots, " +
      "and you're on our waitlist. We'll email you as soon as a spot opens up." +
      SIGN_OFF,
  },
  "waitlisted:staff": {
    subject: "Your DataHacks 2027 {{type}} application",
    body:
      "Hi {{first_name}},\n\nThank you for offering to be a {{type}} at DataHacks 2027. We've placed you on our waitlist " +
      "and will reach out if we need more help." +
      SIGN_OFF,
  },
  "rejected:hacker": {
    subject: "Your DataHacks 2027 application",
    body:
      "Hi {{first_name}},\n\nThank you for applying to DataHacks 2027. Unfortunately, we aren't able to offer you a spot this year. " +
      "We hope you'll apply again and join us at other DS3 events." +
      SIGN_OFF,
  },
  "rejected:staff": {
    subject: "Your DataHacks 2027 {{type}} application",
    body:
      "Hi {{first_name}},\n\nThank you for offering to be a {{type}} at DataHacks 2027. We aren't able to bring you on this year, " +
      "but we really appreciate it and hope to work with you in the future." +
      SIGN_OFF,
  },
};
