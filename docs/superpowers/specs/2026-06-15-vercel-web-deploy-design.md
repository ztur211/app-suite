# Vercel web deploy + cross-site auth — design

> **Status:** 🟡 proposed (2026-06-15). Supersedes the web half of the
> Docker/Caddy deploy path (`infra/docker/web.Dockerfile`, the `build-webs`
> job in `deploy.yml`, and the `do.$THINGS_DOMAIN` Caddy sites).
> **Sub-skill for implementation:** `superpowers:writing-plans` → `superpowers:test-driven-development`.

## Goal

Host the five Expo + RN-Web apps (`web-do`, `web-say`, `web-buy`, `web-eat`,
`web-send`) on **Vercel** instead of nginx-in-Docker-behind-Caddy. The six
NestJS APIs stay as Docker containers on a VPS behind Caddy on the real
`$THINGS_DOMAIN` (e.g. `auth.things.app`, `api.do.things.app`).

This is a deliberate split: Vercel's static/CDN hosting is a great fit for the
`expo export -p web` output; the APIs (Prisma, Socket.io + Redis adapter,
long-lived connections) are not a serverless fit and remain on Docker.

## The consequence that drives the work

Web on `*.vercel.app` + APIs on `*.things.app` means **web ↔ API is now
cross-site** (different registrable domains). The current auth model breaks:

- Better Auth issues the session as a cookie scoped to `.$THINGS_DOMAIN`
  (`crossSubDomainCookies`). A browser at `things-do.vercel.app` will **never**
  send a `.things.app` cookie to `api.do.things.app` — wrong site.
- Even setting `SameSite=None; Secure`, the cookie set by `auth.things.app` on
  a fetch from `*.vercel.app` is a **third-party cookie** relative to the
  top-level site. Safari (ITP) blocks these outright; Chrome is phasing them
  out. Cookie auth is not viable in this topology.

So the substantive change is **cookie-based → token-based (Bearer) auth**. The
good news (see §"Why this is small"): the codebase is already shaped for it.

## Non-goals

- Moving the APIs to Vercel functions or any serverless platform (explicitly
  out of scope — APIs stay on Docker/VPS).
- Custom domains for the web apps (`do.things.app` on Vercel). We use the free
  `*.vercel.app` domains. A later pass can add custom domains; if/when web and
  API share `things.app` again, the cookie path could return — but Bearer auth
  works in both topologies, so there's no reason to revert it.
- Native (iOS/Android) auth/token storage. Scope here is **web** only;
  token storage uses `localStorage` with an in-memory fallback. A React Native
  `AsyncStorage` adapter is a later, additive change.
- Realtime (Socket.io) auth over Bearer — no web app consumes the realtime
  channel yet; revisit when one does.
- Changing the API deploy path (`deploy.yml` build-apis + VPS SSH) beyond
  removing the now-dead `build-webs` web-image job.

## Why this is small (current code already fits Bearer)

- **`AbstractSessionGuard`** (`packages/nest-kit/src/session.guard.ts`) copies
  **every** inbound request header — including `Authorization` — into the
  `Headers` it passes to `auth.api.getSession()`. With Better Auth's `bearer`
  plugin enabled, `getSession` reads the `Authorization: Bearer <token>` header
  automatically. **The guards need zero changes.**
- **CORS is centralized** in `bootstrapThingsApp`
  (`packages/nest-kit/src/bootstrap.ts`) — one `enableCors` call for all six
  APIs.
- **The web origin allowlist is one function** — `trustedWebOrigins()`
  (`packages/auth/src/origins.ts`) — feeding both CORS and Better Auth
  `trustedOrigins`. Add the Vercel origins there once.
- **The web client is thin** — `packages/web-kit/src/{request,auth-api,auth-store}.ts`.
  Token capture/attach lives in three small files.

---

## Part A — Vercel web deployment

### A1. Topology: 5 Vercel projects, one per web app

Each web app is an independent site → one Vercel project each
(`things-do`, `things-say`, `things-buy`, `things-eat`, `things-send`). They
share the monorepo but build independently.

### A2. Monorepo build (per project)

**Root Directory** (Vercel project setting) = `apps/web-<app>`. Vercel detects
the npm-workspace root via the repo-root lockfile and installs there. The build
command builds the shared `@things/*` packages first (same dependency order as
`web.Dockerfile`), then exports the app:

```
cd ../.. \
 && npm run build -w @things/types -w @things/design-system -w @things/ai \
 && npm run build -w @things/web-kit \
 && npm run build -w apps/web-<app>
```

`npm run build` in a web app is `expo export -p web` → emits static site to
`apps/web-<app>/dist`. **Output Directory** (relative to Root Directory) =
`dist`.

This is captured in a committed **`apps/web-<app>/vercel.json`** per app, so
config is version-controlled, not dashboard-only. A shared helper script
`scripts/vercel-build.sh <app>` holds the build sequence so the five
`vercel.json` files stay DRY and match the Dockerfile ordering in one place.

### A3. SPA routing + asset caching (replicate `web-nginx.conf`)

The current nginx config (`infra/docker/web-nginx.conf`) does
`try_files $uri $uri.html $uri/ /index.html` and long-caches
`/_expo/` + `/assets/`. On Vercel, in each `vercel.json`:

```jsonc
{
  "cleanUrls": true, // /login -> serves login.html
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/_expo/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }],
    },
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }],
    },
  ],
}
```

Vercel checks the filesystem **before** applying `rewrites`, so real files
(`/_expo/*`, `/assets/*`, per-route `*.html`) are served directly and only
genuinely-missing paths fall back to `index.html` — exactly nginx's behaviour.
(`/healthz` is dropped — it existed for the compose healthcheck, which Vercel
doesn't use.)

### A4. Build-time env vars (per project, in Vercel settings)

`EXPO_PUBLIC_*` are inlined into the JS bundle at export time (cannot change at
runtime), so they are **Vercel Environment Variables** (Production + Preview),
mirroring the old Docker `--build-arg`s:

| App        | Vars                                                                           |
| ---------- | ------------------------------------------------------------------------------ |
| `web-do`   | `EXPO_PUBLIC_AUTH_URL=https://auth.$D`, `EXPO_PUBLIC_DO_URL=https://api.do.$D` |
| `web-say`  | `EXPO_PUBLIC_AUTH_URL=…`, `EXPO_PUBLIC_SAY_URL=https://api.say.$D`             |
| `web-buy`  | `EXPO_PUBLIC_AUTH_URL=…`, `EXPO_PUBLIC_BUY_URL=https://api.buy.$D`             |
| `web-eat`  | `EXPO_PUBLIC_AUTH_URL=…`, `EXPO_PUBLIC_EAT_URL=https://api.eat.$D`             |
| `web-send` | `EXPO_PUBLIC_AUTH_URL=…`, `EXPO_PUBLIC_SEND_URL=https://api.send.$D`           |

(`$D` = the real API domain, e.g. `things.app`.) Documented in `infra/VERCEL.md`.

### A5. Deploys

Vercel's Git integration auto-deploys: **Production** on push to `main`,
**Preview** per PR. No GitHub Action needed for web (the API workflow is
untouched). Account/project linking is a one-time manual step (see Open
questions) — captured as a checklist in `infra/VERCEL.md`.

---

## Part B — Cross-site Bearer auth

### B1. Server: enable the `bearer` plugin (all 6 APIs)

```ts
// apps/*/src/auth/auth.ts
import { bearer } from 'better-auth/plugins';

export const auth = betterAuth({
  …existing…,
  plugins: [bearer()],
});
```

Effect: `getSession` accepts `Authorization: Bearer <token>` (the guard already
forwards it), and sign-in/sign-up responses include the token in the
`set-auth-token` response header. The cookie is still set too — harmless;
same-site local dev keeps working via cookies, cross-site web uses the token.

`better-auth@^1.6.11` (already installed) ships `bearer` from
`better-auth/plugins`.

### B2. Server: expose the token header + allow Vercel origins (CORS)

In `bootstrapThingsApp` (`packages/nest-kit/src/bootstrap.ts`):

```ts
app.enableCors({
  origin: trustedWebOrigins(),
  credentials: true,
  exposedHeaders: ['set-auth-token'], // NEW — JS can't read custom CORS response headers otherwise
});
```

`exposedHeaders` is **required**: without `Access-Control-Expose-Headers:
set-auth-token`, the browser hides that header from the web app's JS on the
cross-origin sign-in response, and the client can never capture the token.

### B3. Server: add Vercel origins to the allowlist (`origins.ts`)

Extend `trustedWebOrigins()` with an env-driven list (keeps it pure + testable):

```ts
// WEB_ORIGINS: comma-separated absolute origins, e.g.
// "https://things-do.vercel.app,https://things-say.vercel.app,…"
export function trustedWebOrigins(env = process.env): string[] {
  const domain = env['THINGS_DOMAIN'];
  const prod = domain ? WEB_APPS.map((a) => `https://${a}.${domain}`) : [];
  const extra = (env['WEB_ORIGINS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...prod, ...extra, ...devWebOrigins];
}
```

`WEB_ORIGINS` is set on each API container (`docker-compose.prod.yml` env +
`infra/.env`). The existing `https://{app}.$THINGS_DOMAIN` entries stay (cheap,
and they're correct if web ever gets custom domains).

**Preview deploys:** Vercel preview URLs are per-deploy
(`things-do-<hash>-<scope>.vercel.app`) and cannot be enumerated. Decision:
production pins the five exact origins; **previews are not added to the API
allowlist** (login won't work against the prod API from a preview URL). If
preview auth is wanted later, options are a Better Auth `trustedOrigins`
wildcard (`https://things-do-*.vercel.app`) + a CORS origin predicate — noted,
not built (over-permissive wildcards are a security smell; decide deliberately).
We will **`log()`/document** this limitation rather than silently truncate.

### B4. Client: token storage (`packages/web-kit/src/token-store.ts`, new)

```ts
// localStorage on web; in-memory fallback (tests / SSR / RN until AsyncStorage).
let memory: string | null = null;
const KEY = 'things.session-token';
export const tokenStore = {
  get(): string | null {
    try {
      return globalThis.localStorage?.getItem(KEY) ?? memory;
    } catch {
      return memory;
    }
  },
  set(t: string): void {
    memory = t;
    try {
      globalThis.localStorage?.setItem(KEY, t);
    } catch {}
  },
  clear(): void {
    memory = null;
    try {
      globalThis.localStorage?.removeItem(KEY);
    } catch {}
  },
};
```

### B5. Client: attach the token (`request.ts`)

```ts
const token = tokenStore.get();
const res = await fetch(url, {
  ...init,
  credentials: 'include', // kept for same-site local-dev cookies
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  },
});
```

### B6. Client: capture/clear the token (`auth-api.ts`, `auth-store.ts`)

`signUp`/`signIn` must read the `set-auth-token` response header and store it;
`signOut` clears it. Since `apiRequest` currently discards the `Response`, add a
variant (or a small `captureToken` helper) that reads the header before parsing
JSON:

```ts
// auth-api.ts — sign-in/up path
const res = await fetch(`${AUTH_URL}/auth/sign-in/email`, { …, credentials: 'include' });
const tok = res.headers.get('set-auth-token');
if (tok) tokenStore.set(tok);
…parse + return { user }…
// signOut: tokenStore.clear()
```

`getSession` then authenticates via the stored Bearer token (B5) — no cookie
needed cross-site.

---

## Part C — CI / infra cleanup

- **`.github/workflows/deploy.yml`** — remove the `build-webs` job (web images
  are dead). Keep `build-apis` + `deploy` (VPS) + `smoke`. The `smoke` step's
  web `/healthz` checks (if any) drop with the web sites; keep the API `/health`
  checks.
- **`infra/docker/web.Dockerfile`, `web-nginx.conf`** — keep for now (a local
  `docker-compose` web bring-up still uses them), but mark them
  non-authoritative for prod in `infra/README.md`. The Caddy `*.web`
  sites + compose web services become local-only.
- **`pull-request.yml`** — unchanged: it still lints/typechecks/tests/builds
  every workspace including web. That's CI gating, independent of deploy target.
- **`infra/.env.example`** — document `WEB_ORIGINS`.
- **`infra/VERCEL.md`** (new) — project-by-project setup checklist (root dir,
  build cmd, output dir, env vars) + the account-linking handoff steps.

---

## Testing (TDD)

- **`@things/auth` `origins.spec.ts`** (extend): `WEB_ORIGINS` entries are
  included, trimmed, empty-filtered; absent `WEB_ORIGINS` → unchanged; dev
  origins always present; order is deterministic.
- **`@things/web-kit` `token-store.spec.ts`** (new): get/set/clear with a
  mocked `localStorage`; in-memory fallback when `localStorage` throws/absent.
- **`@things/web-kit` `request.spec.ts`** (new/extend): attaches
  `Authorization: Bearer` when a token is stored; omits it when not; preserves
  caller headers + `credentials: 'include'`.
- **`@things/web-kit` `auth-api.spec.ts`** (extend): a `set-auth-token` response
  header is captured into the store on sign-in/up; `signOut` clears it.
- **Per-app `auth.ts`**: covered by `typecheck` (all six import + register
  `bearer()`); we do **not** assert on Better Auth's internal options shape
  (implementation-detail-fragile — same stance as the 2026-06-09 spec).
- **`nest-kit` bootstrap**: the existing app boot/integration specs stay green;
  CORS `exposedHeaders` is config, validated by the cross-site manual
  acceptance below rather than a brittle unit assert.
- All changes keep `npm run lint` / `typecheck` / `test:unit` green and keep
  `npm run dev` (localhost, cookie path) working.

## File map

| Path                                                                       | Action                                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `docs/superpowers/specs/2026-06-15-vercel-web-deploy-design.md`            | Create — this doc                                                |
| `apps/web-{do,say,buy,eat,send}/vercel.json`                               | Create — build cmd, output dir, SPA rewrite, asset cache headers |
| `scripts/vercel-build.sh`                                                  | Create — shared dependency-ordered build (`<app>` arg)           |
| `infra/VERCEL.md`                                                          | Create — per-project setup + account-linking handoff             |
| `packages/auth/src/origins.ts` (+ `__tests__`)                             | Modify — add `WEB_ORIGINS` to `trustedWebOrigins`                |
| `packages/web-kit/src/token-store.ts` (+ `__tests__`)                      | Create — token storage                                           |
| `packages/web-kit/src/request.ts` (+ `__tests__`)                          | Modify — attach `Authorization: Bearer`                          |
| `packages/web-kit/src/auth-api.ts` (+ `__tests__`)                         | Modify — capture/clear `set-auth-token`                          |
| `packages/web-kit/src/index.ts`                                            | Modify — export `tokenStore` (if needed by apps)                 |
| `apps/{api-auth,api-do,api-say,api-buy,api-eat,api-send}/src/auth/auth.ts` | Modify — `plugins: [bearer()]`                                   |
| `packages/nest-kit/src/bootstrap.ts`                                       | Modify — `exposedHeaders: ['set-auth-token']`                    |
| `infra/docker-compose.prod.yml`                                            | Modify — pass `WEB_ORIGINS` to each API                          |
| `infra/.env.example`                                                       | Modify — document `WEB_ORIGINS`                                  |
| `.github/workflows/deploy.yml`                                             | Modify — drop `build-webs`                                       |
| `infra/README.md`                                                          | Modify — note web is on Vercel; Docker web path is local-only    |

## Acceptance

- `expo export -p web` output for each app deploys to Vercel and loads over
  HTTPS at its `*.vercel.app` URL; deep links + asset caching behave as under
  nginx.
- From a deployed web app, **sign-up then sign-in** stores a Bearer token;
  subsequent calls to `api.<app>.$THINGS_DOMAIN` are authenticated (token in
  `Authorization`), and `get-session` returns the user — verified in Safari
  **and** Chrome (third-party-cookie blocking on; proves we're not secretly
  relying on cookies).
- `sign-out` clears the token; protected calls then 401.
- `npm run lint` / `typecheck` / `test:unit` green; `npm run dev` localhost flow
  still works (cookie path unaffected).

## Open questions / risks

- **Vercel account/project linking** is manual (CLI `vercel link` or dashboard);
  the env here has no Vercel credentials. Handed off to the user via
  `infra/VERCEL.md`. All in-repo config (vercel.json, build script) is prepared
  so linking is the only manual step.
- **Preview-deploy auth** is intentionally not wired (B3). Confirm that's
  acceptable, or decide on the wildcard-origin approach.
- **`set-auth-token` header name** is the Better Auth bearer-plugin default;
  pin it against the installed version during implementation (the
  `auth-api.spec.ts` test encodes the contract).
- **`expo export` on Vercel build image**: needs the workspace install to run at
  the repo root (not the app subdir). If Vercel's auto workspace-root install
  misbehaves, set an explicit `installCommand` (`cd ../.. && npm ci`) in
  `vercel.json` — noted as the fallback.
  </content>
  </invoke>
