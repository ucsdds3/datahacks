# Application portal: to-do and open questions

## Decided
- Everyone signs in with Google before applying: hackers, mentors, judges.
- Mentors and judges get their role from an accepted application. Organizers accept in the Supabase dashboard (Table Editor → `applications` → `status` = `accepted`), and the role updates straight away.
- Portal routes stay top-level: `/login/*`, `/portal/*`, `/apply`, `/apply/mentor-judge`.
- The portal builds on the event model already in the live Supabase project (`events`, `event_roles`, `attendees`, `checkins`, and the triggers that grant roles and check-in codes when an application is accepted). `supabase/migrations/20261021000000_application_portal.sql` holds only the portal's changes to it. Applied to the live project on 2026-10-21. Current data is dummy data.

## Before launch
- [ ] **Organizer accounts.** Each organizer needs an `organizer` row in `event_roles`. Run in the SQL editor, once per email: `insert into public.event_roles (event_id, user_id, role) select e.id, u.id, 'organizer' from public.events e, auth.users u where e.code = 'DH26' and u.email = 'EMAIL';` (the person must have signed in once first).
- [ ] **Deploy email sending:** `npx supabase login`, `npx supabase link --project-ref yrxjhrrphhbmqejresvy`, `npx supabase functions deploy send-email`, `npx supabase secrets set GMAIL_ADDRESS=info@ds3.club GMAIL_APP_PASSWORD="…"`. Until then the console releases decisions but says emails aren't set up, and offers to send them later.
- [ ] **Redirect URLs** (Supabase → Authentication → URL Configuration): add `https://datahacks.ds3ucsd.com/**` and `http://localhost:8080/**`. The list is empty and the Site URL is `http://localhost:3000`, so Google sign-in on the real site can't come back to `/auth/callback`.
- [ ] **The 2027 event:** add it in Table Editor → `events` (with a code such as `DH27`), then change `EVENT_CODE` in `src/portal/event.ts`. Applications currently go to the dummy `DH26` event.
- [ ] **Google sign-in shows "continue to yrxjhrrphhbmqejresvy.supabase.co".** Set the OAuth consent screen's app name ("DataHacks") and logo in Google Cloud Console and submit for brand verification; optionally a Supabase custom domain (e.g. `auth.ds3ucsd.com`, needs the Pro plan + add-on).
- [ ] Accept a test mentor application in the dashboard and check that it grants the role (`event_roles`) and a check-in code (`attendees`), and that the portal shows "accepted".
- [ ] Sign in end to end as a hacker, a mentor and a judge on the deployed site.

## Done
- [x] One portal for everyone and the organizer console (2026-10-22). `supabase/migrations/20261022000000_organizer_console.sql` applied to the live project the same day.

## To do
- [ ] ~~**One portal for everyone.**~~ Done, see above. Per the architecture diagram, hackers, mentors and judges all land in the same portal after Google sign-in. Mentors/judges already do (`/portal`); hackers still get a separate dashboard. Add a hacker section with application status, run of show and the mentor sign-in list (the mentor form already collects a blurb "shown to hackers on the mentor calendar"). The design is the 10/13 PDF from the group chat.
- [ ] **One entrance.** A single "Create an account / Sign in" page for hackers, mentors and judges, linked from the main site, instead of three separate sign-in pages.
- [ ] **Insurance / liability form for outside judges.** Sponsors will send engineers to judge, and we may invite professors. They need a separate form confirming they're insured or covered before the event.
- [ ] Real coordinator contacts in `src/staff-portal/config.ts` (currently placeholders).
- [ ] DocuSign: a developer account, a template made from the waiver PDF, the app's key in `src/staff-portal/config.ts`, and the secrets listed at the top of `supabase/functions/docusign-waiver/index.ts`. Until then the waiver page says the document isn't ready.
- [ ] Waiver submissions are only remembered in the browser (`localStorage`), so organizers can't see who has signed. Store them in Supabase.
- [ ] Evan to push his branch.
- [ ] **Get the live schema into the repo.** The event model was built outside this repo. Dump it (`supabase db dump --schema public`, which needs the database password) into `supabase/migrations/` as the baseline, so the database can be rebuilt from the repo.

## Open questions
- **People who are invited rather than applying** (sponsor engineers, professors): do they fill out the same mentor/judge application, or a separate, shorter form? Leaning towards the same application, because it's simplest and we collect the same data.
- If any invited person can't or won't apply, do we want an organizer-managed allowlist (email → role) as an override? Left out for now; easy to add later.
