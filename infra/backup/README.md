# Backups & restore drill

Nightly `pg_dump` of every per-app database, with grandfather-father-son
retention and optional off-box mirroring. Foundation spec §6.5.

## What gets backed up

All six databases on the single Postgres instance:
`things_auth`, `things_do`, `things_say`, `things_buy`, `things_eat`,
`things_send` — each dumped with `pg_dump --format=custom` (compressed,
supports selective restore).

## Layout & retention

```
$BACKUP_DIR/
  daily/    last 7 days
  weekly/   last 4 Sundays
  monthly/  last 12 first-of-month
```

`backup.sh` writes a daily dump for each DB, promotes a copy into `weekly/` on
Sundays and `monthly/` on the 1st, then prunes each tier. If `RCLONE_REMOTE`
is set, the whole tree is `rclone sync`'d to S3-compatible storage (Backblaze
B2 / Cloudflare R2 / DO Spaces — pick the one with zero egress to the VPS
region, per spec §12). You may also let the bucket's lifecycle rules enforce
retention server-side.

## Schedule

Cron, as root on the VPS:

```cron
17 3 * * *  /opt/things/infra/backup/backup.sh >> /var/log/things-backup.log 2>&1
```

Config via env (defaults in `backup.sh`): `PG_CONTAINER`, `BACKUP_DIR`,
`RCLONE_REMOTE`.

## Restore drill (run before first real user data lands)

The drill proves a dump actually restores. Do it against a throwaway DB, not a
live one.

1. Create a scratch database owned by the app's role:
   ```sh
   docker exec things-postgres psql -U postgres -c "CREATE DATABASE things_do_drill OWNER do_owner;"
   ```
2. Restore the latest dump into it:
   ```sh
   docker exec -i things-postgres pg_restore -U postgres --dbname things_do_drill \
     --clean --if-exists --no-owner --exit-on-error \
     < /var/backups/things/daily/things_do-$(date +%F).dump
   ```
3. Spot-check row counts against production:
   ```sh
   docker exec things-postgres psql -U postgres -d things_do_drill -c 'SELECT count(*) FROM "Task";'
   ```
4. Drop the scratch DB:
   ```sh
   docker exec things-postgres psql -U postgres -c "DROP DATABASE things_do_drill;"
   ```

## Real recovery

`restore.sh` overwrites an existing database in place (drops + recreates
objects). Take a fresh dump first, then:

```sh
infra/backup/restore.sh things_do /var/backups/things/daily/things_do-2026-05-29.dump
```

After restoring `things_auth`, re-confirm the `auth_reader` grants if you
recreated the database from scratch (the `ALTER DEFAULT PRIVILEGES` in
`init-prod.sh` only covers tables created _after_ it runs).
