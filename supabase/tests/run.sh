#!/usr/bin/env bash
# Database tests on a throwaway local Postgres 17: no Supabase project is touched.
# For each supabase/tests/*.test.sql: a fresh database gets the Supabase stubs
# (supabase-stubs.sql) and every migration in order, then the test runs. A test
# fails by raising an exception.
#
# Usage: supabase/tests/run.sh
# Finds Postgres in $PG_BIN, Postgres.app, or on PATH (initdb, pg_ctl, psql).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"

bin="${PG_BIN:-}"
if [ -z "$bin" ] && [ -x /Applications/Postgres.app/Contents/Versions/latest/bin/initdb ]; then
  bin=/Applications/Postgres.app/Contents/Versions/latest/bin
fi
if [ -z "$bin" ]; then bin="$(dirname "$(command -v initdb)")"; fi

tmp="$(mktemp -d)"
port=$(( 20000 + RANDOM % 20000 ))
cleanup() { "$bin/pg_ctl" -D "$tmp/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT

"$bin/initdb" -D "$tmp/data" -U postgres -A trust >/dev/null
"$bin/pg_ctl" -D "$tmp/data" -l "$tmp/log" -w \
  -o "-p $port -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" start >/dev/null

psql=("$bin/psql" -h 127.0.0.1 -p "$port" -U postgres -X -q -v ON_ERROR_STOP=1)
status=0
for test in "$here"/*.test.sql; do
  name="$(basename "$test" .test.sql)"
  db="t_${name//[^a-zA-Z0-9]/_}"
  "${psql[@]}" -d postgres -c "create database $db" >/dev/null
  "${psql[@]}" -d "$db" -f "$here/supabase-stubs.sql" >/dev/null 2>&1
  for m in "$root"/supabase/migrations/*.sql; do
    "${psql[@]}" -d "$db" -f "$m" >/dev/null 2>"$tmp/err" || { echo "FAIL $name: migration $(basename "$m")"; cat "$tmp/err"; exit 1; }
  done
  echo "== $name"
  out="$(cd "$here" && "${psql[@]}" -d "$db" -1 -f "$test" 2>&1)" && rc=0 || rc=$?
  sed -n 's/.*NOTICE:  //p; s/.*ERROR:  /ERROR: /p' <<< "$out"
  [ $rc -eq 0 ] || status=1
done
[ $status -eq 0 ] && echo "All database tests passed." || echo "Database tests failed."
exit $status
