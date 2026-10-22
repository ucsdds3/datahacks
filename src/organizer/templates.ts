import { TYPE_LABEL, fullName, type Decision, type Kind, type Row } from "./types";

export type Template = { subject: string; body: string };

export const PLACEHOLDERS = ["first_name", "last_name", "status", "type", "code", "qr"] as const;
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
    type: TYPE_LABEL[row.applicant_type].toLowerCase(),
    code: row.code ?? "",
    // The email itself gets an image; the preview shows where it goes.
    qr: row.code ? `[QR code for ${row.code}]` : "[no check-in code yet]",
  };
}

const SIGN_OFF = "\n\nThe DataHacks team\nData Science Student Society at UC San Diego\ninfo@ds3.club";
const PORTAL = "https://datahacks.ds3ucsd.com/portal";

/** Starting points for the decision emails; organizers edit them before releasing. */
export const DEFAULT_TEMPLATES: Record<`${Decision}:${Kind}`, Template> = {
  "accepted:hacker": {
    subject: "You're in! Welcome to DataHacks 2027",
    body:
      "Hi {{first_name}},\n\n" +
      "Congratulations, you've been accepted to DataHacks 2027! It runs Saturday and Sunday, January 16–17, at UC San Diego.\n\n" +
      "Your check-in code is {{code}}. Keep it handy: you'll show it when you arrive.\n\n" +
      "Before the event, please sign in to the portal to:\n" +
      "- sign the liability waiver (required to attend)\n" +
      "- read the hacker handbook\n" +
      "- check the run of show\n\n" +
      PORTAL + "\n\n" +
      "Can't make it anymore? Reply to this email so we can offer your spot to someone on the waitlist.\n\n" +
      "We can't wait to see what you build." +
      SIGN_OFF,
  },
  "accepted:staff": {
    subject: "Welcome to the DataHacks 2027 team",
    body:
      "Hi {{first_name}},\n\n" +
      "Thank you for applying. We're excited to confirm you as a {{type}} at DataHacks 2027!\n\n" +
      "Mentors: we need you on Saturday, January 16, from 12:30 to 4:30 PM.\n" +
      "Judges: judging is on Sunday, January 17.\n\n" +
      "Your check-in code is {{code}}.\n\n" +
      "Please sign in to the portal to sign the liability waiver and read your handbook and the run of show:\n" +
      PORTAL + "\n\n" +
      "If your plans change, just reply to this email." +
      SIGN_OFF,
  },
  "waitlisted:hacker": {
    subject: "Your DataHacks 2027 application: you're on the waitlist",
    body:
      "Hi {{first_name}},\n\n" +
      "Thank you for applying to DataHacks 2027. We received far more applications than we have spots, and you're on our waitlist.\n\n" +
      "Spots open up as accepted hackers drop out, and we'll email you right away if one becomes yours. " +
      "You can check your status anytime at " + PORTAL + "." +
      SIGN_OFF,
  },
  "waitlisted:staff": {
    subject: "Your DataHacks 2027 {{type}} application",
    body:
      "Hi {{first_name}},\n\n" +
      "Thank you for offering to be a {{type}} at DataHacks 2027. Our spots are full for now, so we've placed you on our waitlist " +
      "and will reach out if we need more help." +
      SIGN_OFF,
  },
  "rejected:hacker": {
    subject: "Your DataHacks 2027 application",
    body:
      "Hi {{first_name}},\n\n" +
      "Thank you for applying to DataHacks 2027. We received far more applications than we could accept, " +
      "and unfortunately we aren't able to offer you a spot this year.\n\n" +
      "This isn't a judgement of your potential. We'd love to see you at other DS3 events, and we hope you'll apply again next year." +
      SIGN_OFF,
  },
  "rejected:staff": {
    subject: "Your DataHacks 2027 {{type}} application",
    body:
      "Hi {{first_name}},\n\n" +
      "Thank you for offering to be a {{type}} at DataHacks 2027. We aren't able to bring you on this year, " +
      "but we really appreciate it and hope to work with you in the future." +
      SIGN_OFF,
  },
};
