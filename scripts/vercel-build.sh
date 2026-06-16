#!/usr/bin/env bash
#
# Vercel build for a single Things web app.
#
# Builds the shared @things/* packages in dependency order (Metro resolves each
# package from its built dist/index.js — there are no path aliases or source
# fields), then runs `expo export -p web` for the target app. This mirrors the
# build order in infra/docker/web.Dockerfile so Vercel and Docker stay in sync.
#
# Invoked from each app's vercel.json buildCommand, e.g.:
#   bash ../../scripts/vercel-build.sh web-do
#
# The Vercel project Root Directory is apps/web-<app>, so CWD when this runs is
# that subdir; we resolve the repo root from the script's own location instead.
set -euo pipefail

APP="${1:?usage: vercel-build.sh <web-app>, e.g. web-do}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[vercel-build] building shared @things/* packages…"
npm run build -w @things/types -w @things/design-system -w @things/ai
npm run build -w @things/web-kit

echo "[vercel-build] exporting apps/${APP} (expo export -p web)…"
npm run build -w "apps/${APP}"

echo "[vercel-build] done — static site at apps/${APP}/dist"
