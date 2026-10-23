#!/usr/bin/env bash
# Prints a comparable snapshot of the schema we own: the public schema and its
# grants, plus our storage policies and Realtime membership. Two databases built the same way
# print the same text, so `diff` of two snapshots shows drift.
#
# Usage: PGPASSWORD=... schema-snapshot.sh "host=... port=5432 dbname=postgres user=... sslmode=require"
set -euo pipefail
conn="$1"

pg_dump "$conn" --schema-only --schema=public --no-owner --no-comments --no-privileges \
  | grep -vE '^(--|SET |SELECT pg_catalog\.set_config|\\(un)?restrict )' \
  | grep -v '^CREATE SCHEMA public;$' \
  | sed '/^$/d'

echo "-- grants"
pg_dump "$conn" --schema-only --schema=public --no-owner | grep -E '^(GRANT|REVOKE) ' | sort

echo "-- storage policies"
psql "$conn" -X -A -t -v ON_ERROR_STOP=1 -c "
  set search_path = '';
  select policyname || ' | ' || cmd || ' | ' || array_to_string(roles, ',') || ' | '
         || coalesce(qual, '') || ' | ' || coalesce(with_check, '')
  from pg_policies where schemaname = 'storage' and tablename = 'objects' order by 1;"

echo "-- realtime"
psql "$conn" -X -A -t -v ON_ERROR_STOP=1 -c "
  select schemaname || '.' || tablename from pg_publication_tables
  where pubname = 'supabase_realtime' order by 1;"
