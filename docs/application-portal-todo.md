# Application portal: to-do and open questions

> **Superseded for launch work by [`launch-tracker.md`](launch-tracker.md)**, which has every open item with an owner and next step. This file keeps the background and how-tos.

## Decided
- Everyone signs in with Google before applying: hackers, mentors, judges.
- Mentors and judges get their role from an accepted application. Organizers accept in the Supabase dashboard (Table Editor → `applications` → `status` = `accepted`), and the role updates straight away.
- Portal routes stay top-level: `/login/*`, `/portal/*`, `/apply`, `/apply/mentor-judge`.
- The portal builds on the event model already in the live Supabase project (`events`, `event_roles`, `attendees`, `checkins`, and the triggers that grant roles and check-in codes when an application is accepted). Since 2026-10-22 the whole shared schema, check-in tables included, is in `supabase/migrations/20261022140000_baseline.sql`; the earlier hand-applied files are in `supabase/archive/`.

## Database changes now go through PRs
Two Supabase projects: **staging** (`gpoqlosneoicpzrluilj`, test data only) and **production** (`yrxjhrrphhbmqejresvy`). Every schema change is a file in `supabase/migrations`, and GitHub Actions applies it, staging first:

1. **Make a change:** `npx supabase@2.121.0 migration new <what_it_does>` creates `supabase/migrations/<UTC timestamp>_<what_it_does>.sql`. Write the SQL there. Keep it additive (add columns and tables; don't drop or rename in the same step), because the free plan has no automatic backups and the site deploys separately from the database.
2. **Open a PR.** `supabase-ci` checks that existing migrations weren't edited and new ones sort last, applies the new ones to staging inside a transaction that's rolled back (so staging keeps matching `main`), and type-checks the edge functions.
3. **Merge to `main`.** `supabase-deploy` applies the migrations to staging, lints it, and deploys `send-email` and `send-wallet-passes` there; then, only if staging succeeded, does a dry run on production, applies the migrations and deploys the functions to production.
4. **Every night,** `supabase-drift` fails if production's schema (tables, functions, grants, storage policies, Realtime) differs from staging's, which catches changes made by hand in the SQL editor. `supabase-backup` saves an encrypted copy of production, and every Sunday `supabase-restore-drill` proves those copies restore (see `docs/backups.md`).

Never change the schema in the dashboard's SQL editor any more: write a migration. The check-in repo (DS3-DataHacks-Check-in) shares this database, so its SQL changes come here as PRs too. Function secrets (Gmail, WalletWallet) stay in the dashboard; CI never touches them. Never run `supabase config push`.

**One-time setup still to do:**
- [ ] **Bootstrap production's migration history** (production already has everything in the baseline, but no record of it, so `db push` would try to re-run it). From the repo root, with the production database password:
  ```
  npx supabase@2.121.0 migration repair --status applied 20261022140000 20261022140100 \
    --db-url "postgresql://postgres.yrxjhrrphhbmqejresvy:<PASSWORD>@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
  npx supabase@2.121.0 migration list --db-url "<same URL>"   # both versions should show as applied
  gh variable set SUPABASE_PROD_BOOTSTRAPPED --repo ucsdds3/datahacks --body true
  ```
  This only writes the history table; it runs no SQL. Until the variable is `true`, `supabase-deploy` stops before touching production. (Percent-encode the password if it has symbols.)
- [ ] **`BACKUP_PASSPHRASE` secret:** a long random passphrase, also kept in the team's password manager. Without it the nightly backup skips with a warning. This repo is public, so only the encrypted file is ever uploaded (kept 7 days as a workflow artifact). How to restore, and what isn't backed up (resume files): `docs/backups.md`.
- [ ] **GitHub Environment `supabase-production`** (Settings → Environments), limited to the `main` branch. The deploy job uses it; GitHub creates it on the first run if it doesn't exist, but without the branch rule.
- [ ] **Protect `main`:** require pull requests and the `supabase-ci` checks before merging, since a merge now changes the production database.

## Before launch
- [x] **Supabase redirect URLs fixed (2026-10-22):** sign-ins were landing on the check-in app because only its URL was allowed. Added `http://localhost:8080/**` and `https://datahacks.ds3ucsd.com/**`; the check-in app's entry and the Site URL (still the check-in app) were left as they were.
- [x] mprakash@ucsd.edu is an organizer (2026-10-22). evanpark.contact@gmail.com already was.
- [ ] **Organizer accounts** for Ansh (abhatnagar@ucsd.edu) and Tijil (tchhabra@ucsd.edu). Neither has signed in yet (2026-10-22); once they have (after the October 31 redirect-URL change), run the SQL below for each. Each organizer needs an `organizer` row in `event_roles`. Run in the SQL editor, once per email: `insert into public.event_roles (event_id, user_id, role) select e.id, u.id, 'organizer' from public.events e, auth.users u where e.code = 'DH26' and u.email = 'EMAIL';` (the person must have signed in once first).
- [x] **Email sending is on** (2026-10-22): Gmail secrets saved and `send-email` deployed from the dashboard; a test email from the organizer console went through.
- [ ] **Redirect URLs** (Supabase → Authentication → URL Configuration): add `https://datahacks.ds3ucsd.com/**` and `http://localhost:8080/**`. The list is empty and the Site URL is `http://localhost:3000`, so Google sign-in on the real site can't come back to `/auth/callback`.
- [ ] **The 2027 event:** add it in Table Editor → `events` (with a code such as `DH27`), then change `EVENT_CODE` in `src/portal/event.ts`. Applications currently go to the dummy `DH26` event.
- [ ] **Google sign-in shows "continue to yrxjhrrphhbmqejresvy.supabase.co".** Set the OAuth consent screen's app name ("DataHacks") and logo in Google Cloud Console and submit for brand verification; optionally a Supabase custom domain (e.g. `auth.ds3ucsd.com`, needs the Pro plan + add-on).
- [ ] Accept a test mentor application in the dashboard and check that it grants the role (`event_roles`) and a check-in code (`attendees`), and that the portal shows "accepted".
- [ ] Sign in end to end as a hacker, a mentor and a judge on the deployed site.

## Done
- [x] One portal for everyone and the organizer console (2026-10-22). `supabase/migrations/20261022000000_organizer_console.sql` applied to the live project the same day.

## To do
- [ ] **AI blurbs for mentors who skip theirs:** the mentor blurb is optional (50+ characters when given). Generate one from the rest of their application for anyone who leaves it blank, before the hacker Mentors tab opens.
- [ ] **An MCP server for applications:** someone signs in (creates an account) and can fill out their application through an AI assistant over MCP instead of the form.
- [ ] **Check-in portal UI** (Evan's repo, DS3-DataHacks-Check-in): mobile first, with the top bar collapsible behind a toggle instead of always showing. Organizers will test it on their phones.
- [ ] ~~**One portal for everyone.**~~ Done, see above. Per the architecture diagram, hackers, mentors and judges all land in the same portal after Google sign-in. Mentors/judges already do (`/portal`); hackers still get a separate dashboard. Add a hacker section with application status, run of show and the mentor sign-in list (the mentor form already collects a blurb "shown to hackers on the mentor calendar"). The design is the 10/13 PDF from the group chat.
- [ ] **One entrance.** A single "Create an account / Sign in" page for hackers, mentors and judges, linked from the main site, instead of three separate sign-in pages.
- [ ] **Insurance / liability form for outside judges.** Sponsors will send engineers to judge, and we may invite professors. They need a separate form confirming they're insured or covered before the event.
- [ ] Real coordinator contacts in `src/staff-portal/config.ts` (currently placeholders).
- [ ] DocuSign: a developer account, a template made from the waiver PDF, the app's key in `src/staff-portal/config.ts`, and the secrets listed at the top of `supabase/functions/docusign-waiver/index.ts`. Until then the waiver page says the document isn't ready.
- [ ] Waiver submissions are only remembered in the browser (`localStorage`), so organizers can't see who has signed. Store them in Supabase.
- [ ] **Jev (TypeSafe AI) sort:** a server function scores each application top/bottom 50% with a confidence; shown as a column in the organizer console. Needs a Jev API key and a rubric.
- [ ] Evan to push his branch. (He's the existing organizer in the database, and likely built the check-in system in a separate repo.)
- [ ] **Get the live schema into the repo.** The event model was built outside this repo. Dump it (`supabase db dump --schema public`, which needs the database password) into `supabase/migrations/` as the baseline, so the database can be rebuilt from the repo.

## Open questions
- **People who are invited rather than applying** (sponsor engineers, professors): do they fill out the same mentor/judge application, or a separate, shorter form? Leaning towards the same application, because it's simplest and we collect the same data.
- If any invited person can't or won't apply, do we want an organizer-managed allowlist (email → role) as an override? Left out for now; easy to add later.
