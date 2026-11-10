// Portal content that isn't stored in Supabase (schedule, contacts, DocuSign setup).
// Swap the values here; no component needs to change.

export type DocuSignConfig = {
  /**
   * "powerform": the waiver page links to a PowerForm on UC San Diego's DocuSign
   * account, and organizers import who signed from DocuSign's CSV export (setup:
   * docs/docusign-powerform-setup.md). "embedded": DocuSign signing inside the page
   * through the docusign-waiver edge function (docs/docusign-waiver.md).
   */
  mode: "powerform" | "embedded";
  /** The PowerForm link ("Copy PowerForm URL" in DocuSign). Empty: the page says the waiver opens soon. */
  powerFormUrl: string;
  /**
   * False until the waiver's final wording is in the DocuSign template. While false
   * the Sign button says "Waiver opens soon" even though the link is set.
   */
  waiverPublished: boolean;
  /** The template's signer role, spelled exactly as in DocuSign: the link fills <Role>_UserName and <Role>_Email. */
  roleName: string;
  /** Data label of the template's read-only text field that carries the application id (what the CSV import matches on). */
  idFieldLabel: string;
  /** Embedded mode only: the app's integration key (public). */
  clientId: string;
  /** Embedded mode only. */
  environment: "demo" | "production";
};

export const DOCUSIGN: DocuSignConfig = {
  mode: "powerform",
  // PowerForm "DataHacks 2027 Liability Waiver" on UC San Diego's DocuSign (account 6371e373…, na1).
  powerFormUrl: "https://www.docusign.net/Member/PowerFormSigning.aspx?PowerFormId=bed6ac13-bb24-44ef-84b1-1ede0ce183c1&env=na1&acct=6371e373-11ff-4359-aa24-bf2ccbddc944&v=2",
  // Open for signing. The template holds UC San Diego's official waiver (swapped in on 2026-11-05).
  waiverPublished: true,
  roleName: "Participant",
  idFieldLabel: "datahacks_id",
  clientId: "24c6a289-a194-46f9-a5f3-3a13fd5aa71a",
  environment: "demo",
};

/**
 * Document the simulated DocuSign shows in `npm run dev` with `?preview`. Drop a PDF at
 * public/dev/waiver-test.pdf to try it; public/dev/ is git-ignored, so it stays on your machine.
 */
export const PREVIEW_WAIVER_PDF = "/dev/waiver-test.pdf";

export type ApplicationStatus = "pending" | "accepted" | "waitlisted" | "rejected";
/** Which portal someone gets: their application's applicant_type. Hybrids get everything mentors and judges get. */
export type PortalRole = "hacker" | "mentor" | "judge" | "hybrid";

export const HANDBOOK_TITLE: Record<PortalRole, string> = {
  hacker: "Hacker Handbook",
  mentor: "Mentor Handbook",
  judge: "Judge Handbook",
  hybrid: "Mentor & Judge Handbook",
};

/**
 * Hackers get the handbook as separate pages, in this order, at /portal/hacker/<slug>.
 * "schedule" is the run of show. Content is in handbookContent.tsx.
 */
export const HACKER_GUIDE_PAGES = [
  { slug: "resources", label: "Resources" },
  { slug: "transportation", label: "Transportation" },
  { slug: "travel", label: "Travel" },
  { slug: "reimbursement", label: "Reimbursement" },
  { slug: "schedule", label: "Run of show" },
  { slug: "food", label: "Food" },
  { slug: "mentorship", label: "Mentorship" },
  { slug: "prizes", label: "Prizes" },
  { slug: "tracks", label: "Tracks & challenges" },
  { slug: "hardware", label: "Hardware" },
  { slug: "devpost", label: "Devpost" },
] as const;
export type HackerGuideSlug = Exclude<(typeof HACKER_GUIDE_PAGES)[number]["slug"], "schedule">;
/** The hacker pages drawn from handbookContent (everything but the run of show). */
export const HACKER_GUIDE_SLUGS = HACKER_GUIDE_PAGES.map(p => p.slug).filter((s): s is HackerGuideSlug => s !== "schedule");

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
    date: "Saturday, January 16",
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
    date: "Sunday, January 17",
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

/** The mentor office-hours block in the run of show: the one time mentors have to be there. */
const MENTOR_BLOCK = SCHEDULE[0].events.find(e => e.audience === "mentor" && e.required)!;
const DOORS_OPEN = SCHEDULE[0].events[0];

/**
 * What mentors tick on the application, from the run of show above so the two can't
 * disagree. The MCP server (supabase/functions/mcp) repeats the hours in its own
 * words; src/portal/mcpApplication.test.ts checks they match.
 */
export const MENTOR_HOURS = `${MENTOR_BLOCK.start.replace(" PM", "")}–${MENTOR_BLOCK.end}`;
export const MENTOR_ONSITE_ACKNOWLEDGEMENT =
  `I understand that mentors must be onsite from ${MENTOR_HOURS} on ${SCHEDULE[0].date}th, with check-in opening at ${DOORS_OPEN.start}.`;

export type Contact = { initials: string; name: string; role: string; email: string; phone?: string };

/** Lead organizers. Shared with their OK (Mohak, 2026-10-23); roles as in the 2026 Hacker Handbook. */
export const CONTACTS: Contact[] = [
  { initials: "MP", name: "Mohak Prakash", role: "DataHacks Co-Director", email: "mprakash@ucsd.edu", phone: "(858) 370-2478" },
  { initials: "TC", name: "Tijil Chhabra", role: "DataHacks Director", email: "tchhabra@ucsd.edu", phone: "(619) 953-7870" },
  { initials: "AB", name: "Ansh Bhatnagar", role: "DS3 President", email: "abhatnagar@ucsd.edu", phone: "(510) 709-6583" },
  { initials: "PS", name: "Praveen Sharma", role: "DS3 VP of External Relations", email: "p4sharma@ucsd.edu", phone: "(858) 729-4474" },
];

export const GENERAL_CONTACT_EMAIL = "info@ds3.club";

/**
 * MLH Member Event switch (docs/mlh.md). Flip to `true` the day MLH approves
 * DataHacks as a Member Event, and in Supabase run
 * `update events set mlh_required = true where code = 'DH27';`
 * Either one on shows MLH's three checkboxes on the hacker application, the
 * "agree to MLH's terms" card on hackers' portals, and the MLH columns and
 * export in the organizer console. The database setting is what enforces it.
 */
export const MLH_ENABLED = false;

/**
 * Only while the MLH application is pending and the checkboxes are already on:
 * shows MLH's "We have applied to be a Major League Hacking (MLH) Member
 * Event…" note above them. Leave false once approved.
 */
export const MLH_APPLICATION_PENDING = false;

/** How long application data is kept, as the privacy notice above Submit says it. */
export const DATA_RETENTION = "until one year after the event, then we delete it";

/**
 * Application timeline (confirmed 2026-10-22). Applications submitted by the
 * priority deadline (the Sunday after Thanksgiving) are in the priority batch.
 */
export const TIMELINE = {
  priorityDeadline: new Date("2026-11-29T23:59:59-08:00"),
  regularDeadline: new Date("2026-12-15T23:59:59-08:00"),
  priorityDecisions: "mid-December",
  regularDecisions: "the end of December",
  /** When each role is needed: mentors only on Saturday, judges only on Sunday. */
  eventDates: {
    hacker: "Saturday–Sunday, January 16–17, 2027",
    mentor: `Saturday, January 16, 2027 · mentoring ${MENTOR_HOURS}`,
    judge: "Sunday, January 17, 2027",
    hybrid: "Saturday–Sunday, January 16–17, 2027 (mentoring Saturday, judging Sunday)",
  } satisfies Record<PortalRole, string>,
  /** Doors open on day 1: the date the MLH export works out each hacker's age on. */
  eventStart: new Date("2027-01-16T12:00:00-08:00"),
  /**
   * Meant to be when the hacker Mentors tab appears (the morning of the event). Not
   * applied while organizers test the tab; re-enable it in StaffPortalLayout's navItems.
   */
  mentorsTabOpens: new Date("2027-01-16T08:00:00-08:00"),
};

/**
 * DataHacks 2027 applicant goal: submitted hacker applications (drafts don't
 * count). The organizer console's Stats page measures progress against it.
 * Not the homepage's "450+ hackers", which is how many come to the event.
 */
export const HACKER_GOAL = 1500;

export const applicationBatch = (submittedAt: string | null) =>
  submittedAt && new Date(submittedAt) <= TIMELINE.priorityDeadline ? "priority" : "regular";
