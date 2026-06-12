# Local Deploy + Cross-Subdomain Auth — Implementation Plan (executed)

> **Status:** ✅ executed and merged — PR #4 (local-deploy layer + cross-subdomain
> auth), PR #6 (the `scripts/bring-up-local.sh` one-command tooling). This is the
> condensed record; the verbatim per-step code that used to live here now lives in
> the committed files cited per task. Original plan dated 2026-06-09.
>
> **Spec:** `docs/superpowers/specs/2026-06-09-local-deploy-and-cross-subdomain-auth-design.md`

**Goal:** Run the prod Docker stack on one Linux machine (`*.things.test`, Caddy
internal CA, locally-built images) with end-to-end login working via env-driven
cross-subdomain Better Auth cookies.

**Architecture:** A shared `@things/auth` helper derives the trusted web origins +
cookie domain from `THINGS_DOMAIN`/`AUTH_COOKIE_DOMAIN`; all 6 APIs use it for
`trustedOrigins`, CORS, and `crossSubDomainCookies`. A thin local Docker layer
(build script + compose overlay + a one-line Caddy toggle) reuses the prod compose
unchanged. Code was TDD'd in the sandbox (jest/tsc); the Docker bring-up is verified
on the box (Task 10).

**Stack:** NestJS 11, Better Auth 1.x, Docker Compose, Caddy 2 (`local_certs`),
Jest 29 + @swc/jest, TypeScript 5.6.

## File map (where the implementation landed)

| Path                                                                       | Responsibility                                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/auth/src/origins.ts` (+ `__tests__/origins.test.ts`)             | Pure helpers `trustedWebOrigins(env)`, `authCookieDomain(env)`                             |
| `packages/auth/src/index.ts`                                               | Re-export the helpers                                                                      |
| `apps/{api-auth,api-do,api-say,api-buy,api-eat,api-send}/src/auth/auth.ts` | Helper-driven `trustedOrigins` + conditional `crossSubDomainCookies`                       |
| `apps/{…6…}/src/main.ts`                                                   | Helper-driven `enableCors` origins                                                         |
| `apps/{api-auth,api-do}/package.json`                                      | Added `@things/auth` dep (the other 4 already had it)                                      |
| `infra/docker-compose.prod.yml`                                            | Pass `THINGS_DOMAIN`/`AUTH_COOKIE_DOMAIN` to each API                                      |
| `infra/Caddyfile`                                                          | `{$CADDY_EXTRA_GLOBAL}` global toggle (empty = Let's Encrypt, `local_certs` = internal CA) |
| `infra/docker-compose.local.yml`                                           | Overlay: `pull_policy: never` + `local_certs`                                              |
| `scripts/build-local.sh`                                                   | Build + tag all 11 images with local `EXPO_PUBLIC_*` URLs                                  |
| `infra/.env.example`, `infra/README.md`                                    | Document local vars + bring-up                                                             |

## Tasks (as executed)

1. **`@things/auth` origins helper (TDD).** `trustedWebOrigins(env)` → `https://{do,say,buy,eat,send}.$THINGS_DOMAIN` when `THINGS_DOMAIN` is set, **plus** the localhost:8081-8085 Expo dev origins always; `authCookieDomain(env)` → `AUTH_COOKIE_DOMAIN` or `undefined`. Unit-tested (domain set/unset, dev origins always present, exact 5 subdomains).
2. **Add `@things/auth` dep to api-auth + api-do** (the other 4 already depended on it); `npm install` to link the workspace symlink.
3. **Wire `auth.ts` in all 6 apps.** Import the helpers, delete each file's local `devWebOrigins` const, set `trustedOrigins: [<own BETTER_AUTH_URL>, ...trustedWebOrigins()]`, and conditionally add `advanced.crossSubDomainCookies` when `authCookieDomain()` is set. api-do additionally made its own-URL fallback env-driven. SameSite stays `Lax` — the web/api subdomains are same-site (one registrable domain), so no `SameSite=None` needed.
4. **Wire `main.ts` CORS in all 6 apps.** Replace the duplicated `devWebOrigins` block with `enableCors({ origin: trustedWebOrigins(), credentials: true })`.
5. **Pass `THINGS_DOMAIN`/`AUTH_COOKIE_DOMAIN` to each API container** in `docker-compose.prod.yml` (`AUTH_COOKIE_DOMAIN` defaults empty → host-scoped cookies in prod until set). Benefits prod, not just local.
6. **Caddyfile internal-CA toggle.** Add `{$CADDY_EXTRA_GLOBAL}` to the global block — empty in prod (Let's Encrypt), `local_certs` locally. No routing duplicated; no separate Caddyfile.
7. **Local compose overlay** (`docker-compose.local.yml`): `pull_policy: never` on every app service + `caddy.environment.CADDY_EXTRA_GLOBAL: local_certs`. No structural changes (same network, volumes, healthchecks).
8. **Local build script** (`scripts/build-local.sh`): builds all 11 images via the existing `ARG APP` Dockerfiles, tags them as the GHCR names the compose expects (so `compose up` resolves to local builds), and bakes local `EXPO_PUBLIC_*` URLs into the web bundles. Reads `THINGS_DOMAIN` from `infra/.env`.
9. **Document local vars + bring-up** in `infra/.env.example` (`AUTH_COOKIE_DOMAIN`, `CADDY_EXTRA_GLOBAL`) and `infra/README.md` ("Local single-machine deploy").
10. **Bring-up + acceptance (on the Linux box).** `docker compose … config` → `build-local.sh` → `compose up -d` → all containers healthy → trust Caddy's internal CA → load `https://do.things.test` → **acceptance:** log in at `auth.things.test`, confirm authenticated calls to `api.do.things.test` (cross-subdomain cookie); spot-check one more app. Later tooled into one command by `scripts/bring-up-local.sh` (PR #6).

## Testing approach

`@things/auth` helpers are unit-tested. Per-app wiring is covered by `typecheck`
(all 6 resolve + call the helper) plus the apps' existing auth specs staying green.
We deliberately do **not** assert on Better Auth's internal `auth.options` shape
(implementation-fragile) — the deterministic logic lives in, and is tested in, the
helper. Browser cross-subdomain behaviour is validated manually via the bring-up.
`lint`/`typecheck`/`test:unit` stay green; `npm run dev` (localhost flow) still
works via the dev-origin fallback.

## Lessons / notes

- **Sandbox vs box:** Tasks 1–9 are sandbox-verifiable (jest + tsc, no Docker);
  Task 10 needs Docker and runs on the box.
- **Rebuild `@things/auth`** (`npm run build -w @things/auth`) before app typecheck —
  apps resolve `@things/*` via built `dist/`, not source.
- **`deploy.yml` was left untouched here**; it was later gated to
  `workflow_dispatch`-only (PR #5), since deploy is local now and the SSH step
  targets a VPS that no longer exists.
- **Secret generation:** use `openssl rand -hex 32`, **not** base64 — base64's
  `+`/`/` corrupt the `postgresql://` connection URLs (caught while building
  `bring-up-local.sh`; the README + spec were corrected to match).
