# syntax=docker/dockerfile:1
#
# Shared multi-stage Dockerfile for every NestJS API app (api-auth, api-do,
# api-say, api-buy, api-eat, api-send). The build context is the MONOREPO ROOT
# because each app resolves its `@things/*` workspace dependencies from their
# built `dist/` (the packages publish `main: dist/index.js`, and the apps use
# no tsconfig path aliases). So the shared packages must be compiled before the
# app, in dependency order.
#
# Build (from repo root):
#   docker build -f infra/docker/api.Dockerfile --build-arg APP=api-do \
#     -t ghcr.io/ztur211/things-api-do:latest .
#
# Runtime env (injected by docker-compose.prod.yml): DATABASE_URL, PORT,
# BETTER_AUTH_SECRET, BETTER_AUTH_URL, and per-app extras (AUTH_DATABASE_URL,
# SERVICE_TOKEN_SECRET, DO_API_URL, SAY_API_URL, OPENAI_API_KEY,
# ANTHROPIC_API_KEY, TMP_AUDIO_DIR). The entrypoint runs `prisma migrate
# deploy` against the app's OWN database before starting the server.

FROM node:20-alpine AS build
WORKDIR /repo
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true
# .npmrc (legacy-peer-deps=true) + lockfile come in via the full copy below.
# node_modules is .dockerignore'd so this is always a clean install.
COPY . .
# --include=dev: build needs the toolchains (tsc, nest, prisma) which are
# devDependencies. --no-audit --no-fund trims post-install work. PATH: make the
# hoisted workspace bins resolve for every `npm run build -w <pkg>` below (npm
# doesn't reliably add the root .bin to PATH for single-workspace script runs).
RUN npm ci --include=dev --no-audit --no-fund
ENV PATH="/repo/node_modules/.bin:${PATH}"
# Compile only the shared @things/* packages the APIs consume at runtime, in
# topological order: dependency-free (types, auth, ai) first, then the SDKs
# that depend on them (do-sdk→auth, say-sdk→auth+types). Packages no app
# imports at runtime (config/db/design-system/buy|eat|send-sdk/testing) are
# intentionally skipped.
RUN npm run build -w @things/types -w @things/auth -w @things/ai \
 && npm run build -w @things/do-sdk -w @things/say-sdk
ARG APP
RUN test -n "${APP}" || (echo "APP build-arg is required" && exit 1)
# Generate the Prisma client(s) for this app, then compile it.
RUN npm run db:generate -w "apps/${APP}" \
 && npm run build -w "apps/${APP}"

# ---- runtime ----
# Ship the whole built workspace: NestJS resolves workspace deps + the
# generated Prisma client via node_modules, and the entrypoint needs the
# Prisma CLI (a devDependency) for `migrate deploy`, so we deliberately do NOT
# prune devDependencies.
FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
ARG APP
ENV APP=${APP}
COPY --from=build /repo /repo
# Documentary only — the real port comes from the PORT env var.
EXPOSE 3000
ENTRYPOINT ["sh", "/repo/infra/docker/api-entrypoint.sh"]
