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
# OpenSSL must be present when Prisma selects/downloads engines (npm ci) and
# generates the client (db:generate) so it picks the linux-musl-openssl-3.0.x
# engine matching the runtime stage. Without it, generate emits the generic
# "linux-musl" query engine and the runtime (which detects openssl-3.0.x) fails
# with "Prisma Client could not locate the Query Engine".
RUN apk add --no-cache openssl
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
# Compile only the shared @things/* packages the APIs consume at build+runtime,
# in topological order: dependency-free (types, auth, ai, config) first, then
# the packages that depend on them (do-sdk→auth, say-sdk→auth+types,
# nest-kit→auth). Every API imports @things/config (env schema) and
# @things/nest-kit (PrismaService + bootstrap). Packages no app imports
# (db/design-system/web-kit/buy|eat|send-sdk/testing) are intentionally skipped.
RUN npm run build -w @things/types -w @things/auth -w @things/ai -w @things/config \
 && npm run build -w @things/do-sdk -w @things/say-sdk -w @things/nest-kit
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
# Prisma's engines need OpenSSL at runtime. node:20-alpine ships libssl.so.3 but
# NOT the `openssl` package, so Prisma's version detection fails, defaults to
# openssl-1.1.x, and the engine fails to load ("Error loading shared library").
# Installing openssl lets both the schema engine (`migrate deploy`) and the
# query engine (PrismaClient) load. Must be in the runtime stage (engines load
# here), independent of the big COPY below so it stays cached.
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ARG APP
ENV APP=${APP}
COPY --from=build /repo /repo
# Documentary only — the real port comes from the PORT env var.
EXPOSE 3000
ENTRYPOINT ["sh", "/repo/infra/docker/api-entrypoint.sh"]
