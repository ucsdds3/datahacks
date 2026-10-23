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
# Skip anything the target already records as applied (for example a PR
# re-run after its migrations reached staging through main).
applied=$(psql "$conn" -X -A -t -c "select version from supabase_migrations.schema_migrations" 2>/dev/null || true)
files=""
for f in $(git diff --name-only --diff-filter=A "$base"...HEAD -- supabase/migrations | sort); do
  version=$(basename "$f" | cut -c1-14)
  if grep -qx "$version" <<< "$applied"; then
    echo "already applied on the target, skipping: $f"
  else
    files+="$f"$'\n'
  fi
done
if [ -z "$files" ]; then
  echo "No new migrations to try."
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
