# Work queue

Tasks an agent can pick up and finish on its own. Each card says what "done"
means. The bigger picture is in `launch-tracker.md`; this file is the
hands-on list. Agents: claim a card by doing it, report back, and the
coordinator moves it to Done.

## Rules for every task

- **Never touch the main checkout.** `~/Desktop/datahacks-website/datahacks` is used by another session on `feature/mcp-applications`. Make your own worktree, for example:
  ```
  git -C ~/Desktop/datahacks-website/datahacks worktree add <scratchpad>/<task> origin/main -b <branch>
  ```
  Remove it when you're done.
- **Branch from `origin/main` and open a PR into `main`.** Never merge, since `main` needs approval. Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01EgBz2EXk65565W9vj1xQ75
  ```
  PR bodies end with: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- **Secrets.** Read them from `~/Desktop/datahacks-website/datahacks/.env.local` inside scripts, and never print them. The DocuSign private key is `~/.datahacks/docusign-private-pkcs8.pem`.
- **Production** (Supabase `yrxjhrrphhbmqejresvy`):
  - Reads through the REST API are fine.
  - No writes, no deploys, no secrets changes.
  - Database changes go in as migrations in a PR.
  - Direct Postgres ports are blocked from this Mac.
- **Staging** (`gpoqlosneoicpzrluilj`) is for experiments. Clean up after yourself.
- **Before opening a PR,** run `npx tsc -p tsconfig.app.json --noEmit`, `npx vitest run` and `npm run build`.
- **Migrations:**
  - Name them `supabase/migrations/<date -u +%Y%m%d%H%M%S>_<what>.sql`.
  - If another PR's migration merges first with a later timestamp, rename yours so it sorts last.
  - Keep them additive.
  - PR #14's `application_checks` constraints apply: seed and test data must use the exact option values in `src/staff-portal/formOptions.ts`, and applicants must be 18 or older.
- **Browser:** BrowserOS neo, in your own tab. It's signed in to Google as `mprakash@ucsd.edu` (Gmail at `mail.google.com/mail/u/1`) and to DocuSign demo as the same address.

## Open

### Q1. Finish DocuSign (embedded waiver), demo environment
- **Already done:**
  - The developer account exists (`mprakash@ucsd.edu`; password in `.env.local` as `DOCUSIGN_DEV_PASSWORD`).
  - The app "DataHacks Portal Waiver" exists, with integration key `24c6a289-a194-46f9-a5f3-3a13fd5aa71a`.
  - Its settings page is `https://apps-d.docusign.com/admin/apps-and-keys/225c623d-13d5-4f9e-9b18-3e802d4f67f4`.
  - An RSA public key is uploaded (keypair id `d47f58e9-8d52-48a0-9625-3e65099e5e59`).
  - `.env.local` holds the DocuSign user id, account id and base path.
  - A JWT test returns `consent_required`, so the key itself works. The test script is `scratchpad/shots/jwt.mjs`.
- **Blocker:** the consent URL `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=<IK>&redirect_uri=<uri>` says "There are no redirect URIs registered", even though the app page lists `https://datahacks.ds3ucsd.com/` and `http://localhost:8080/`. Likely fixes:
  - Select "Authorization Code Grant" under User Application.
  - Add a secret key.
  - Re-add the URIs and press Save.
  - Wait a few minutes.

  The Developer Console is locked (needs enrollment), so use Apps and Keys.
- **Then:**
  1. Grant consent, which means clicking Allow on the consent page.
  2. Run `node scratchpad/shots/jwt.mjs templates` and confirm it gets an access token.
  3. Create the waiver template through the eSignature REST API from `scratchpad/shots/DataHacks-2027-Waiver-DRAFT.pdf`. Use one recipient role named `Signer` (routing order 1). Anchor a `signHere` tab to "Participant signature", `dateSigned` to "Date signed", `fullName` to "Participant full name" and `email` to "Email", with suitable offsets. Name it "DataHacks 2027 Liability Waiver (DRAFT)". Save `DOCUSIGN_TEMPLATE_ID` to `.env.local`.
  4. Read `supabase/functions/docusign-waiver/index.ts` and `src/staff-portal/Waiver.tsx` to see exactly what they expect, then prove the full flow from a local script: create an envelope from the template for a test signer with `clientUserId`, request a recipient view (focused view, `frameAncestors` including `http://localhost:8080` and `https://datahacks.ds3ucsd.com`, `messageOrigins` `https://apps-d.docusign.com`), open the signing URL in BrowserOS, sign it, then check the envelope status is `completed`.
  5. Open a PR that:
     - sets `DOCUSIGN.clientId` in `src/staff-portal/config.ts` to the integration key (it's public);
     - adds `docusign-waiver` to the function list in `.github/workflows/supabase-deploy.yml` and to the edge-function type-check in `supabase-ci.yml`, if one exists;
     - fixes any mismatch you found in the function or page;
     - updates `docs` with the setup.
  6. **Don't set Supabase secrets.** Write the exact `supabase secrets set ...` command for Mohak, with names only and values read from `.env.local` and the key file by `$(...)`.
- **Done when:** a real DocuSign demo signing has completed from a script, the PR is open with CI passing, and the secrets command is written.

### Q2. Send wallet passes to chosen people (tracker C7)
The console's "Send wallet passes" emails everyone accepted who has no pass yet, dummies included.
- Add an optional `applicationIds` (or attendee ids) filter to `supabase/functions/send-wallet-passes/index.ts`. It must still check that the caller organizes the event and that every id belongs to it.
- In the console (`src/organizer/WalletPassDialog.tsx`, `ApplicationsTable.tsx`, `data.ts`), add "Send pass" for the rows you've selected. Keep "everyone without a pass" as the default.
- Add tests. Open a PR.
- **Done when:** the PR is open and CI is green.

### Q3. Drop resume file uploads (tracker C11)
Only resume **links** are collected now.
- Remove the dead upload code: `resume_path` handling in the forms, `resumeLink` and the "Open resume (PDF)" button in the console, and storage helpers.
- Keep the `resume_path` column; old DH26 rows may use it.
- Add a migration that drops the `resumes` bucket's insert/update policies, so nobody can upload any more. Keep the read policy for old files. Don't delete files.
- Open a PR.
- **Done when:** the PR is open and CI is green.

### Q4. "Applications open" switch per event (tracker C9)
- Add `events.applications_open boolean not null default false` and `events.applications_open_at timestamptz` (optional).
- Add an insert/update check on `applications`, through a trigger, so applicants can only create or submit applications for an event where `applications_open` is true. Organizers and the service role are exempt.
- The migration sets `applications_open = true` for DH27BETA only.
- The site's apply pages show "Applications open on <date>" when they're closed. Read `src/portal/event.ts` and the apply layout.
- Add tests. Open a PR.
- **Done when:** the PR is open and CI is green. Note in the PR that the real DH27 event needs `applications_open` turned on when Mohak opens applications.

## Running elsewhere
- **Load test:** branch `load-test`. When it's finished and staging is clean, rerun PR #14's `migrations` check.

## Done
- Contacts (PR #15). Minimum age 18 (PR #14, pending CI). Waiver PDF draft. DocuSign account and app.
