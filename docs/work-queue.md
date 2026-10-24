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

_Nothing queued._ Add a card here for the next agent task.

## Done (2026-10-23)
- **Q1, DocuSign embedded waiver:** sandbox account, app, consent and template (#19). Three test signings completed. Secrets set on staging and production. Fixed the signing view never opening, envelopes being created for non-accepted users, and the signer name.
- **Q2, wallet passes to selected people** (#17).
- **Q3, resume uploads closed;** only links are collected (#16).
- **Q4, per-event "applications open" switch** (#18). DH27BETA open, DH26 closed.
- **Q5, the console loads every application,** not just the first 1,000 (#21). Bulk decisions and release also handle more than 1,000.
- **Database rejects bad data and anyone under 18;** link and CSV injection fixed (#14).
- **Load test** (#20). Comfortably handles about 2,000 applying per minute; results in `docs/load-test.md`.
- **Contacts** (#15). Backups kept 90 days (#13).
