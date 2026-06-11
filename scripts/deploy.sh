#!/usr/bin/env bash
# Manual deploy helper, run ON the VPS. The GitHub Actions deploy job
# (.github/workflows/deploy.yml) does this automatically on merge to main; this
# script is for hands-on deploys, rollbacks, and first-time bring-up.
#
# Usage (from the repo checkout on the VPS, e.g. /opt/things):
#   scripts/deploy.sh                 # pull + (re)start the whole stack
#   scripts/deploy.sh api-do          # pull + restart only one service
#   TAG=<git-sha> scripts/deploy.sh   # pin a specific image tag (rollback)
#
# Requires infra/.env (gitignored) populated from infra/.env.example.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f ${ROOT}/infra/docker-compose.prod.yml --env-file ${ROOT}/infra/.env"
SERVICE="${1:-}"

if [ ! -f "${ROOT}/infra/.env" ]; then
  echo "Missing ${ROOT}/infra/.env — copy infra/.env.example and fill in secrets." >&2
  exit 1
fi

# Surface THINGS_DOMAIN for the smoke test at the end — `--env-file` only feeds
# compose, not this shell, so without this the smoke step was always skipped.
# Read it surgically (not `source .env`) so a TAG= passed for rollback isn't
# clobbered by .env's own TAG=latest.
export THINGS_DOMAIN="$(grep -E '^THINGS_DOMAIN=' "${ROOT}/infra/.env" | head -n1 | cut -d= -f2-)"

echo "==> TAG=${TAG:-latest}  service=${SERVICE:-<all>}"
# shellcheck disable=SC2086
$COMPOSE pull ${SERVICE}
# --no-deps when targeting a single service so we don't bounce its dependencies.
if [ -n "${SERVICE}" ]; then
  # shellcheck disable=SC2086
  $COMPOSE up -d --no-deps "${SERVICE}"
else
  # shellcheck disable=SC2086
  $COMPOSE up -d
fi

docker image prune -f >/dev/null 2>&1 || true

echo "==> Smoke testing live endpoints"
if [ -n "${THINGS_DOMAIN:-}" ]; then
  node "${ROOT}/scripts/smoke.mjs"
else
  echo "(set THINGS_DOMAIN to run the public smoke test)"
fi

echo "==> Done."
