#!/usr/bin/env bash
# Restore drill: proves a production backup can be restored. It restores a
# backup into a throwaway Postgres (a Docker container, or a temporary local
# cluster with --pg-bin), compares row counts and contents with production,
# then deletes everything. It only ever reads production.
#
# Usage:
#   scripts/backup/restore-drill.sh FILE              a .dump.gpg (or decrypted .dump)
#   scripts/backup/restore-drill.sh --latest-artifact newest nightly backup, via gh
#   scripts/backup/restore-drill.sh --fresh           dump production now, exactly like
#                                                     supabase-backup.yml, then restore it
# Options:
#   --pg-bin DIR   use local Postgres binaries (major version must match) instead of Docker
#   --keep         leave the restored database running and print how to connect
#   --no-prod      skip the production comparison (restore only)
#
# Secrets come from the environment, else from .env.local (never printed):
#   BACKUP_PASSPHRASE     decrypts .gpg files
#   SUPABASE_DB_PASSWORD  read-only queries against production (counts, checksums)
# Optional: SUPABASE_PROJECT_REF (default yrxjhrrphhbmqejresvy),
#   SUPABASE_DB_HOST (default aws-0-us-west-1.pooler.supabase.com), PG_MAJOR (default 17),
#   PROD_CONNINFO (replaces the whole production connection string, for testing).
#
# Exit status is non-zero if the restore errors, if a table that has rows in
# production comes back empty, or (with --fresh, where the dump and production
# are the same moment) if any count or checksum differs. A backup file or
# artifact is hours old, so there differences are reported but don't fail.
#
# Output is counts and match/mismatch only, never row contents: CI logs of this
# public repo are public.
set -euo pipefail

mode=""; file=""; pg_bin=""; keep=false; use_prod=true
while [ $# -gt 0 ]; do
  case "$1" in
    --latest-artifact) mode=artifact ;;
    --fresh) mode=fresh ;;
    --pg-bin) pg_bin="$2"; shift ;;
    --keep) keep=true ;;
    --no-prod) use_prod=false ;;
    -h|--help) sed -n '2,33p' "$0"; exit 0 ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) mode=file; file="$1" ;;
  esac
  shift
done
[ -n "$mode" ] || { sed -n '2,33p' "$0"; exit 2; }
if [ "$mode" = fresh ] && [ "$use_prod" = false ]; then
  echo "--fresh needs production access" >&2; exit 2
fi

repo_root=$(cd "$(dirname "$0")/../.." && pwd)
env_file="$repo_root/.env.local"
# Fill a variable from .env.local unless it is already set.
load_secret() {
  local name="$1" line
  printf -v "$name" '%s' "${!name:-}"
  if [ -z "${!name}" ] && [ -f "$env_file" ]; then
    line=$(grep -E "^${name}=" "$env_file" | tail -1 || true)
    line="${line#*=}"; line="${line%\"}"; line="${line#\"}"
    printf -v "$name" '%s' "$line"
  fi
  export "${name?}"
}

PG_MAJOR="${PG_MAJOR:-17}"
ref="${SUPABASE_PROJECT_REF:-yrxjhrrphhbmqejresvy}"
host="${SUPABASE_DB_HOST:-aws-0-us-west-1.pooler.supabase.com}"
prod="${PROD_CONNINFO:-host=$host port=5432 dbname=postgres user=postgres.$ref sslmode=require}"

# Tables compared after the restore.
tables="public.applications public.profiles public.events public.event_roles public.attendees
public.organizer_invites public.checkins public.teams public.team_members auth.users auth.identities"

umask 077
work=$(mktemp -d "${TMPDIR:-/tmp}/restore-drill.XXXXXX")
container=""; datadir=""; port=""; finished=false
# Decrypted dumps hold personal data: overwrite before deleting where possible.
wipe() { shred -u "$1" 2>/dev/null || rm -P "$1" 2>/dev/null || rm -f "$1"; }
cleanup() {
  local rc=$?
  # bash 3.2 (macOS) reports 0 here after some errors; don't trust it alone.
  [ "$finished" = true ] || [ $rc -ne 0 ] || rc=1
  if [ "$keep" = true ] && [ $rc -eq 0 ]; then
    echo
    if [ -n "$container" ]; then
      echo "Kept: docker exec -it $container psql -U postgres -d drill   (remove: docker rm -f $container)"
    else
      echo "Kept: $pg_bin/psql -h 127.0.0.1 -p $port -U postgres -d drill   (stop: $pg_bin/pg_ctl -D $datadir stop -m fast; rm -rf $datadir)"
    fi
  else
    [ -n "$container" ] && docker rm -f "$container" >/dev/null 2>&1 || true
    if [ -n "$datadir" ]; then
      "$pg_bin/pg_ctl" -D "$datadir" stop -m immediate >/dev/null 2>&1 || true
      rm -rf "$datadir"
    fi
  fi
  for f in "$work"/*.dump; do [ -e "$f" ] && wipe "$f"; done
  rm -rf "$work"
  exit $rc
}
trap cleanup EXIT

say() { printf '\n== %s\n' "$*"; }

# --- throwaway Postgres -------------------------------------------------------
# pg <tool> [args]: run a Postgres client tool against the throwaway server.
if [ -n "$pg_bin" ]; then
  have=$("$pg_bin/pg_restore" --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')
  [ "$have" = "$PG_MAJOR" ] || { echo "$pg_bin is Postgres $have, need $PG_MAJOR" >&2; exit 1; }
  datadir=$(mktemp -d "${TMPDIR:-/tmp}/restore-drill-pg.XXXXXX")
  port=$((55000 + RANDOM % 900))
  "$pg_bin/initdb" -D "$datadir" -U postgres -A trust -E UTF8 --no-locale >/dev/null
  # TCP only: socket paths under long temp dirs exceed the 103-byte limit.
  "$pg_bin/pg_ctl" -D "$datadir" -w -l "$datadir/server.log" \
    -o "-p $port -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" start >/dev/null
  pg() { local t="$1"; shift; "$pg_bin/$t" "$@"; }
  local_conn="host=127.0.0.1 port=$port user=postgres"
  dump_in() { echo "$1"; }                         # host path is usable as is
  copy_in() { :; }
  drop_in() { :; }
else
  docker info >/dev/null 2>&1 || { echo "Docker isn't running (or use --pg-bin DIR)" >&2; exit 1; }
  container="restore-drill-$$"
  docker run -d --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust "postgres:$PG_MAJOR" >/dev/null
  # The image restarts the server once after initdb; wait for the TCP listener.
  for _ in $(seq 60); do
    docker exec "$container" psql -h 127.0.0.1 -U postgres -Atqc 'select 1' >/dev/null 2>&1 && break
    sleep 1
  done
  pg() { local t="$1"; shift; docker exec -i -e PGPASSWORD "$container" "$t" "$@"; }
  local_conn="host=127.0.0.1 user=postgres"
  dump_in() { echo "/tmp/$(basename "$1")"; }
  copy_in() { docker cp "$1" "$container:/tmp/$(basename "$1")" >/dev/null; }
  drop_in() { docker exec "$container" rm -f "/tmp/$(basename "$1")"; }
fi
restore_db="$local_conn dbname=drill"
pg psql "$local_conn dbname=postgres" -X -q -v ON_ERROR_STOP=1 -c 'create database drill' >/dev/null

prodq() { PGPASSWORD="$SUPABASE_DB_PASSWORD" pg psql "$prod" -X -At -v ON_ERROR_STOP=1 -c "$1"; }
restq() { pg psql "$restore_db" -X -At -v ON_ERROR_STOP=1 -c "$1"; }

if [ "$use_prod" = true ]; then
  load_secret SUPABASE_DB_PASSWORD
  [ -n "$SUPABASE_DB_PASSWORD" ] || { echo "SUPABASE_DB_PASSWORD not set (or use --no-prod)" >&2; exit 1; }
  server=$(prodq "show server_version_num")
  [ $((server / 10000)) = "$PG_MAJOR" ] || { echo "production is Postgres $((server / 10000)), drill uses $PG_MAJOR: set PG_MAJOR" >&2; exit 1; }
fi

# Row count and content checksum of every compared table, one "table rows md5"
# line each. Rows are rendered in UTC, sorted bytewise, so equal data gives
# equal checksums on any server.
fingerprint_sql="set timezone = 'UTC'; set datestyle = 'ISO, MDY'; set extra_float_digits = 1;"
for t in $tables; do
  fingerprint_sql+=" select '$t', count(*), md5(coalesce(string_agg(x::text, E'\\n' order by x::text collate \"C\"), '')) from $t x;"
done
fingerprint() { "$1" "$fingerprint_sql" | grep -v -E '^(SET)?$'; }

decrypt() { # decrypt <in.gpg> <out.dump>
  load_secret BACKUP_PASSPHRASE
  [ -n "$BACKUP_PASSPHRASE" ] || { echo "BACKUP_PASSPHRASE not set" >&2; exit 1; }
  printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --quiet --yes --no-symkey-cache --pinentry-mode loopback \
    --passphrase-fd 0 --decrypt -o "$2" "$1"
}

# --- get a decrypted dump -----------------------------------------------------
dump="$work/restore.dump"
case "$mode" in
  file)
    say "Backup file: $(basename "$file")"
    case "$file" in
      *.gpg) decrypt "$file" "$dump" ;;
      *) cp "$file" "$dump" ;;
    esac
    ;;
  artifact)
    run=$(gh run list --workflow supabase-backup.yml --status success --limit 1 \
      --json databaseId,createdAt -q '.[0] | "\(.databaseId) \(.createdAt)"' || true)
    [ -n "$run" ] || { echo "::error::No successful supabase-backup run found: backups aren't being taken." >&2; exit 1; }
    say "Latest nightly backup: run ${run% *}, taken ${run#* }"
    gh run download "${run% *}" -n datahacks-prod-backup -D "$work/artifact" \
      || { echo "::error::Run ${run% *} has no backup artifact: BACKUP_PASSPHRASE was missing, or it expired (kept 7 days)." >&2; exit 1; }
    gpgfile=$(ls "$work"/artifact/datahacks-prod-*.dump.gpg | tail -1)
    decrypt "$gpgfile" "$dump"
    ;;
  fresh)
    say "Fresh dump of production (same flags and encryption as supabase-backup.yml)"
    before=$(fingerprint prodq)
    PGPASSWORD="$SUPABASE_DB_PASSWORD" pg pg_dump "$prod" \
      --format=custom --no-owner --schema=public --schema=auth -f "$(dump_in "$work/prod.dump")"
    [ -z "$container" ] || { docker cp "$container:/tmp/prod.dump" "$work/prod.dump" >/dev/null; docker exec "$container" rm /tmp/prod.dump; }
    after=$(fingerprint prodq)
    load_secret BACKUP_PASSPHRASE
    [ -n "$BACKUP_PASSPHRASE" ] || { echo "BACKUP_PASSPHRASE not set" >&2; exit 1; }
    printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --no-symkey-cache --pinentry-mode loopback --passphrase-fd 0 \
      --symmetric --cipher-algo AES256 -o "$work/prod.dump.gpg" "$work/prod.dump"
    wipe "$work/prod.dump"
    decrypt "$work/prod.dump.gpg" "$dump"
    if [ "$before" != "$after" ]; then
      echo "::error::Production changed while dumping, so the comparison can't be exact. Run again." >&2
      exit 1
    fi
    ;;
esac
pg_restore_v=$(pg pg_restore --version)
copy_in "$dump"
echo "Archive: $(pg pg_restore --list "$(dump_in "$dump")" | grep -c -v '^;') entries ($pg_restore_v)"

# --- restore --------------------------------------------------------------------
# The dump holds the public and auth schemas only. Its grants and row-level
# security policies name Supabase's roles, so those must exist first; owners
# are dropped (--no-owner). The extensions schema isn't in the dump; create the
# extensions Supabase keeps there in case a default or index uses one. pg_dump
# always emits CREATE SCHEMA public, so start without one.
say "Restore into a throwaway Postgres $PG_MAJOR"
pg psql "$restore_db" -X -q -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role', 'authenticator', 'dashboard_user',
    'pgbouncer', 'supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin',
    'supabase_functions_admin', 'supabase_realtime_admin', 'supabase_replication_admin',
    'supabase_read_only_user', 'supabase_etl_admin']
  loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;
create schema extensions;
create extension pgcrypto with schema extensions;
create extension "uuid-ossp" with schema extensions;
drop schema public;
SQL
pg pg_restore -d "$restore_db" --no-owner --exit-on-error --single-transaction "$(dump_in "$dump")"
drop_in "$dump"
echo "Restored with no errors."

# --- compare --------------------------------------------------------------------
restored=$(fingerprint restq)
if [ "$use_prod" = false ]; then
  say "Restored row counts"
  printf '%s\n' "$restored" | awk -F'|' '{ printf "  %-26s %8s\n", $1, $2 }'
  finished=true; exit 0
fi
[ "$mode" = fresh ] && live="$after" || live=$(fingerprint prodq)

say "Production vs restore"
fail=0
printf '  %-26s %10s %10s  %s\n' table production restored result
while IFS='|' read -r t n sum; do
  line=$(printf '%s\n' "$live" | grep "^$t|" || true)
  pn=$(echo "$line" | cut -d'|' -f2); psum=$(echo "$line" | cut -d'|' -f3)
  if [ "$n" = "$pn" ] && [ "$sum" = "$psum" ]; then result="same rows, same content"
  elif [ "$n" = "$pn" ]; then result="same count, content differs"
  else result="COUNT DIFFERS"; fi
  if [ "${pn:-0}" -gt 0 ] && [ "$n" -eq 0 ]; then result="EMPTY IN RESTORE"; fail=1; fi
  if [ "$mode" = fresh ] && [ "$result" != "same rows, same content" ]; then fail=1; fi
  printf '  %-26s %10s %10s  %s\n' "$t" "${pn:--}" "$n" "$result"
done <<< "$restored"

# Field-by-field check of the newest DH27BETA application (field names only).
app=$(restq "select a.id from public.applications a join public.events e on e.id = a.event_id
             where e.code = 'DH27BETA' order by a.created_at desc, a.id limit 1")
if [ -n "$app" ]; then
  fields="set timezone = 'UTC'; select key || ' ' || md5(coalesce(value, '<null>'))
          from public.applications a, jsonb_each_text(to_jsonb(a)) where a.id = '$app' order by key"
  diffkeys=$(diff <(restq "$fields" | grep -v '^SET$') <(prodq "$fields" | grep -v '^SET$') \
             | grep -E '^[<>]' | awk '{print $2}' | sort -u | tr '\n' ' ' || true)
  nfields=$(restq "select count(*) from public.applications a, jsonb_each(to_jsonb(a)) where a.id = '$app'")
  if [ -z "$diffkeys" ]; then
    echo "  DH27BETA application $app: all $nfields fields match production"
  else
    echo "  DH27BETA application $app: fields differ from production: $diffkeys"
    [ "$mode" = fresh ] && fail=1
  fi
else
  echo "  (no DH27BETA application in the backup to spot-check)"
fi

if [ "$fail" -ne 0 ]; then
  echo "::error::Restore drill failed: see the table above." >&2
  exit 1
fi
if [ "$mode" = fresh ]; then
  echo "Restore matches production exactly."
else
  echo "Restore OK. Differences above (if any) are changes made in production since the backup was taken."
fi
finished=true
