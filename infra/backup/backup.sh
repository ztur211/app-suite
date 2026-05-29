#!/usr/bin/env bash
# Nightly Postgres backup (foundation spec §6.5). Dumps every per-app database
# in custom format, keeps a grandfather-father-son rotation locally, and (if
# configured) mirrors to S3-compatible object storage via rclone.
#
# Retention: 7 daily + 4 weekly (Sundays) + 12 monthly (1st of month).
#
# Cron (as root on the VPS), nightly at 03:17:
#   17 3 * * *  /opt/things/infra/backup/backup.sh >> /var/log/things-backup.log 2>&1
#
# Config via environment (sensible defaults shown):
#   PG_CONTAINER   docker container name of Postgres   (default: things-postgres)
#   BACKUP_DIR     local backup root                   (default: /var/backups/things)
#   RCLONE_REMOTE  rclone remote:path for off-box copy (optional; e.g. b2:things-backups)
set -euo pipefail

PG_CONTAINER="${PG_CONTAINER:-things-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/things}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"
DBS="things_auth things_do things_say things_buy things_eat things_send"

DATE="$(date +%F)"          # 2026-05-29
DOW="$(date +%u)"           # 1..7 (7 = Sunday)
DOM="$(date +%d)"           # 01..31

daily="${BACKUP_DIR}/daily"
weekly="${BACKUP_DIR}/weekly"
monthly="${BACKUP_DIR}/monthly"
mkdir -p "$daily" "$weekly" "$monthly"

echo "[backup] $(date -Is) dumping ${DBS}"
for db in $DBS; do
  out="${daily}/${db}-${DATE}.dump"
  # -Fc = custom format (compressed, supports selective pg_restore).
  docker exec "$PG_CONTAINER" pg_dump -U postgres -Fc "$db" > "$out"
  echo "[backup]   ${out} ($(du -h "$out" | cut -f1))"

  # Promote a copy into the weekly/monthly tiers on the right days.
  [ "$DOW" = "7" ] && cp "$out" "${weekly}/${db}-${DATE}.dump"
  [ "$DOM" = "01" ] && cp "$out" "${monthly}/${db}-${DATE}.dump"
done

# Prune each tier (newest-first; delete the overflow).
prune() { # <dir> <keep>
  local dir="$1" keep="$2"
  ls -1t "$dir"/*.dump 2>/dev/null | tail -n "+$((keep * 6 + 1))" | xargs -r rm -f
}
prune "$daily" 7     # 7 days × 6 DBs
prune "$weekly" 4    # 4 weeks × 6 DBs
prune "$monthly" 12  # 12 months × 6 DBs

if [ -n "$RCLONE_REMOTE" ]; then
  echo "[backup] syncing ${BACKUP_DIR} -> ${RCLONE_REMOTE}"
  rclone sync "$BACKUP_DIR" "$RCLONE_REMOTE" --transfers 4 --retries 3
else
  echo "[backup] RCLONE_REMOTE unset — local-only backup. Set it for off-box copies."
fi

echo "[backup] $(date -Is) done."
