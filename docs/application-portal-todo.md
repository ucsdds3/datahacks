# Application portal: to-do and open questions

## Decided
- Everyone signs in with Google before applying: hackers, mentors, judges.
- Mentors and judges get their role from an accepted application. Organizers accept in the Supabase dashboard (Table Editor → `applications` → `status` = `accepted`), and the role updates straight away.
- Portal routes stay top-level: `/login/*`, `/portal/*`, `/apply`, `/apply/mentor-judge`.
- The whole database side is one migration, `supabase/migrations/20261021000000_application_portal.sql`, which can rebuild the database from scratch. Current data is dummy data.

## Before launch
- [ ] Run the migration in the Supabase SQL editor. Until then, the live database still trusts the role in the sign-in link.
- [ ] Sign in end to end as a hacker, a mentor and a judge on the deployed site.

## To do
- [ ] **One portal for everyone.** Per the architecture diagram, hackers, mentors and judges all land in the same portal after Google sign-in. Mentors/judges already do (`/portal`); hackers still get a separate dashboard. Add a hacker section with application status, run of show and the mentor sign-in list. The design is the 10/13 PDF from the group chat.
- [ ] **One entrance.** A single "Create an account / Sign in" page for hackers, mentors and judges, linked from the main site, instead of three separate sign-in pages.
- [ ] **Insurance / liability form for outside judges.** Sponsors will send engineers to judge, and we may invite professors. They need a separate form confirming they're insured or covered before the event.
- [ ] Real coordinator contacts in `src/staff-portal/config.ts` (currently placeholders).
- [ ] DocuSign: a developer account, a template made from the waiver PDF, the app's key in `src/staff-portal/config.ts`, and the secrets listed at the top of `supabase/functions/docusign-waiver/index.ts`. Until then the waiver page says the document isn't ready.
- [ ] Waiver submissions are only remembered in the browser (`localStorage`), so organizers can't see who has signed. Store them in Supabase.
- [ ] Evan to push his branch.

## Open questions
- **People who are invited rather than applying** (sponsor engineers, professors): do they fill out the same mentor/judge application, or a separate, shorter form? Leaning towards the same application, because it's simplest and we collect the same data.
- If any invited person can't or won't apply, do we want an organizer-managed allowlist (email → role) as an override? Left out for now; easy to add later.
