# Local single-machine deploy + cross-subdomain auth — design

> **Status:** approved design, pre-implementation. Date: 2026-06-09.
> **Sub-skill for implementation:** `superpowers:writing-plans` → `superpowers:test-driven-development`.

## Goal

Run the full Things production Docker stack on a single Linux machine, reachable from a browser **on that machine**, with working end-to-end login. This replaces the abandoned cloud/VPS path (Oracle ARM) — same `docker-compose.prod.yml`, plus a thin local layer and one real app fix.

Two parts:

- **Part A — Local deploy layer:** build images on the box (native arch, no GHCR), serve the prod subdomains under a local domain with Caddy's internal CA.
- **Part B — Cross-subdomain auth fix:** make Better Auth's cookie scope + trusted/CORS origins env-driven so a session issued at `auth.<domain>` is valid across `do.<domain>`, `api.do.<domain>`, etc. This is the prod follow-up already flagged in `infra/README.md` ("Cross-subdomain session cookies"), so it fixes prod too — not throwaway local-only work.

## Non-goals

- Public internet access, real TLS/Let's Encrypt, or DNS (local CA only).
- LAN/multi-device access (single machine only; the design doesn't preclude LAN later — it's just `/etc/hosts` on other devices).
- Changing the prod CI/deploy workflow (`deploy.yml`) or the GHCR pull path. The arm64 build branch (`feat/arm64-deploy-images`) is set aside — local builds are native.
- Touching the Wildcard-TLS or Redis follow-ups.

## Decisions (with rejected alternatives)

- **Local domain `things.test`** (RFC 6761 reserved for testing). Rejected `.local` (Linux mDNS/avahi intercepts it) and `.localhost` (subdomain handling varies).
- **HTTPS via Caddy's internal CA**, not plain HTTP. Better Auth session cookies are `Secure`; HTTP would silently break login. Cost: trust Caddy's root cert once on the box.
- **Build images locally**, tagged as the names the compose already expects (`ghcr.io/ztur211/things-*:latest`). Rejected pulling GHCR (private + the web bundles bake `THINGS_DOMAIN` URLs at build time, which would be wrong for local).
- **Env-driven origins/cookie-domain**, not hardcoded. Today `auth.ts` and `main.ts` hardcode `localhost:8081-8085`; we derive web origins from `THINGS_DOMAIN` so the same code serves local (`things.test`) and prod (`things.app`).

---

## Part A — Local deploy layer

### A1. Hostnames (`/etc/hosts` on the box)

```
127.0.0.1  auth.things.test api.do.things.test api.say.things.test api.buy.things.test api.eat.things.test api.send.things.test do.things.test say.things.test buy.things.test eat.things.test send.things.test
```

### A2. TLS — Caddy internal CA, parameterized (single Caddyfile)

Add one env-substituted line to the **existing** `infra/Caddyfile` global block:

```
{
	email {$ACME_EMAIL}
	{$CADDY_EXTRA_GLOBAL}
}
```

- **Prod:** `CADDY_EXTRA_GLOBAL` unset → empty line → unchanged (Let's Encrypt).
- **Local:** `CADDY_EXTRA_GLOBAL=local_certs` → Caddy issues all certs from its **internal CA**. No routing duplicated; no separate Caddyfile.

One-time on the box: trust Caddy's root cert (exported from the `caddy-data` volume at `/data/caddy/pki/authorities/local/root.crt`) in the system/browser trust store.

### A3. Build locally — `scripts/build-local.sh`

Builds all 11 app images via the existing Dockerfiles (which already take `ARG APP`), tags each as `${REGISTRY}/things-<app>:${TAG}` (defaults `ghcr.io/ztur211` / `latest`) so the compose `image:` refs resolve to the local builds. Web images get local `EXPO_PUBLIC_*` build args:

```
EXPO_PUBLIC_AUTH_URL=https://auth.things.test
EXPO_PUBLIC_DO_URL=https://api.do.things.test   # …say/buy/eat/send
```

Reads `THINGS_DOMAIN` + scheme from `infra/.env`, so the same script works for any local domain.

### A4. Compose override — `infra/docker-compose.local.yml`

Merged on top of the prod compose (`-f docker-compose.prod.yml -f docker-compose.local.yml`):

- `pull_policy: never` on every app service → use the locally-built images, never reach GHCR.
- `caddy.environment.CADDY_EXTRA_GLOBAL: local_certs`.
- No structural changes — same network, volumes, healthchecks.

### A5. Local `infra/.env`

From `infra/.env.example` (extended — see Part B for the new vars):

```
THINGS_DOMAIN=things.test
AUTH_COOKIE_DOMAIN=.things.test
CADDY_EXTRA_GLOBAL=local_certs
ACME_EMAIL=local@things.test          # required by compose; unused with local_certs
# generated: POSTGRES_PASSWORD, *_OWNER_PASSWORD, AUTH_READER_PASSWORD,
#            BETTER_AUTH_SECRET, SERVICE_TOKEN_SECRET
# OPENAI_API_KEY / ANTHROPIC_API_KEY — OPTIONAL (only api-say's AI classification)
```

### A6. Bring-up procedure

1. Clone the repo onto the box (HTTPS if the repo is public; a read-only deploy key or PAT if private).
2. Write `/etc/hosts` (A1) and `infra/.env` (A5; generate secrets with `openssl rand -base64 36`).
3. `scripts/build-local.sh` (builds + tags all 11 images natively).
4. `docker compose -f infra/docker-compose.prod.yml -f infra/docker-compose.local.yml --env-file infra/.env up -d`.
5. Each API runs `prisma migrate deploy` on start (existing entrypoint). Trust Caddy's root cert (A2). Open `https://do.things.test`.

---

## Part B — Cross-subdomain auth fix

### B1. The problem

`apps/*/src/auth/auth.ts` sets `trustedOrigins` from a hardcoded `localhost:8081-8085`, and `apps/*/src/main.ts` does the same for `enableCors`. Better Auth scopes the session cookie to the issuing host (`auth.<domain>`), so the browser never sends it to `do.<domain>` / `api.do.<domain>`. Result: login at the auth app doesn't authenticate the others.

### B2. Shared origins helper (`@things/auth`)

New exported helper, used by both `main.ts` and `auth.ts` in all 6 APIs to kill the duplicated origin logic:

```ts
// packages/auth/src/origins.ts
export function trustedWebOrigins(env = process.env): string[];
// → [https://{do,say,buy,eat,send}.$THINGS_DOMAIN]  (only when THINGS_DOMAIN set)
//   ALWAYS also includes the localhost:8081-8085 dev origins (keeps `npm run dev` working)

export function authCookieDomain(env = process.env): string | undefined;
// → env.AUTH_COOKIE_DOMAIN (e.g. ".things.test" / ".things.app"); undefined → no override
```

### B3. `auth.ts` change (all 6 apps)

```ts
trustedOrigins: [ <own BETTER_AUTH_URL>, ...trustedWebOrigins() ],
advanced: authCookieDomain()
  ? { crossSubDomainCookies: { enabled: true, domain: authCookieDomain() } }
  : {},
```

`crossSubDomainCookies.domain = .things.test` makes the cookie parent-scoped, so the browser sends it to every subdomain. SameSite stays `Lax` — `do.things.test → api.do.things.test` are **same-site** (one registrable domain), so Lax cookies are sent on those XHRs; no `SameSite=None` needed. Applied to all 6 apps for consistency (api-auth is the issuer; the others validate).

### B4. `main.ts` CORS change (all 6 apps)

```ts
app.enableCors({ origin: trustedWebOrigins(), credentials: true });
```

### B5. Env plumbing

The API containers don't currently receive `THINGS_DOMAIN`. Add to **each API service** in `docker-compose.prod.yml` (benefits prod too):

```
THINGS_DOMAIN: ${THINGS_DOMAIN}
AUTH_COOKIE_DOMAIN: ${AUTH_COOKIE_DOMAIN:-}
```

Document `AUTH_COOKIE_DOMAIN` in `infra/.env.example` (`.things.app` prod / `.things.test` local).

---

## Testing (TDD)

- **`@things/auth` unit tests** for `trustedWebOrigins` / `authCookieDomain`: domain set vs unset, dev origins always present, correct 5 subdomains.
- **Per-app auth-config unit test** (extend existing `auth` specs): with `THINGS_DOMAIN`/`AUTH_COOKIE_DOMAIN` set, `auth.options.trustedOrigins` includes the web origins and `advanced.crossSubDomainCookies.domain` matches env; with them unset, falls back to dev origins and no cookie override (proves prod-safe + dev-safe).
- **No integration/e2e expansion** — the existing cross-app e2e covers session flow at the service layer; browser cross-subdomain behavior is validated manually via the bring-up (login at `auth.things.test`, confirm authenticated calls to `api.do.things.test`).
- All changes keep `npm run lint` / `typecheck` / `test:unit` green (the dev-origin fallback preserves the existing `npm run dev` flow).

## File map

| Path                                                                       | Action                                                                     |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/auth/src/origins.ts` (+ test)                                    | Create — shared origin/cookie-domain helpers                               |
| `packages/auth/src/index.ts`                                               | Modify — export the helpers                                                |
| `apps/{api-auth,api-do,api-say,api-buy,api-eat,api-send}/src/auth/auth.ts` | Modify — env-driven `trustedOrigins` + `crossSubDomainCookies`             |
| `apps/{…6…}/src/main.ts`                                                   | Modify — env-driven CORS origins                                           |
| `apps/{…6…}/src/auth/__tests__/*.spec.ts`                                  | Modify — assert env-driven values                                          |
| `infra/Caddyfile`                                                          | Modify — add `{$CADDY_EXTRA_GLOBAL}` to global block                       |
| `infra/docker-compose.prod.yml`                                            | Modify — pass `THINGS_DOMAIN`/`AUTH_COOKIE_DOMAIN` to each API             |
| `infra/docker-compose.local.yml`                                           | Create — `pull_policy: never` + `CADDY_EXTRA_GLOBAL=local_certs`           |
| `infra/.env.example`                                                       | Modify — document `AUTH_COOKIE_DOMAIN`, `CADDY_EXTRA_GLOBAL`, local values |
| `scripts/build-local.sh`                                                   | Create — build + tag all 11 images with local URLs                         |
| `infra/README.md`                                                          | Modify — add "Local single-machine deploy" section                         |

## Acceptance

- `scripts/build-local.sh` + `compose up` brings all 13 containers healthy on the box.
- `https://do.things.test` (and the other 4 web apps) load over HTTPS (local CA trusted).
- Logging in at `auth.things.test` results in an authenticated session usable at `do.things.test` → `api.do.things.test` (the cross-subdomain fix).
- `lint` / `typecheck` / `test:unit` stay green; `npm run dev` (localhost flow) still works.

## Open questions / risks

- **Repo clone auth on the box** if `ztur211/things` is private (HTTPS+PAT vs a read-only deploy key) — setup detail, not code.
- **Box architecture** (amd64 vs ARM): build-local is native either way; if it's a low-RAM ARM SBC, may need compose resource limits (out of scope unless it OOMs).
- **`crossSubDomainCookies` on consumer apps**: harmless but unnecessary (only the issuer sets the cookie); kept uniform for simplicity — revisit if Better Auth warns.
