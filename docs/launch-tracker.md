# Launch tracker

The single list of what's left before DataHacks 2027 opens. Every open item has
an ID, an owner and the exact next step. When something is finished, move it
to **Done** with the date. Older notes are in `application-portal-todo.md`; this
file wins where they disagree.

Owners:
- **Mohak**: needs Mohak's eyes, accounts or a decision.
- **Claude**: an agent can do it.
- **Evan**: the check-in repo.
- **Team**: design, sponsorships, ops.

Last updated: 2026-10-23 (evening, after launch).

## Needs Mohak

| ID | Item | Next step |
|---|---|---|
| M3 | Evan reviews the event picker for the check-in app. | Optional now: the live app already picks DH27BETA. The picker matters once DH27 exists alongside DH27BETA. Send him https://github.com/eparkle/DS3-DataHacks-Check-in/pull/1. |
| M4 | Google sign-in says "continue to yrxjhrrphhbmqejresvy.supabase.co". | Google Cloud Console → OAuth consent screen. Set the app name "DataHacks", the logo and the ds3ucsd.com domain, then submit for verification. Needs the Google Cloud account that owns the OAuth client. |
| M5 | The questionnaire. | Decide what it's for, who fills it in, when it opens and closes, the questions, and whether it blocks anything (for example, check-in). |
| M6 | Sponsor challenges content. | Per challenge: name, sponsor, a 1–2 sentence prompt, dataset link, judging criteria and prize. |
| M7 | Design team art. | 9 layer backdrops (overworld, sulfur caves, lush caves, mineshaft, deep dark, stronghold, end city, the end, bedrock), about 2400px wide, WebP or PNG, plus the logo. Lush caves and end city are placeholders. |
| M8 | Website open versus applications open. | Pick the date the site goes public and the date applications open (Oct 31?). If they differ, Claude adds an "applications open on …" gate. |
| M9 | Supabase Pro ($25/mo) for the application window and event week. | Decide. It adds daily backups with point-in-time restore, and the project never pauses. Free projects pause after 7 days without activity. |
| M10 | DocuSign waiver setup. | Embedded signing is already built (`supabase/functions/docusign-waiver`): people sign inside the portal, the envelope carries their name and email, and the portal asks DocuSign whether they finished. Needs a DocuSign developer account, a template made from the waiver PDF with one Signer role (name and email filled in automatically) and the secrets listed at the top of the function. Production use needs DocuSign's go-live review and a paid plan. |
| M11 | Coordinator contacts in the portal sidebar. | Send the real names and emails; Claude puts them in `src/staff-portal/config.ts`. |
| M12 | Ansh and Tijil as organizers. | Both are invited on DH27BETA. Each signs in once at https://datahacks.ds3ucsd.com/organizer after M1. |
| M14 | The backup passphrase in a password manager. | `BACKUP_PASSPHRASE` exists only in `.env.local` on one laptop and in GitHub secrets. If it's lost, every backup is unreadable. Copy it into the team's password manager. Backups are now kept 90 days (GitHub's limit for a public repo), so Oct 31 onwards stays restorable through the event. |
| M15 | Stricter checks on submitted applications. | Applications can't go to staging first (they're live data, not schema). Instead, decide whether the database itself should reject bad values: https-only links, phone format, required fields per role. Claude adds that as a migration. |
| M13 | Error and uptime alerts (free tiers). | Create a Sentry project and an UptimeRobot account, or say which email to use; Claude wires them in. |

## Claude

| ID | Item | Status | Next step |
|---|---|---|---|
| C9 | An "accepting applications" flag on events. | To do, with M8 | Right now anyone could submit to DH26 or DH27BETA by calling the API directly. Add `events.applications_open` and check it on insert. |
| C10 | Check-in app lists by event. | To do | Its list view returns an organizer's rows from every event, so the app has to filter by the chosen event. Confirm Evan's PR #1 does this everywhere. |
| C11 | Drop resume file uploads. | To do | Only links are collected (Google Drive, portfolio). Remove the unused upload code and the `resumes` storage bucket's policies; DH26 files stay until someone deletes them. |
| C7 | Wallet passes to chosen people only. | To do | The console button sends to every accepted person without a pass (dummies included). Add an option to send only to selected people. |

## Evan

| ID | Item | Next step |
|---|---|---|
| E1 | Event picker in the check-in app. | Review and merge PR #1 on his repo. |
| E2 | Check-in UI on phones. | Collapsible top bar, mobile-first. Organizers test on their phones. |

## Event switch (Mohak is doing this; recorded so nothing is missed)

- Create `DH27` in `events`. The first DH27 organizer has to be added in the SQL editor, because adding organizers from the console requires already being one. The query is in `docs/event-isolation.md`. It needs a code (2–10 letters or digits) and start and end dates.
- Add organizers to DH27. The invites and roles from DH27BETA don't carry over.
- Point the site at it: `EVENT_CODE` in `src/portal/event.ts`.
- Open applications: set DH27's `applications_open` to true in `events` (off until then; the apply pages show `applications_open_at` as "Applications open on …" if it's set). Without it, every DH27 application is refused.
- Keep DH27BETA for testing; don't wipe it. Every table is keyed by event, and check-in codes are prefixed by event code (`DH27BETA-H001` and `DH27-H001`). C6 confirms nothing leaks.
- Wallet passes, decision emails and check-in all take the event id. Check the console header and the check-in app show **DH27** before using them.

## Later

- **AI blurbs:** mentors who skip theirs get one written from their application, before hackers see the Mentors tab.
- **Jev (TypeSafe AI) scoring:** a top or bottom 50% column in the console. Needs a key and a rubric.
- **Insurance or liability form** for outside judges (sponsor engineers, professors).
- **Waiver signatures stored in Supabase**, so organizers can see who has signed (currently only in the browser). Store them per event and person, so a test-event signature can't count for DH27.
- **MCP server for applications:** another Claude session, branch `feature/mcp-applications`; see `docs/mcp-server.md`.
- **Checkout at the venue:** not needed, per Mohak on 2026-10-23.

## Done

- 2026-10-23: **Portal live.** PR #12 (event isolation) and PR #9 merged. Pages deployed. Production got 4 database changes (role revoke, DH26 dates, event isolation, event required) and both email functions. Tested live: Trial Chambers, then Google, then the mentor/judge form; `/organizer` works.
- 2026-10-23: `main` protected: PR plus 1 approval, `site` check required, no force-push or delete, admins can bypass. The database checks aren't required because they only run when `supabase/` changes.
- 2026-10-23: the check-in app now picks DH27BETA (DH26 has dates).
- 2026-10-23: **backups proven on production.** A manual `supabase-backup` run, then `supabase-restore-drill`: 11 tables, every row and field identical, no restore errors. It reruns every Sunday.
- 2026-10-23: event isolation audit (`docs/event-isolation.md`). Fixed: resume access across events, moving applications between events, staging decisions limited to the event, the waiver flag shared across events. Applications must now have an event.
- 2026-10-23: sign-in redirect URLs and the email secrets confirmed in production (live sign-in returned to the site; emails sent).
- 2026-10-23: email from the live console reached all three test inboxes. Backup retention is 90 days.

- 2026-10-23: test plan (`docs/testing/portal-test-plan.md`). Two AI testers ran the forms; a pasted `+1` phone bug was fixed.
- 2026-10-23: decisions move rows instantly in the console. Changing a released acceptance removes access (needs M1 to reach production).
- 2026-10-23: hacker sidebar pages, no white flash, tab titles.
- 2026-10-23: check-in tested for hackers, mentors, judges and hybrids. Hackers see mentors as checked in. Non-organizers can't check anyone in.
- 2026-10-23: release emails go out (4 sent), and the `send-email` sender is "DataHacks Team" (deployed).
- 2026-10-23: CI on every PR (`ci.yml`). Every portal page has its own deploy entry. DH26 dates migration added.
- 2026-10-22: CI for database changes, staging first (PR #10). Production bootstrapped. Nightly backups and drift checks (active from M1).
- 2026-10-22: site order and layers (PR #11), fuzzy school search, the organizer console, wallet passes.

## Things to know

- **The repo folder is shared.** Another Claude session (the MCP server work) uses `~/Desktop/datahacks-website/datahacks` on its own branch. Do launch work in a separate worktree, so commits don't land on the wrong branch.
- **Dummy accounts** are all `@example.com`, on DH27BETA. Make more with `scripts/dev/create-dummy-applicant.mjs`. Open one with `/dev/test-accounts` (dev only).
- **Only migrations change the database.** Never edit it in the SQL editor. Data fixes are migrations too (for example, the DH26 dates).
