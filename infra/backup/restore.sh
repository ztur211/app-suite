#!/usr/bin/env bash
# Restore a single per-app database from a custom-format dump produced by
# backup.sh. Used for the restore drill (foundation spec §6.5) and real
# recovery.
#
#   infra/backup/restore.sh things_do /var/backups/things/daily/things_do-2026-05-29.dump
#
# DANGER: this DROPs and recreates the target database's schema. Never point it
# at a database with data you need unless you mean it. Take a fresh dump first.
set -euo pipefail

DB="${1:?usage: restore.sh <db-name> <dump-file>}"
DUMP="${2:?usage: restore.sh <db-name> <dump-file>}"
PG_CONTAINER="${PG_CONTAINER:-things-postgres}"

if [ ! -f "$DUMP" ]; then
  echo "Dump not found: $DUMP" >&2
  exit 1
fi

echo "About to restore '${DB}' from '${DUMP}' into container '${PG_CONTAINER}'."
echo "This overwrites the current contents of ${DB}. Ctrl-C to abort."
sleep 5

# --clean --if-exists drops objects before recreating; pipe the dump into
# pg_restore running inside the container.
docker exec -i "$PG_CONTAINER" pg_restore \
  --username postgres \
  --dbname "$DB" \
  --clean --if-exists --no-owner --exit-on-error \
  < "$DUMP"

echo "Restore of ${DB} complete."
