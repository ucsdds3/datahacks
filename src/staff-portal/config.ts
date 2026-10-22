// Portal content that isn't stored in Supabase (schedule, contacts, DocuSign setup).
// Swap the values here; no component needs to change.

/**
 * DocuSign embedded signing for the liability waiver. The waiver file itself lives in
 * DocuSign as a template; the server side is supabase/functions/docusign-waiver (setup
 * steps are at the top of that file). Paste the app's integration key here once it
 * exists. While it's empty the waiver page says the document isn't ready yet.
 */
export const DOCUSIGN: { clientId: string; environment: "demo" | "production" } = {
  clientId: "",
  environment: "demo",
};

/**
 * Document the simulated DocuSign shows in `npm run dev` with `?preview`. Drop a PDF at
 * public/dev/waiver-test.pdf to try it; public/dev/ is git-ignored, so it stays on your machine.
 */
export const PREVIEW_WAIVER_PDF = "/dev/waiver-test.pdf";

export type ApplicationStatus ="pending" | "accepted" | "rejected";
/** Which portal someone gets: their application's applicant_type. Hybrids get everything mentors and judges get. */
export type PortalRole = "mentor" | "judge" | "hybrid";

export const HANDBOOK_TITLE: Record<PortalRole, string> = {
  mentor: "Mentor Handbook",
  judge: "Judge Handbook",
  hybrid: "Mentor & Judge Handbook",
};

export const hasMentorAccess =(portal: PortalRole) => portal === "mentor" || portal === "hybrid";
export const hasJudgeAccess = (portal: PortalRole) => portal === "judge" || portal === "hybrid";

/** Shown only in `npm run dev` with `?preview` in the URL; real visitors see their Supabase application. */
export const MOCK_APPLICATION: { firstName: string; lastName: string; status: ApplicationStatus } = {
  firstName: "Jane",
  lastName: "Doe",
  status: "accepted",
};

export type ScheduleEvent = {
  start: string;
  end?: string;
  title: string;
  description?: string;
  /** Room or venue name shown with a pin; left out while TBA. */
  location?: string;
  /** Optional link (e.g. Google Maps or a campus map) opened from the location. */
  locationUrl?: string;
  /** Who it's for; untagged events show on every portal. Tagged ones show on that role's portal and the hybrid one. */
  audience?: "mentor" | "judge";
  /** Shows a red "Required" tag. */
  required?: boolean;
};

export type ScheduleDay = { label: string; date: string; events: ScheduleEvent[] };

/** Main venue, shown under the "Run of show" heading. */
export const SCHEDULE_VENUE = "Price Center Ballrooms";

// From "DataHacks Run of Show - Main Venue Run of Show 2 Day (24 hr)": the Public rows
// plus the judging rows. Internal organizer and sponsor-only rows are left out.
export const SCHEDULE: ScheduleDay[] = [
  {
    label: "Day 1",
    date: "Saturday, April 18",
    events: [
      { start: "12:00 PM", title: "Doors open & check-in", description: "Participant check-in begins." },
      { start: "12:30 PM", end: "4:30 PM", title: "Mentor office hours", location: "Art of Espresso", audience: "mentor", required: true },
      { start: "1:00 PM", title: "Opening Ceremony", description: "Welcome, keynote, sponsor appreciation, logistics and Major League Hacking.", location: "Hassadar Building, Tsipis Hall" },
      { start: "1:30 PM", title: "Team Matching & Registration", description: "Participants without a team are matched up, and teams are finalized." },
      { start: "2:00 PM", title: "Lunch", location: "Price Center West Ballroom" },
      { start: "2:30 PM", title: "Hacking begins", location: "Price Center West Ballroom" },
      { start: "7:30 PM", title: "Dinner", location: "Price Center West Ballroom" },
    ],
  },
  {
    label: "Day 2",
    date: "Sunday, April 19",
    events: [
      { start: "12:00 AM", title: "Midnight Snack" },
      { start: "9:00 AM", title: "Breakfast" },
      { start: "10:00 AM", title: "Devpost Submissions Workshop / Q&A" },
      { start: "11:00 AM", title: "Submissions due", description: "Soft deadline." },
      { start: "12:00 PM", title: "Lunch" },
      { start: "12:15 PM", title: "Judge arrival", audience: "judge", required: true },
      { start: "12:45 PM", title: "Judge briefing", audience: "judge", required: true },
      { start: "2:00 PM", title: "Hacking ends", description: "Hard submission deadline." },
      { start: "2:00 PM", title: "First-round judging", description: "Expo-style: visit tables and pick the top 5 projects in each track.", audience: "judge", required: true },
      { start: "3:30 PM", title: "Expo ends", description: "Hard deadline." },
      { start: "4:00 PM", title: "Second-round judging", description: "15 teams (5 per track), 4-minute presentations each (overview + demo).", audience: "judge", required: true },
      { start: "6:00 PM", title: "Clean-up", description: "Hackers tidy up the hacking space." },
      { start: "6:30 PM", title: "Closing Ceremony", description: "Winners announced, MLH closing and closing logistics." },
      { start: "7:00 PM", title: "Event ends" },
      { start: "8:00 PM", title: "Venue closes for participants" },
    ],
  },
];

export type Contact = { initials: string; name: string; role: string; email: string; phone?: string };

export const CONTACTS: Contact[] = [
  { initials: "MP", name: "Maya Patel", role: "Mentor coordinator", email: "maya.patel@example.com", phone: "(555) 010-2001" },
  { initials: "TJ", name: "Tyler Johnson", role: "Judging lead", email: "tyler.johnson@example.com", phone: "(555) 010-2002" },
  { initials: "AB", name: "Ava Brooks", role: "Day-of logistics", email: "ava.brooks@example.com", phone: "(555) 010-2003" },
];

export const GENERAL_CONTACT_EMAIL = "info@ds3.club";

/**
 * Application timeline. Placeholders until confirmed: see docs/questions-for-mohak.md.
 * Applications submitted on or before PRIORITY_DEADLINE are in the priority batch.
 */
export const TIMELINE = {
  priorityDeadline: new Date("2026-11-26T23:59:59-08:00"),
  regularDeadline: new Date("2026-12-15T23:59:59-08:00"),
  eventDates: "January 16–17, 2027",
  /** The hacker Mentors tab appears from this moment (the morning of the event). */
  mentorsTabOpens: new Date("2027-01-16T08:00:00-08:00"),
};

export const applicationBatch = (submittedAt: string | null) =>
  submittedAt && new Date(submittedAt) <= TIMELINE.priorityDeadline ? "priority" : "regular";
