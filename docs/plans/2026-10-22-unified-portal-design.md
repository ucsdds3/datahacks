# Unified application portal and organizer console

Source: the hand-drawn design doc (10/13) and decisions from 2026-10-21/22.

## One portal, Satyash's design
Everyone signs in with Google and lands in `/portal`. The left sidebar depends on who they are and whether they've been accepted. Contacts sit in the bottom-left of the sidebar, not as a tab.

| | Before acceptance | After acceptance |
|---|---|---|
| Hacker | Status (default), Questions | + Hacker Handbook, Run of show, Liability waiver, Mentors (day of the event only) |
| Mentor | Status (default), Questions | + Mentor Handbook, Run of show, Liability waiver |
| Judge | Status (default), Questions | + Judge Handbook, Run of show, Liability waiver, Judging |
| Mentor + judge | Status (default), Questions | + both handbooks, Run of show, Liability waiver, Judging |
| Organizer | Organizer console | |

- **No application yet:** the portal opens on "Apply": pick hacker or mentor/judge, then fill the form inside the portal.
- **Questions after submitting:** "Your application has been submitted and is being reviewed", not the form again.
- **Status:** the status pill and a timeline: submitted → under review → decision → event. Priority applications close at Thanksgiving, regular ones in mid-December, and the event is about a month later.
- **Mentors tab (hackers, day of):** the mentor block with each accepted mentor marked checked in or not. Click a name for their blurb.
- Both forms collect a **phone number**.
- `/apply`, `/apply/mentor-judge` and `/dashboard/*` forward into the portal.

## Organizer console (`/portal/organizer`)
- Only people with the `organizer` role in `event_roles` for the current event.
- Two tables: **Hackers** and **Mentors & judges**, each with tabs Applied / Accepted / Waitlisted / Rejected. Columns include name, email, phone, type (mentor/judge/both), priority or regular batch, and checked in (from `attendees`).
- Click a row for the full application, including the resume.
- **Decisions are staged, then released.** Accept / waitlist / reject only saves a pending decision. A "Release decisions" button shows the counts and requires typing the event code to confirm (like deleting a GitHub repo). Release sets the statuses in one database call (which grants roles and check-in codes through the existing triggers), then sends the decision emails.
- **Email from the console:** compose a message to a filtered group and send it through info@ds3.club via a Supabase Edge Function. The browser never sees the Gmail password, and the function only sends to applications in the organizer's own event.
- **CSV export** of any tab.

## Database (additive, on top of the live event model)
- `applications`: `phone`, `decision` (staged), `decision_released_at`, `decision_emailed_at`.
- `release_decisions(event_id)`: organizer-only; applies staged decisions and returns who to email.
- `mentor_roster(event_id)`: accepted mentors with blurb and checked-in state, readable by accepted people at that event.
- Organizers can read resumes.

## Later
The LLM top/bottom-50% sort (Jev), the scoring rubric, the hacker Mentors tab's real check-in data (needs the check-in system in use), DocuSign credentials, and storing waivers in Supabase.
