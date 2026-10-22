import type { Tab } from "./types";

export type Audience = "hacker" | "staff" | "all";

/**
 * Ready-made emails for the run-up to the event. Anything in [[double brackets]]
 * is for an organizer to fill in; the console won't send while any are left.
 * {{qr}} becomes the person's check-in QR code (an image in the email).
 */
export type Blast = {
  id: string;
  label: string;
  /** When to send it, shown next to the picker. */
  when: string;
  audience: Audience;
  status: Tab | "any";
  subject: string;
  body: string;
};

const SIGN_OFF = "\n\nSee you soon,\nThe DataHacks team\ninfo@ds3.club";

export const BLASTS: Blast[] = [
  {
    id: "sponsors",
    label: "Sponsors & challenges",
    when: "About a week before (Saturday, January 9)",
    audience: "hacker",
    status: "accepted",
    subject: "One week to DataHacks: meet our sponsors and their challenges",
    body:
      "Hi {{first_name}},\n\n" +
      "DataHacks is one week away! Here are the sponsors making it happen, and the challenges they're bringing.\n\n" +
      "Sponsors\n" +
      "- [[Sponsor 1]]\n" +
      "- [[Sponsor 2]]\n" +
      "- [[Sponsor 3]]\n\n" +
      "Sponsor challenges\n" +
      "- [[Sponsor 1]]: [[challenge, prize]]\n" +
      "- [[Sponsor 2]]: [[challenge, prize]]\n" +
      "- [[Sponsor 3]]: [[challenge, prize]]\n\n" +
      "You can enter a sponsor challenge on top of your main track. Details are in the hacker handbook on the portal: " +
      "https://datahacks.ds3ucsd.com/portal\n\n" +
      "Still need a team? Come to team matching right after the opening ceremony." +
      SIGN_OFF,
  },
  {
    id: "directions",
    label: "Getting to DataHacks",
    when: "4–5 days before (Monday, January 11 or Tuesday, January 12)",
    audience: "all",
    status: "accepted",
    subject: "How to get to DataHacks this weekend",
    body:
      "Hi {{first_name}},\n\n" +
      "DataHacks is this weekend at the Price Center Ballrooms, UC San Diego. Check-in opens [[12:00 PM]] on Saturday, January 16. " +
      "Here's how to get there.\n\n" +
      "If you're a UC San Diego student\n" +
      "Price Center is in the middle of campus, next to Library Walk. Walk or bike over, or take the campus shuttle.\n\n" +
      "If you're coming from elsewhere in San Diego\n" +
      "- Trolley: the MTS UC San Diego Blue Line runs from downtown and Old Town. Get off at UC San Diego Central Campus, a short walk from Price Center.\n" +
      "- Driving: park at [[parking structure]]. Weekend parking is [[price / free after a set time]].\n\n" +
      "If you're coming from outside San Diego\n" +
      "- Train: take Amtrak's Pacific Surfliner or the COASTER to Old Town Transit Center, then the Blue Line trolley north to UC San Diego Central Campus.\n" +
      "- Driving: allow extra time for weekend traffic on I-5, and park at [[parking structure]].\n\n" +
      "If you're flying in\n" +
      "Fly into San Diego International Airport (SAN). Campus is about 25 minutes away by rideshare. " +
      "By transit, take a bus or rideshare to Old Town or downtown, then the Blue Line trolley to UC San Diego Central Campus.\n" +
      "[[Travel stipend recipients: how to submit receipts.]]\n\n" +
      "Bring your student ID, a laptop and charger, and your check-in QR code (we'll send it separately). " +
      "If you haven't signed the liability waiver yet, please do it on the portal before you come: https://datahacks.ds3ucsd.com/portal" +
      SIGN_OFF,
  },
  {
    id: "qr",
    label: "Check-in QR code",
    when: "2–3 days before (Wednesday, January 13 or Thursday, January 14)",
    audience: "all",
    status: "accepted",
    subject: "Your DataHacks check-in QR code",
    body:
      "Hi {{first_name}},\n\n" +
      "Here's your check-in QR code for DataHacks. Show it at the check-in desk at the Price Center Ballrooms.\n\n" +
      "{{qr}}\n\n" +
      "Your check-in code is {{code}}, in case the QR code won't scan.\n\n" +
      "Hackers: check-in opens Saturday, January 16 at [[12:00 PM]].\n" +
      "Mentors: please arrive by [[12:15 PM]] on Saturday, January 16. Office hours run 12:30–4:30 PM.\n" +
      "Judges: please arrive by [[12:15 PM]] on Sunday, January 17.\n\n" +
      "Make sure you've signed the liability waiver on the portal before you arrive: https://datahacks.ds3ucsd.com/portal" +
      SIGN_OFF,
  },
];

/** True while an organizer still has [[blanks]] to fill in. */
export const hasBlanks = (...texts: string[]) => texts.some(t => /\[\[[^\]]*\]\]/.test(t));
