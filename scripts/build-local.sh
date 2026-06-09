#!/usr/bin/env bash
# Build all Things images locally (native arch) and tag them as the names
# infra/docker-compose.prod.yml expects, so a local `compose up` uses these
# instead of pulling GHCR. Run from the repo root, with infra/.env present.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
set -a; . "${ROOT}/infra/.env"; set +a
: "${THINGS_DOMAIN:?set THINGS_DOMAIN in infra/.env}"
REGISTRY="${REGISTRY:-ghcr.io/ztur211}"
TAG="${TAG:-latest}"
SCHEME="https"

API_APPS=(api-auth api-do api-say api-buy api-eat api-send)
WEB_APPS=(web-do web-say web-buy web-eat web-send)

for app in "${API_APPS[@]}"; do
  echo "==> building ${app}"
  docker build -f "${ROOT}/infra/docker/api.Dockerfile" --build-arg "APP=${app}" \
    -t "${REGISTRY}/things-${app}:${TAG}" "${ROOT}"
done

for app in "${WEB_APPS[@]}"; do
  echo "==> building ${app}"
  docker build -f "${ROOT}/infra/docker/web.Dockerfile" --build-arg "APP=${app}" \
    --build-arg "EXPO_PUBLIC_AUTH_URL=${SCHEME}://auth.${THINGS_DOMAIN}" \
    --build-arg "EXPO_PUBLIC_DO_URL=${SCHEME}://api.do.${THINGS_DOMAIN}" \
    --build-arg "EXPO_PUBLIC_SAY_URL=${SCHEME}://api.say.${THINGS_DOMAIN}" \
    --build-arg "EXPO_PUBLIC_BUY_URL=${SCHEME}://api.buy.${THINGS_DOMAIN}" \
    --build-arg "EXPO_PUBLIC_EAT_URL=${SCHEME}://api.eat.${THINGS_DOMAIN}" \
    --build-arg "EXPO_PUBLIC_SEND_URL=${SCHEME}://api.send.${THINGS_DOMAIN}" \
    -t "${REGISTRY}/things-${app}:${TAG}" "${ROOT}"
done

echo "==> done. Tagged ${REGISTRY}/things-*:${TAG}"
