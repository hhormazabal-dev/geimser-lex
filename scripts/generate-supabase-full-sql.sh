#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migrations_dir="$repo_root/supabase/migrations"
seed_file="$repo_root/supabase/seed.sql"

if [[ ! -d "$migrations_dir" ]]; then
  echo "ERROR: migrations dir not found: $migrations_dir" >&2
  exit 1
fi

echo "-- Generated Supabase bootstrap SQL (public schema objects + RLS)"
echo "-- Source: supabase/migrations + supabase/seed.sql"
echo "-- Generated at (UTC): $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "--"
echo "-- Notes:"
echo "-- - This does not recreate Supabase-managed schemas like auth/storage/realtime."
echo "-- - Run this with an admin connection (service_role / postgres)."
echo

shopt -s nullglob
migration_files="$(ls -1 "$migrations_dir"/*.sql 2>/dev/null | sort || true)"

if [[ -z "${migration_files//[$'\t\r\n ']}" ]]; then
  echo "ERROR: no migration files found in $migrations_dir" >&2
  exit 1
fi

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  rel="${file#"$repo_root/"}"
  echo "-- -----------------------------------------------------------------------------"
  echo "-- FILE: $rel"
  echo "-- -----------------------------------------------------------------------------"
  cat "$file"
  echo
done <<< "$migration_files"

if [[ -f "$seed_file" ]]; then
  echo "-- -----------------------------------------------------------------------------"
  echo "-- FILE: supabase/seed.sql"
  echo "-- -----------------------------------------------------------------------------"
  cat "$seed_file"
  echo
fi
