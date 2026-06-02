# syntax=docker/dockerfile:1
#
# Shared multi-stage Dockerfile for every Expo + RN-Web app (web-do, web-say,
# web-buy, web-eat, web-send). Builds the static web export (Metro,
# `web.output: "static"`) and serves it with nginx.
#
# EXPO_PUBLIC_* values are inlined into the JS bundle at export time, so the
# API endpoints a given app talks to MUST be passed as build args (they cannot
# be changed at container runtime). web-say currently reads none; the others
# read EXPO_PUBLIC_AUTH_URL plus their own app endpoint.
#
# Build (from repo root):
#   docker build -f infra/docker/web.Dockerfile --build-arg APP=web-do \
#     --build-arg EXPO_PUBLIC_AUTH_URL=https://auth.things.app \
#     --build-arg EXPO_PUBLIC_DO_URL=https://api.do.things.app \
#     -t ghcr.io/ztur211/things-web-do:latest .

FROM node:20-alpine AS build
WORKDIR /repo
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true
# node_modules is .dockerignore'd so this is always a clean install.
COPY . .
# --include=dev for the toolchains (tsc, expo); PATH so the hoisted bins
# resolve for the workspace builds below.
RUN npm ci --include=dev --no-audit --no-fund
ENV PATH="/repo/node_modules/.bin:${PATH}"
# web apps consume @things/design-system from its built dist.
RUN npm run build -w @things/design-system

# EXPO_PUBLIC_* are baked into the bundle by `expo export`.
ARG EXPO_PUBLIC_AUTH_URL
ARG EXPO_PUBLIC_DO_URL
ARG EXPO_PUBLIC_SAY_URL
ARG EXPO_PUBLIC_BUY_URL
ARG EXPO_PUBLIC_EAT_URL
ARG EXPO_PUBLIC_SEND_URL
ENV EXPO_PUBLIC_AUTH_URL=${EXPO_PUBLIC_AUTH_URL} \
    EXPO_PUBLIC_DO_URL=${EXPO_PUBLIC_DO_URL} \
    EXPO_PUBLIC_SAY_URL=${EXPO_PUBLIC_SAY_URL} \
    EXPO_PUBLIC_BUY_URL=${EXPO_PUBLIC_BUY_URL} \
    EXPO_PUBLIC_EAT_URL=${EXPO_PUBLIC_EAT_URL} \
    EXPO_PUBLIC_SEND_URL=${EXPO_PUBLIC_SEND_URL}

ARG APP
RUN test -n "${APP}" || (echo "APP build-arg is required" && exit 1)
# `build` runs `expo export -p web`, emitting the static site to dist/.
RUN npm run build -w "apps/${APP}"

# ---- runtime: static file server ----
FROM nginx:alpine AS runtime
ARG APP
COPY --from=build /repo/apps/${APP}/dist /usr/share/nginx/html
COPY infra/docker/web-nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
