# Event isolation

One Supabase project holds every event (`public.events`): DH26, the DH27BETA
test event and DH27. Test data in DH27BETA stays next to the real DH27, so
nothing may read, write, grant or email across events. The site picks its event
with `EVENT_CODE` in `src/portal/event.ts`; `currentEventId()` turns it into the
event's id.

## How each piece is scoped

**Website (src/)**

| Where | How it stays in one event |
| --- | --- |
| `context/AuthContext.tsx` role lookup | `event_roles` filtered by user and `currentEventId()`. A DH27BETA role grants nothing in DH27. |
| `pages/AuthCallback.tsx` "has an application" | `applications` filtered by user and event. |
| `staff-portal/useStaffAccess.ts` (StaffGate, Dashboard, Questions) | Same filter. |
| `HackerApplication.tsx`, `StaffApplication.tsx` | `insert` (never upsert) with `event_id: currentEventId()`. One application per user per event (`applications_user_event_key`); staff emails are unique per event. |
| `staff-portal/Mentors.tsx` | `mentor_roster(currentEventId())`. |
| `organizer/data.ts` | Reads filter on `event_id`; staging a decision filters on `event_id` too; release, email and passes take the event id. |
| `organizer/OrganizersPanel.tsx` | `list/add/remove_organizer` take the event id. |
| Waiver flag (localStorage) | Key includes `EVENT_CODE` and the user id. |

**Database**

- RLS on `applications`, `attendees`, `checkins`, `event_roles` uses
  `is_event_staff(event_id)`: an organizer of one event sees nothing of another.
  Applicants see only their own rows (all events, so the site filters by event).
- Every RPC (`release_decisions`, `check_in_by_code`, `undo_check_in`,
  `check_in_attendee`, `mentor_roster`, `add/remove/list_organizers`) checks the
  caller against the event it's given and only touches that event.
- Triggers grant roles only in the application's own event (`promote_accepted`,
  `link_staff_applications`) or the invite's own event (`grant_invited_organizer`).
  `link_staff_applications` links unclaimed staff applications by email in every
  event, but each keeps its event and a role only comes from an accepted one.
- Check-in codes are `<EVENT CODE>-<letter><n>` and unique per event; a DH27BETA
  code scanned at the DH27 desk is "unknown".
- An application can't move to another event (`applications_event_fixed`).
- Resumes in storage are readable only by organizers of an event the resume
  was submitted to.

**Edge functions**: `send-email` checks `is_event_staff(eventId)` and loads
recipients with `event_id = eventId` (ids from other events are reported, not
sent). `send-wallet-passes` does the same for the roster. `docusign-waiver` is
per user, not per event (see below).

**Dev**: `scripts/dev/create-dummy-applicant.mjs` hardcodes DH27BETA, and its
dummies are `@example.com`.

**Applications open**: `events.applications_open` is each event's switch, off
for a new event. While it's off, the database refuses an applicant's new
application or submitted draft for that event (trigger
`applications_require_open_event`), and the apply pages show "Applications open
on <date>" from `events.applications_open_at` (or "aren't open right now" with
no date) instead of the form. Organizers of the event and the service role are
exempt, and decisions, release and check-in never check it. DH27BETA is on for
testing. Tests: `supabase/tests/run.sh`.

## Switching EVENT_CODE to DH27

1. Add DH27 in Table Editor -> events (code `DH27`; the code is the check-in code prefix).
2. Make the first DH27 organizer by hand (SQL editor), since `add_organizer` needs
   an organizer of that event:
   `insert into event_roles (event_id, user_id, role) select e.id, u.id, 'organizer' from events e, auth.users u where e.code = 'DH27' and u.email = '...';`
   Then add the rest from the console. DH27BETA organizers carry nothing over.
3. Change `EVENT_CODE` in `src/portal/event.ts`. That's the only place: the
   console and the release confirmation read it. Leave
   `scripts/dev/create-dummy-applicant.mjs` on DH27BETA.
4. Open applications: in Table Editor -> events, set DH27's `applications_open`
   to true (optionally fill `applications_open_at` beforehand, so the apply pages
   announce the date until then). Set it back to false to close them.
5. Deploy, then check as an organizer: the console header says DH27 and the
   table is empty.
6. Point the check-in desk (DS3-DataHacks-Check-in) at DH27's event too.
7. To keep testing, use a separate deploy (or a local `npm run dev`) built with
   `EVENT_CODE = "DH27BETA"`. Never send emails or passes from it to real people.
