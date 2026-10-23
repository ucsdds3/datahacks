#!/usr/bin/env bash
# Pull-request rules for supabase/migrations, compared with the base branch:
#   - migrations already on the base branch are never edited, renamed or deleted
#     (production has run them; fix forward with a new migration instead);
#   - new migrations sort after every existing one, or `db push` refuses them.
#
# Usage: check-migrations.sh <base-ref>   (e.g. origin/main)
set -euo pipefail
base="$1"
dir="supabase/migrations"

changed=$(git diff --name-status "$base"...HEAD -- "$dir" | awk '$1 != "A" {print}')
if [ -n "$changed" ]; then
  echo "::error::Existing migrations can't change once they're on the base branch. Add a new migration instead."
  echo "$changed"
  exit 1
fi

latest=$(git ls-tree --name-only "$base" "$dir/" | sed -n 's#.*/\([0-9]\{14\}\)_.*#\1#p' | sort | tail -1)
status=0
for file in $(git diff --name-only --diff-filter=A "$base"...HEAD -- "$dir"); do
  version=$(basename "$file" | cut -c1-14)
  if ! [[ "$version" =~ ^[0-9]{14}$ ]]; then
    echo "::error file=$file::Migration names start with a 14-digit UTC timestamp. Create them with: npx supabase migration new <name>"
    status=1
  elif [ -n "$latest" ] && [ "$version" -le "$latest" ]; then
    echo "::error file=$file::$version isn't newer than the latest migration on the base branch ($latest). Rename it with a current timestamp."
    status=1
  else
    echo "ok: $file"
  fi
done
exit $status
