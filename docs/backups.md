# Database backups and restores

## What gets backed up

`supabase-backup` runs every night at 03:41 Pacific. It runs `pg_dump` against production (`yrxjhrrphhbmqejresvy`) for the `public` and `auth` schemas, structure and data, in custom format. It encrypts the file with the `BACKUP_PASSPHRASE` secret (gpg, AES256) and keeps it as a workflow artifact named `datahacks-prod-backup` for **90 days** (the most GitHub allows). The passphrase is also in `.env.local` and should be in the team's password manager. Without it the backups can't be read.

**Not in the backup:**
- **Storage files** (the uploaded resumes). Only the database is dumped. The `storage` schema isn't either, but the migrations recreate the bucket and its policies.
- The Realtime publication (`attendees` is in it; the baseline migration adds it back), extensions, and the other Supabase schemas (`storage`, `supabase_migrations`, `vault`, ...).
- Project settings: Auth providers (Google client ID and secret), redirect URLs, edge functions and their secrets (Gmail, WalletWallet). Keep these written down somewhere other than the project.

Scheduled workflows only run from `main`. Until the branch with these workflows is merged, **no backups are being taken**.

## The restore drill

`supabase-restore-drill` runs on Sundays (and on demand from the Actions tab). It restores the newest nightly backup, then a fresh dump taken exactly the way the backup takes one, each into a throwaway Postgres 17 container on the runner. It compares row counts and a checksum of every row in the main tables with production, and does a field-by-field check of one DH27BETA application. It only reads production, and it prints counts and match/mismatch only, never data, because the logs are public.

It fails if there's no backup (or it won't decrypt or restore), if a table that has rows in production comes back empty, or if the fresh dump's restore differs from production at all. The nightly backup is hours old, so differences from that one are listed but don't fail the run.

To run it on your machine (needs Docker, `gpg`, and `gh` for `--latest-artifact`; secrets are read from `.env.local`):

```sh
scripts/backup/restore-drill.sh --latest-artifact          # newest nightly backup
scripts/backup/restore-drill.sh datahacks-prod-2026-10-23.dump.gpg
scripts/backup/restore-drill.sh --fresh                    # dump production now and restore that
scripts/backup/restore-drill.sh --keep FILE                # leave the restored copy running to look at
```

Without Docker, pass `--pg-bin` with a local Postgres 17 `bin` directory, for example `/Applications/Postgres.app/Contents/Versions/17/bin`. Some networks block the database port 5432. If `--fresh` or the comparison times out, try another network or let the workflow run it.

### What a restore needs

The dump holds only `public` and `auth`, and its grants and row-level security policies name Supabase's roles. Restoring it into a plain Postgres 17 database takes four steps. The drill script does all of them.
1. Create the Supabase roles: `anon`, `authenticated`, `service_role`, `supabase_auth_admin`, `dashboard_user`, `supabase_admin` and a few more. Without them, every grant and policy fails with `role "..." does not exist`.
2. Drop the empty `public` schema. `pg_dump` always writes `CREATE SCHEMA public`, which otherwise fails with "already exists".
3. Create the `extensions` schema with `pgcrypto` and `uuid-ossp`. Nothing used them in the test, but production may have a default or index that does.
4. Run `pg_restore --no-owner --exit-on-error --single-transaction`. Owners are dropped. Any error stops the restore and rolls it all back.

If a future drill fails with `role "x" does not exist`, add `x` to the role list in `restore-drill.sh`.

**Verified on 2026-10-23, with caveats.** The machine doing the test couldn't reach production's database port, and there was no backup artifact yet. So the full path was tested on a local stand-in for production: Supabase's roles, auth tables and storage schema, plus this repo's migrations and fake data, including DH27BETA applications. That covered dumping with the workflow's exact `pg_dump` flags, encrypting and decrypting with the workflow's exact `gpg` commands, restoring as above, and the data-only restore in option B below. All counts and row checksums matched. The first real proof against production will be the first `supabase-restore-drill` run after merging.

## In an emergency

**First, make a copy of what's there now.** Before restoring anything into production, dump it (the `pg_dump` command in `supabase-backup.yml`, run by hand). You may need it if the restore makes things worse.

**Get the backup.** Go to Actions → supabase-backup → the run from before the damage → Artifacts → `datahacks-prod-backup`, or use `gh run download <run-id> -n datahacks-prod-backup`. Then decrypt it:

```sh
gpg --decrypt datahacks-prod-YYYY-MM-DD.dump.gpg > prod.dump   # asks for BACKUP_PASSPHRASE
pg_restore --list prod.dump | less                             # look before restoring anything
```

The decrypted file holds everyone's personal data. Delete it when you're done (`shred -u` on Linux, `rm -P` on macOS).

### A. Some rows or one table are wrong (most likely)

Restore into a throwaway copy, find what you need, and copy just that back:

```sh
scripts/backup/restore-drill.sh --keep datahacks-prod-YYYY-MM-DD.dump.gpg
# it prints how to connect to the kept copy; there:
\copy (select * from public.applications where event_id = '...') to '/tmp/rows.csv' csv header
# (with Docker that file is inside the container: docker cp <container>:/tmp/rows.csv .)
# then in production, with psql:
begin;
\copy public.applications from 'rows.csv' csv header
-- check, then: commit;   (or rollback;)
```

Inserts into production run its triggers. For a handful of applications that's what you want, because attendees and roles get synced. To put back a whole table as it was, see C.

### B. The project is gone: restore into a new Supabase project

1. Create a project (Postgres 17, region us-west-1). Build the schema from the repo with `npx supabase@2.121.0 db push --db-url "postgresql://postgres.<NEWREF>:<PASSWORD>@aws-0-us-west-1.pooler.supabase.com:5432/postgres"`. This recreates the tables, functions, policies, the `resumes` bucket and Realtime, and records the migration history.
2. Pull the data out of the dump, leaving the schema behind. Only `auth.users` and `auth.identities` are needed from auth; GoTrue owns the rest of that schema in the new project.
   ```sh
   pg_restore --data-only --schema=auth --table=users --table=identities -f auth-data.sql prod.dump
   pg_restore --data-only --schema=public -f public-data.sql prod.dump
   ```
3. Load it in one transaction with triggers and foreign-key checks off (`session_replication_role = replica`). Otherwise the application triggers create attendees and roles a second time. The truncate removes the DH26 row that the migrations inserted.
   ```sh
   psql "<new project URL>" --single-transaction -v ON_ERROR_STOP=1 \
     -c 'truncate public.events, public.applications, public.profiles, public.event_roles, public.attendees, public.organizer_invites, public.checkins, public.teams, public.team_members cascade' \
     -c 'set session_replication_role = replica' \
     -f auth-data.sql -f public-data.sql
   ```
4. Point everything at the new project:
   - Auth: enable Google with the same OAuth client (so the restored `identities` match the same Google accounts), and set the redirect URLs and Site URL.
   - Deploy the edge functions and set their secrets.
   - Update the GitHub variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `SUPABASE_PROJECT_REF`, and the secret `SUPABASE_DB_PASSWORD`, then redeploy the site.
   - Update the check-in app's configuration.
   - Everyone has to sign in again (new JWT secret).
   - Resumes are gone: `resume_path` points at files that no longer exist.

Steps 2 and 3 were tested against a stand-in built from the migrations (see above), not yet against a real Supabase project.

### C. Production is up but the data is bad across tables

This is the same as B steps 2 and 3, run against production instead of a new project. Truncate only the `public` tables you're replacing. Leave `auth` alone unless it's the problem: deleting from `auth.users` cascades to `profiles`. Do it in one transaction (as above) so a failure changes nothing, then compare counts with `restore-drill.sh --latest-artifact`. Data changed since the backup is lost, so check the copy you made first for anything newer.
