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

export type ApplicationStatus = "pending" | "accepted" | "rejected";
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
  /** Room or venue name shown with a pin. */
  location: string;
  /** Optional link (e.g. Google Maps or a campus map) opened from the location. */
  locationUrl?: string;
  /** Who it's for; untagged events show on every portal. Tagged ones show on that role's portal and the hybrid one. */
  audience?: "mentor" | "judge";
  /** Shows a red "Required" tag. */
  required?: boolean;
};

export type ScheduleDay = { label: string; date: string; events: ScheduleEvent[] };

export const SCHEDULE: ScheduleDay[] = [
  {
    label: "Day 1",
    date: "Saturday, April 17",
    events: [
      { start: "8:00 AM", end: "9:00 AM", title: "Mentor check-in", description: "Pick up your badge and lanyard.", location: "Price Center East Ballroom", locationUrl: "https://maps.google.com/?q=Price+Center+UC+San+Diego", audience: "mentor", required: true },
      { start: "9:00 AM", end: "10:00 AM", title: "Opening ceremony", location: "Price Center East Ballroom" },
      { start: "10:00 AM", end: "10:30 AM", title: "Mentor orientation", description: "How the help queue works and what hackers will ask about.", location: "Art of Espresso", audience: "mentor", required: true },
      { start: "12:30 PM", end: "4:30 PM", title: "Mentor office hours, block A", description: "Drop-in help at the mentor tables.", location: "Art of Espresso", audience: "mentor" },
      { start: "1:00 PM", end: "2:00 PM", title: "Lunch", location: "Price Center Plaza" },
      { start: "6:00 PM", end: "7:00 PM", title: "Dinner & networking", location: "Price Center Plaza" },
    ],
  },
  {
    label: "Day 2",
    date: "Sunday, April 18",
    events: [
      { start: "8:30 AM", end: "9:30 AM", title: "Breakfast", location: "Price Center Plaza" },
      { start: "9:30 AM", end: "10:30 AM", title: "Judge check-in", description: "Pick up your badge and judging packet.", location: "Price Center East Ballroom", locationUrl: "https://maps.google.com/?q=Price+Center+UC+San+Diego", audience: "judge", required: true },
      { start: "9:00 AM", end: "11:00 AM", title: "Mentor office hours, block B", location: "Art of Espresso", audience: "mentor" },
      { start: "10:30 AM", end: "11:30 AM", title: "Judge briefing", description: "Rubric walkthrough and track assignments.", location: "Student Services Center 101", audience: "judge", required: true },
      { start: "12:00 PM", title: "Hacking ends", location: "All venues" },
      { start: "12:30 PM", end: "2:30 PM", title: "Judging rounds", location: "Price Center East Ballroom", audience: "judge", required: true },
      { start: "2:30 PM", end: "3:15 PM", title: "Judge deliberation", description: "Finalize scores and pick track winners.", location: "Student Services Center 101", audience: "judge", required: true },
      { start: "3:30 PM", end: "4:30 PM", title: "Closing ceremony & awards", location: "Price Center East Ballroom" },
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
