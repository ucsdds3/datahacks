#!/usr/bin/env bash
# Applies this branch's new migrations to a database inside one transaction and
# then rolls it back: proof they run against the real schema, without changing
# it. Used against staging on pull requests, so staging keeps matching main.
#
# Migrations that can't run in a transaction (CREATE INDEX CONCURRENTLY, VACUUM)
# fail here; split those out and apply them by hand.
#
# Usage: PGPASSWORD=... try-migrations.sh <base-ref> "host=... user=... sslmode=require"
set -euo pipefail
base="$1"; conn="$2"
files=$(git diff --name-only --diff-filter=A "$base"...HEAD -- supabase/migrations | sort)
if [ -z "$files" ]; then
  echo "No new migrations on this branch."
  exit 0
fi

script=$(mktemp)
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  for f in $files; do
    echo "\\echo '== $f'"
    echo "\\i $f"
  done
  echo 'rollback;'
} > "$script"
psql "$conn" -X -q -f "$script"
echo "All new migrations applied cleanly and were rolled back."
