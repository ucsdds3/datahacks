// Everything the mentor/judge portal shows that isn't wired to Supabase yet.
// Swap the values here; no component needs to change.

/**
 * The DocuSign signing link for the liability waiver. Paste the PowerForm / envelope
 * URL here when it exists. While it's empty the waiver page says the document isn't
 * ready yet. If DocuSign is set to redirect back to `<site>/portal/waiver?event=signing_complete`
 * after signing, the "I've signed" box ticks itself.
 */
export const WAIVER_URL = "";

export type ApplicationStatus = "pending" | "accepted" | "rejected";
export type StaffRole = "mentor" | "judge" | "both";

/** Stand-in for the signed-in person's application until it comes from Supabase. */
export const MOCK_APPLICATION: { firstName: string; role: StaffRole; status: ApplicationStatus } = {
  firstName: "Jane",
  role: "both",
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
  /** Who it's for; untagged events are for everyone. */
  audience?: "mentor" | "judge";
};

export type ScheduleDay = { label: string; date: string; events: ScheduleEvent[] };

export const SCHEDULE: ScheduleDay[] = [
  {
    label: "Day 1",
    date: "Saturday, April 17",
    events: [
      { start: "8:00 AM", end: "9:00 AM", title: "Mentor & judge check-in", description: "Pick up your badge and lanyard.", location: "Price Center East Ballroom", locationUrl: "https://maps.google.com/?q=Price+Center+UC+San+Diego" },
      { start: "9:00 AM", end: "10:00 AM", title: "Opening ceremony", location: "Price Center East Ballroom" },
      { start: "10:00 AM", end: "10:30 AM", title: "Mentor orientation", description: "How the help queue works and what hackers will ask about.", location: "Art of Espresso", audience: "mentor" },
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
      { start: "9:00 AM", end: "11:00 AM", title: "Mentor office hours, block B", location: "Art of Espresso", audience: "mentor" },
      { start: "10:30 AM", end: "11:30 AM", title: "Judge briefing", description: "Rubric walkthrough and track assignments.", location: "Student Services Center 101", audience: "judge" },
      { start: "12:00 PM", title: "Hacking ends", location: "All venues" },
      { start: "12:30 PM", end: "2:30 PM", title: "Judging rounds", location: "Price Center East Ballroom", audience: "judge" },
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
