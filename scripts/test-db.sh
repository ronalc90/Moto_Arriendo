#!/usr/bin/env bash
# Runs the migrations + balance/RLS tests against a throwaway local PostgreSQL database.
# Requires psql and a running PostgreSQL. Configure with PGHOST/PGPORT/PGUSER if needed.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-moto_arriendo_test}"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/local_stub.sql 2>/dev/null
for f in supabase/migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f" > /dev/null
done
for t in supabase/tests/rls_and_balance_test.sql supabase/tests/phase2_3_test.sql supabase/tests/security_definer_test.sql; do psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$t" 2>&1 | grep -E "NOTICE|ERROR"; done
psql -q -d postgres -c "drop database $DB"
echo "✔ Pruebas de base de datos OK"
