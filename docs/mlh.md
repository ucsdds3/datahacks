# MLH Member Event switch

DataHacks 2027 has applied to be a Major League Hacking (MLH) Member Event. MLH
requires three checkboxes on the hacker application and asks events to share
registration data. All of it is built and **off**. Turn it on the day MLH
approves the event.

## Turning it on

Either step alone turns it on. Do both:

1. **Database (enforces it, no deploy needed, works from a phone).** Supabase →
   SQL editor, on production:

   ```sql
   update events set mlh_required = true where code = 'DH27';
   ```

   Use the event's real code (whatever `EVENT_CODE` in `src/portal/event.ts` is).
   From then on the database refuses a hacker application submitted without the
   two required MLH agreements, and the site shows the checkboxes within a minute.

2. **Code (the one-line flag).** In `src/staff-portal/config.ts` set
   `MLH_ENABLED = true`, and the same in `supabase/functions/mcp/application.ts`
   (a test fails if they differ). Merge to main. This shows the checkboxes even if
   the database setting is off, and makes the AI apply tool ask for them without
   reading the database.

To turn it off again: `update events set mlh_required = false where code = 'DH27';`
and set the flag back to `false`. Agreements already given stay saved.

### Before approval (optional)

MLH lets events that have applied but aren't approved yet show the checkboxes
with this note: "We have applied to be a Major League Hacking (MLH) Member Event.
The following checkboxes are only applicable if our application is accepted.
Your information will not be shared if we do not become an MLH Member Event."
To use it, set `MLH_APPLICATION_PENDING = true` (and `MLH_ENABLED = true`) in
`config.ts`. Set `MLH_APPLICATION_PENDING` back to `false` once approved.

## What changes when it's on

- **Hacker application** (`/portal/apply/hacker`): a "Major League Hacking (MLH)"
  section above the final agreement, with MLH's three checkboxes in MLH's words
  and links. The first two are required, the third (emails from MLH and DEV) is
  optional. Mentor and judge applications don't change.
- **AI / MCP apply tool** (`submit_hacker_application`): the tool gets
  `mlh_code_of_conduct`, `mlh_data_sharing` (both required) and
  `mlh_emails_opt_in` (optional), each described with MLH's exact wording and
  links, and the server's instructions tell the assistant to show them word for
  word.
- **Hackers who applied before it was on** see a card on their portal home page,
  "One more step: MLH", with the same three checkboxes. Saving it records their
  agreement on their application (`agree_to_mlh`). It isn't shown to people who
  weren't accepted, and disappears once they've agreed. Nothing else about their
  application changes, and nothing is blocked if they never agree (they're just
  left out of the MLH export).
- **Organizer console → Hackers**: an "MLH consent" column (Agreed / Not yet), a
  filter for it, the three agreements (with when they were given) in the CSV, and
  an **MLH export** button.

The privacy notice above Submit is always on, MLH or not. While MLH is on it
also says MLH sees the data if you agree.

## Exporting for MLH

MLH asks Member Events to send registration data to their Member Event
Application regularly, the final list on the Wednesday before the event, and
check-in data (the same rows plus whether each person attended) after check-in.

1. Organizer console → **Hackers**.
2. Pick the tab (Applied, Accepted…) and, if you like, search. The export follows
   what's on screen.
3. **MLH export** downloads `dh-mlh-hackers-<tab>-<date>.csv` with only the
   hackers in that list who agreed to share their data with MLH.

Columns: First Name, Last Name, Email, Phone Number, Age, School, Level of Study,
Country of Residence, MLH Code of Conduct (agreed at), MLH Privacy Policy and
Contest Terms (agreed at), MLH Emails Opt-In, Status, Checked In.

- **Age** is worked out from the birthdate, on the first day of the event
  (`TIMELINE.eventStart` in `config.ts`).
- **Level of Study** is translated into MLH's wording ("Undergraduate University
  (3+ year)" and so on).
- **Checked In** is the check-in data MLH asks for after the event.

## MLH's required fields vs. our hacker form

From the MLH 2027 Member Event Guidelines ("Required Registration Questions") and
the MLH Organizer Guide ("Important Registration Fields"):

| MLH requires | Our form | Notes |
| --- | --- | --- |
| First name, last name (separate) | Yes | |
| Email | Yes | The sign-in email. |
| Phone number | Yes | |
| Age | Birthdate | The MLH export turns it into age. MLH recommends asking age, not birthdate ("We do not collect dates of birth as part of event registration to reduce data risk"); we keep birthdate because the 18+ check uses it. |
| School | Yes, free text with suggestions | MLH asks for names from its verified list (`mlh-policies/schools.csv`). About half our suggestions are spelled the same as MLH's; UC San Diego isn't ("University of California, San Diego" vs MLH's "University of California San Diego"). Not changed: the waitlist's UCSD check relies on our spelling. Ask the MLH Hackathon Community Manager if they need MLH's spellings. |
| Current level of study | Yes | Translated to MLH's wording in the export. MLH also lists "Less than Secondary / High School" and "Prefer not to answer"; DataHacks is 18+, and the question is required. |
| Country of residence | Yes, a dropdown | MLH recommends ISO 3166 names; ours are common English names (e.g. "South Korea", "Türkiye"). |
| The 3 MLH checkboxes | Behind the switch | |

Nothing required is missing, so no new questions were added.

## The wording, and where it comes from

Copied word for word from the "MLH Checkboxes" section of the **MLH 2027 Member
Event Guidelines** (last updated May 22, 2026):
<https://github.com/MLH/mlh-policies/blob/main/member-event-guidelines.md>

1. Required: "I have read and agree to the MLH Code of Conduct."
   (<https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md>)
2. Required: "I authorize you to share my application/registration information
   with Major League Hacking for event administration, ranking, and MLH/DEV
   administration (including the creation of linked accounts on MLH and DEV
   (dev.to)) in line with the MLH Privacy Policy. I further agree to the terms of
   both the MLH Contest Terms and Conditions and the MLH Privacy Policy."
   (<https://github.com/MLH/mlh-policies/blob/main/contest-terms.md>,
   <https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md>)
3. Optional: "I authorize MLH and DEV to send me occasional emails about relevant
   events, career opportunities, and community announcements."

The text lives in `src/staff-portal/mlh.tsx` (`MLH_TEXT`, `MLH_LINKS`) and is
copied in `supabase/functions/mcp/application.ts`; `src/portal/mcpApplication.test.ts`
fails if they drift. If MLH updates its wording, change both.

## Database

Migration `supabase/migrations/20261109230000_mlh_consent.sql`:

- `events.mlh_required` (default `false`): the switch.
- On `applications`: `mlh_code_of_conduct`, `mlh_data_sharing`,
  `mlh_emails_opt_in` (booleans) and `mlh_code_of_conduct_at`,
  `mlh_data_sharing_at`, `mlh_emails_opt_in_at` (when each was given, set by the
  server).
- Only the applicant sets them: on their own row when applying (or while it's a
  draft), and later through `agree_to_mlh(event_id, emails_opt_in)`. An
  organizer's update leaves them alone. The SQL editor can fix them by hand.
- While `mlh_required` is on, a hacker application can't become submitted
  without the two required ones. Rows submitted before are never blocked.

Tests: `supabase/tests/mlh_consent.test.sql`, `src/staff-portal/mlh.test.tsx`,
`src/staff-portal/mlhFlag.test.tsx`, `src/organizer/mlhExport.test.tsx`.

## Trying it locally

`npm run dev`, then add `?preview&mlh` to see it on without either switch:

- `/portal/apply/hacker?preview&mlh`: the form with MLH's checkboxes.
- `/portal/hacker?preview&mlh&status=pending`: the "One more step: MLH" card.
- `/portal/organizer?preview&mlh`: the console's MLH column, filter and export.
