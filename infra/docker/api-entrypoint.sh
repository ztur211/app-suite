#!/bin/sh
# Entrypoint for every API container. Applies the app's OWN Prisma migrations
# (against the database it owns), then launches the NestJS server.
#
# Each app migrates only prisma/schema.prisma — never the read-only
# auth-schema.prisma mirror. api-auth owns things_auth and migrates the auth
# tables; the five domain apps migrate their own things_<app> DB. `migrate
# deploy` is idempotent, so it is safe to run on every container start.
set -eu

: "${APP:?APP env var is required}"
cd "/repo/apps/${APP}"

echo "[entrypoint] ${APP}: applying Prisma migrations (migrate deploy)"
npx prisma migrate deploy --schema=prisma/schema.prisma

echo "[entrypoint] ${APP}: starting server on PORT=${PORT:-<default>}"
exec node dist/main
