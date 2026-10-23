# Supabase migrations and Edge Functions from GitHub Actions

Research and recommendation, 2026-10-22. Checked against the Supabase docs and CLI on that date: Supabase CLI **2.121.0** (latest stable, released 2026-10-14; 2.122 betas and 3.0.0-next prereleases also exist), `supabase/setup-cli` **v3.0.1** (2026-09-24). The Supabase guides still show `setup-cli@v1`; v3 is the current major and needs Node 20+.

## 1. How production teams do it

**Environments.** The documented pattern ("Managing environments") is local Docker database per developer, a `develop` branch that deploys to a **staging project**, and `main` that deploys to **production**, each with `supabase link` + `supabase db push`. Staging has to be a *new* project: one that was hand-changed to look like production can't be used, because the CLI would reapply those changes.

**PRs get checks; merges change the database.** The official example repo (`supabase/supabase-action-example`) runs, on every PR: `supabase db start` (an empty throwaway Postgres with every migration applied), `supabase db lint`, `supabase test db`, a check that the generated types are committed, and `supabase db push --dry-run` against the target project. Merging to `develop` or `main` runs `db push`. The docs say to deploy from CI "rather than deploying from your local machine".

**Migration history.** `db push` applies every file in `supabase/migrations` that has no row in `supabase_migrations.schema_migrations`, in order. `migration list` shows the local and remote versions side by side. `migration repair --status applied|reverted <version>` changes only the history table and never runs SQL.

**Supabase Branching** is the managed alternative. Every PR gets a preview branch, a full Supabase stack built from the repo's migrations, with no production data. Persistent branches can serve as staging. Merging runs Clone → Pull → Health → Configure → Migrate → Seed → Deploy (functions) on production. Preview branches need the **Pro plan or above**, and each one costs **$0.01344/hour** (Micro, about $0.32/day). Branch compute isn't covered by compute credits or the spend cap. The **GitHub integration's "Deploy to production"** works on **any plan**: it applies new migrations and deploys the functions declared in `config.toml` on every push to the production branch. It's a no-secrets alternative to Actions, but you get no dry-run step and you can't control ordering.

**Who can trigger.** Normally only merges to a protected `main` deploy to production. The production secrets live in a GitHub **Environment** that is limited to `main`, sometimes with required reviewers, and a `concurrency` group stops two deploys from running at once. PR jobs from forks get no secrets.

**Rollback.** Supabase has no down migrations. Teams roll forward with a new migration and keep each migration small and additive ("expand, then contract"), so the live site works with both the old and the new schema. They restore from backups/PITR only in an emergency. **The free plan has no automatic backups**: the docs tell free projects to export regularly with `supabase db dump` and keep the copies off-site.

**Secrets.** CI needs `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and the project ref. The token should be a **scoped personal access token** limited to the project. `supabase link` needs **Project Settings, API Keys, API Key Secrets: Read**. Commands that use the DB password, such as `db push`, aren't limited by the token's scopes. Function runtime secrets are set with the dashboard or `supabase secrets set [--env-file]`, and functions pick them up without a redeploy. Names starting with `SUPABASE_` are reserved.

**Dashboard drift.** The docs' rule: once you use migrations, *never* change the remote schema directly. On Free/Pro you can't enforce this, because Developers can still run any SQL in the SQL editor; the Read-Only role and project-scoped roles are Team/Enterprise only. Teams enforce it by agreement and catch violations with a scheduled `supabase db diff --linked` that fails when production differs from the migrations.

## 2. Recommendation for DataHacks

**Shape:** one production project, no staging project. PRs get a throwaway database in CI and need no secrets. A merge to `main` runs dry-run → `db push` → `functions deploy`. A nightly job checks for drift. `ucsdds3/datahacks` is the single source of truth for the shared schema.

### 2.1 One-time baseline (on a branch, from a laptop with Docker running)

The four files in `supabase/migrations` can't stay as they are, for three reasons:
- They `ALTER` tables that only the check-in SQL creates, so replaying them into an empty database (`db start`, the `db pull` shadow database, any future staging) fails.
- The live database already contains them, and its history table almost certainly doesn't list them.
- `20261023000000` and `20261023010000` are dated *tomorrow*. The next `supabase migration new` would sort before them, and `db push` refuses files older than the latest remote version unless you pass `--include-all`.

The fix: replace them with **one baseline pulled from the live database**, which already includes the four files and the check-in repo's objects.

```bash
npm i -D supabase@2.121.0          # pins the CLI for laptops; setup-cli@v3 reads it from package-lock
npx supabase login
npx supabase init                  # creates supabase/config.toml and supabase/.gitignore
npx supabase link --project-ref yrxjhrrphhbmqejresvy
npx supabase migration list        # REMOTE column should be empty. If it lists versions you don't have,
                                   # clear them: npx supabase migration repair --status reverted <v...>
mkdir -p supabase/archive && git mv supabase/migrations/*.sql supabase/archive/   # kept for reference; the CLI ignores this folder
npx supabase db pull baseline      # empty history, so it diffs prod against an empty database (pg-delta,
                                   # on by default in a new config.toml) -> supabase/migrations/<now>_baseline.sql
                                   # Answer Y to "Update remote migration history table?"
                                   # (same as: migration repair --status applied <now>)
npx supabase migration list        # baseline listed both LOCAL and REMOTE
npx supabase db start && npx supabase db diff --linked --schema public   # should print nothing
```

If you'd rather keep the four files: rename the baseline to `20261020000000_baseline.sql`, answer **n**, then run `migration repair --status applied 20261020000000 20261021000000 20261022000000 20261023000000 20261023010000`. Fresh databases would then replay the four files on top of the baseline, which works because they're written to be safe to run twice. It's messier and keeps the future-dated files.

**Review the baseline before committing.** It must contain:
- the check-in objects: `events` (incl. `code`), `event_roles`, `attendees`, `checkins`, `teams`, `check_in_by_code`, `undo_check_in`, `promote_accepted`, `upsert_attendee`, `link_staff_applications`, `v_checkin_list`
- the portal objects: `organizer_invites`, the triggers, and the `storage.objects` resume policy
- `alter publication supabase_realtime add table public.attendees`, because the check-in app uses Realtime

Data is never pulled. Add follow-up migrations with `on conflict do nothing` for the resume **storage bucket** row and, if wanted, `supabase/seed.sql` for the DataHacks 2026 `events` row so local databases are usable. Cross-check against `supabase db dump --linked -f /tmp/prod.sql`. Also:
- Set `[db] major_version` in `config.toml` to production's Postgres version.
- Add a block per function (step 2.4).
- Update the paths in `docs/application-portal-todo.md`.

### 2.2 GitHub setup

1. **Protect `main`**: it's unprotected today. Require PRs and the `supabase-ci` check, because pushing to `main` will change the production database.
2. Create **Environment `supabase-production`** with deployment branches set to `main` only. Required reviewers are optional; on a public repo they're free.
3. Add these **environment secrets**:
   - `SUPABASE_ACCESS_TOKEN`: a scoped PAT on project `yrxjhrrphhbmqejresvy` only. Grant Project Settings, API Keys and API Key Secrets as **Read** (for `link`) and Edge Functions as **Read-write** (for `functions deploy`). Create it from an account that will outlast the current organizers, note who owns it, and rotate it when that person leaves.
   - `SUPABASE_DB_PASSWORD`: the postgres password. Resetting it later is safe, since the apps and the check-in scripts use API keys, not this password.
4. Add **environment variable** `SUPABASE_PROJECT_ID=yrxjhrrphhbmqejresvy`. It isn't secret.

### 2.3 Workflows

`.github/workflows/supabase-ci.yml`: PRs. No secrets, so fork PRs (e.g. from the check-in team) work.

```yaml
name: supabase-ci
on:
  pull_request:
    paths: ["supabase/**", ".github/workflows/supabase-*.yml"]
permissions:
  contents: read
jobs:
  migrations:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: supabase/setup-cli@v3
        with: { version: 2.121.0 }
      - name: Every migration applies to an empty database
        run: supabase db start
      - name: Lint SQL functions
        run: supabase db lint --level error --fail-on error
      - name: Schema objects pg-delta can't track
        run: supabase db diff --strict-coverage
      - name: New migrations sort last; applied ones are untouched
        run: |
          base="origin/${{ github.base_ref }}"
          latest=$(git ls-tree --name-only "$base" supabase/migrations/ | xargs -rn1 basename | cut -d_ -f1 | sort | tail -1)
          fail=0
          for f in $(git diff --name-only --diff-filter=MD "$base"...HEAD -- supabase/migrations/); do
            echo "::error file=$f::Edits an existing migration. Add a new one instead."; fail=1; done
          for f in $(git diff --name-only --diff-filter=A "$base"...HEAD -- supabase/migrations/); do
            v=$(basename "$f" | cut -d_ -f1)
            if [ -n "$latest" ] && [ ! "$v" \> "$latest" ]; then
              echo "::error file=$f::$v is not newer than $latest on ${{ github.base_ref }}. Recreate with 'supabase migration new'."; fail=1; fi
          done
          exit $fail
```

`.github/workflows/supabase-deploy.yml`: production, on merge.

```yaml
name: supabase-deploy
on:
  push:
    branches: [main]
    paths: ["supabase/**"]
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: supabase-production
  cancel-in-progress: false
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: supabase-production
    timeout-minutes: 20
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
      SUPABASE_PROJECT_ID: ${{ vars.SUPABASE_PROJECT_ID }}
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v3
        with: { version: 2.121.0 }
      - run: supabase link --project-ref "$SUPABASE_PROJECT_ID"   # uses the IPv4 pooler; never --skip-pooler here
      - name: Pending migrations
        run: supabase db push --dry-run
      - name: Apply migrations
        run: supabase db push
      - name: Deploy Edge Functions   # list them; docusign-waiver joins once its secrets exist. Never --prune.
        run: supabase functions deploy send-email send-wallet-passes --project-ref "$SUPABASE_PROJECT_ID" --use-api
      - run: supabase migration list
```

`.github/workflows/supabase-drift.yml`: nightly check that nobody changed production in the dashboard.

```yaml
name: supabase-drift
on:
  schedule: [{ cron: "0 15 * * *" }]   # 08:00 PT
  workflow_dispatch:
permissions:
  contents: read
jobs:
  drift:
    runs-on: ubuntu-latest
    environment: supabase-production   # if you add required reviewers, give this job its own env with the same secrets
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v3
        with: { version: 2.121.0 }
      - run: supabase link --project-ref "${{ vars.SUPABASE_PROJECT_ID }}"
      - run: |
          supabase db diff --linked --schema public > drift.sql
          if [ -s drift.sql ]; then cat drift.sql; echo "::error::Production differs from supabase/migrations"; exit 1; fi
```

The site workflow (`deploy.yml`) stays as it is. Because the two workflows race, **migrations must keep working with the site that's live now**: add things first, remove them in a later PR, which is what the existing files already do. If that's ever not possible, move the `deploy` job above into `deploy.yml` and make `build` `needs:` it.

### 2.4 Edge Functions and their secrets

- Before the first CI deploy, run `supabase functions download send-email` (and `send-wallet-passes`) into a scratch folder and diff against the repo. CI will overwrite whatever was edited in the dashboard.
- In `config.toml`, add a `[functions.send-email]`, `[functions.send-wallet-passes]` and `[functions.docusign-waiver]` block, each with `verify_jwt = true`. All three are called with `supabase.functions.invoke` by a signed-in user and check `auth.getUser()`. Confirm that matches the current setting on the dashboard's function page; the CLI defaults to `true`.
- The `npm:` imports are pinned already. `--use-api` bundles on Supabase's servers, the same way the dashboard does today, so Docker isn't needed.
- Keep runtime secrets out of GitHub: Gmail, WalletWallet and DocuSign stay in the dashboard or `supabase secrets set`. Commit `supabase/functions/.env.example` with the names only.

### 2.5 The check-in repo

`eparkle/DS3-DataHacks-Check-in` stops owning SQL:
- Every change to `events`/`attendees`/`checkins`/`teams`/`check_in_by_code` goes in as a migration PR to `ucsdds3/datahacks` (`supabase migration new <name>`). CI needs no secrets, so a fork PR works.
- Add `.github/CODEOWNERS` with `/supabase/ @<datahacks owners> @eparkle` so both sides review.
- Change its README line "Apply the check-in SQL in the Supabase SQL Editor" to point here.
- If it uses generated types, it pulls them from this repo.

Longer term, moving the check-in app into this repo (or the `ucsdds3` org) removes the cross-repo step.

### 2.6 Staging project? Not now.

On the free plan a second project:
- uses the second of your 2 active free projects
- pauses after a week without activity, which breaks CI
- has no backups

The CI `db start` job already proves every migration applies from scratch, and `supabase start` / `db reset` give each developer a local copy. Reconsider after the event or if the team goes Pro. At that point **Branching** (a preview per PR, roughly $0.32/day while open) is better value than a hand-run staging project.

### 2.7 Rules

- Never use the SQL editor to change the schema; editing data in the Table Editor is fine.
- Never edit a migration once it's merged.
- Before a risky migration, run `supabase db dump --linked --data-only -f backup.sql` on a laptop. Don't upload dumps as Actions artifacts: on a public repo any signed-in GitHub user can download them.
- Rollback means a new migration that undoes the change, or `git revert` + merge for functions.

## 3. Risks and gotchas

1. **`db push` writes straight to production.** Files apply in order, and if one fails, the files before it stay applied. Keep migrations small, read the dry-run output in the job log, and fix forward. `db push` also syncs `[db.vault]` secrets from `config.toml` unless `--skip-vault` is set; we declare none.
2. **IPv6.** The direct host `db.<ref>.supabase.co` is IPv6-only unless you buy the IPv4 add-on (Pro+), and GitHub-hosted runners are IPv4-only. `supabase link` uses the Supavisor pooler by default, so it works. If you ever use `--db-url`, use the **Session** pooler string (port 5432), as the Supabase docs do. One blog example uses the transaction pooler (6543); avoid it for DDL.
3. **`db pull` needs Docker** for its shadow database. On old projects it can fail with `permission denied for table _type` (graphql schema); the docs give the `grant ... in schema graphql to postgres, ...` fix.
4. **Things `db pull` doesn't capture**:
   - table data (the `events` row, storage bucket rows, `cron.job`)
   - Auth settings: redirect URLs, Google OAuth, Site URL
   - function secrets

   Never run `supabase config push` from CI: `init`'s defaults (e.g. `site_url = http://localhost:3000`) would overwrite production Auth settings.
5. **Migration history mismatches.** A remote version with no local file blocks `db push`; fix it with `migration repair --status reverted`. A new file that sorts before the latest remote version also blocks it, unless you pass `--include-all`. The CI filename check catches the second case. Two PRs that both add migrations: rename the later one with a fresh timestamp, which is the docs' "rebasing migrations" procedure.
6. **`verify_jwt`.** A CLI deploy with no `config.toml` block uses `verify_jwt = true`. If a dashboard deploy had turned it off, the first CI deploy turns it back on, and the reverse can also happen. Pin it per function. The new `sb_publishable_`/`sb_secret_` keys aren't JWTs: the platform check lets them through, but they don't authenticate the caller.
7. **`--prune`** deletes deployed functions that aren't in the repo. Don't use it.
8. **The database password is all-powerful.** Keep it to one environment limited to `main`. Never use `pull_request_target` with the PR's code checked out.
9. **CLI drift.** New CLI versions ship almost daily, and pg-delta output changes between them. Pin the version in both places (`setup-cli` and the `devDependency`) and bump it on purpose.
10. **Free plan.** No backups, no Read-Only role, and the project pauses after a week of inactivity, after which deploys fail until it's resumed.

## 4. Sources (retrieved 2026-10-22)

- Managing environments: https://supabase.com/docs/guides/deployment/managing-environments
- CI/CD workflows (same examples): https://supabase.com/docs/guides/cli/cicd-workflows
- Database migrations (repair, list, never change remote directly): https://supabase.com/docs/guides/deployment/database-migrations
- Deploy Edge Functions / GitHub Actions: https://supabase.com/docs/guides/functions/deploy
- Function configuration (`verify_jwt`, `config.toml`): https://supabase.com/docs/guides/functions/function-configuration
- Function auth and API keys: https://supabase.com/docs/guides/functions/auth, https://supabase.com/docs/guides/api/api-keys
- Function secrets: https://supabase.com/docs/guides/functions/secrets
- CLI reference (db push/pull/dump/diff/lint, migration repair/list, link, functions deploy, secrets): https://supabase.com/docs/reference/cli/introduction, plus `supabase <cmd> --help` on CLI 2.121.0
- Branching: https://supabase.com/docs/guides/deployment/branching
- Branching GitHub integration: https://supabase.com/docs/guides/deployment/branching/github-integration
- Branching usage/pricing: https://supabase.com/docs/guides/platform/manage-your-usage/branching, https://supabase.com/pricing
- Scoped personal access tokens: https://supabase.com/docs/guides/platform/personal-access-tokens
- Access control (roles, SQL editor): https://supabase.com/docs/guides/platform/access-control
- Backups (none on Free): https://supabase.com/docs/guides/platform/backups
- IPv4/IPv6 (GitHub Actions is IPv4-only): https://supabase.com/docs/guides/platform/ipv4-address
- setup-cli action (v3.0.1): https://github.com/supabase/setup-cli
- Official example repo (PR dry-run against target): https://github.com/supabase/supabase-action-example
- Supabase CLI releases: https://github.com/supabase/cli/releases
- GitHub environments (required reviewers on public repos, branch limits): https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- Real-world write-up (Finalist, 2025-02-06): https://techblog.finalist.nl/blog/deploying-supabase-migrations-github-actions
