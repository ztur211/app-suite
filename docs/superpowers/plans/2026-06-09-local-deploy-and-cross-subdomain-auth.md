# Local Deploy + Cross-Subdomain Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the prod Docker stack on one Linux machine (`*.things.test`, Caddy internal CA, locally-built images) with end-to-end login working via env-driven cross-subdomain Better Auth cookies.

**Architecture:** A shared `@things/auth` helper derives the trusted web origins + cookie domain from `THINGS_DOMAIN`/`AUTH_COOKIE_DOMAIN`; all 6 APIs use it for `trustedOrigins`, CORS, and `crossSubDomainCookies`. A local Docker layer (build script + compose override + a one-line Caddy toggle) reuses the prod compose unchanged. Code is TDD'd in this sandbox (jest/tsc); the Docker bring-up is verified on the box.

**Tech Stack:** NestJS 11, Better Auth 1.x, Docker Compose, Caddy 2 (`local_certs`), Jest 29 + @swc/jest, TypeScript 5.6.

**Spec:** `docs/superpowers/specs/2026-06-09-local-deploy-and-cross-subdomain-auth-design.md`

---

## File structure

| Path                                                                       | Responsibility                                                  |
| -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/auth/src/origins.ts`                                             | Pure helpers: `trustedWebOrigins(env)`, `authCookieDomain(env)` |
| `packages/auth/src/index.ts`                                               | Re-export the helpers                                           |
| `apps/{api-auth,api-do,api-say,api-buy,api-eat,api-send}/src/auth/auth.ts` | Use helper for `trustedOrigins` + `crossSubDomainCookies`       |
| `apps/{…6…}/src/main.ts`                                                   | Use helper for `enableCors` origins                             |
| `apps/{api-auth,api-do}/package.json`                                      | Add `@things/auth` dep (others already have it)                 |
| `infra/docker-compose.prod.yml`                                            | Pass `THINGS_DOMAIN`/`AUTH_COOKIE_DOMAIN` to each API           |
| `infra/Caddyfile`                                                          | `{$CADDY_EXTRA_GLOBAL}` global toggle                           |
| `infra/docker-compose.local.yml`                                           | Override: `pull_policy: never` + `local_certs`                  |
| `scripts/build-local.sh`                                                   | Build + tag all 11 images with local URLs                       |
| `infra/.env.example`, `infra/README.md`                                    | Document local vars + bring-up                                  |

---

### Task 1: `@things/auth` origins helper (TDD)

**Files:**

- Create: `packages/auth/src/origins.ts`
- Create: `packages/auth/src/__tests__/origins.test.ts`
- Modify: `packages/auth/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/auth/src/__tests__/origins.test.ts`:

```ts
import { trustedWebOrigins, authCookieDomain } from '../origins';

describe('trustedWebOrigins', () => {
  it('adds the five web subdomains when THINGS_DOMAIN is set', () => {
    expect(trustedWebOrigins({ THINGS_DOMAIN: 'things.test' })).toEqual(
      expect.arrayContaining([
        'https://do.things.test',
        'https://say.things.test',
        'https://buy.things.test',
        'https://eat.things.test',
        'https://send.things.test',
      ]),
    );
  });

  it('always includes the localhost dev origins 8081-8085', () => {
    expect(trustedWebOrigins({ THINGS_DOMAIN: 'things.test' })).toEqual(
      expect.arrayContaining(['http://localhost:8081', 'http://localhost:8085']),
    );
  });

  it('returns only dev origins when THINGS_DOMAIN is unset', () => {
    expect(trustedWebOrigins({})).toEqual([
      'http://localhost:8081',
      'http://localhost:8082',
      'http://localhost:8083',
      'http://localhost:8084',
      'http://localhost:8085',
    ]);
  });
});

describe('authCookieDomain', () => {
  it('returns the domain when set', () => {
    expect(authCookieDomain({ AUTH_COOKIE_DOMAIN: '.things.test' })).toBe('.things.test');
  });
  it('returns undefined when unset or empty', () => {
    expect(authCookieDomain({})).toBeUndefined();
    expect(authCookieDomain({ AUTH_COOKIE_DOMAIN: '' })).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm run test:unit -w @things/auth`
Expected: FAIL — `Cannot find module '../origins'`.

- [ ] **Step 3: Implement the helper**

`packages/auth/src/origins.ts`:

```ts
const WEB_APPS = ['do', 'say', 'buy', 'eat', 'send'] as const;

// Expo dev servers bind 8081 upward; trust the first five for side-by-side local dev.
const devWebOrigins = Array.from({ length: 5 }, (_, i) => `http://localhost:${8081 + i}`);

/**
 * Browser origins allowed to call the APIs (CORS) and trusted by Better Auth.
 * Always includes the localhost Expo dev origins; adds the prod/local web
 * subdomains (https://{do,say,buy,eat,send}.$THINGS_DOMAIN) when THINGS_DOMAIN is set.
 */
export function trustedWebOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const domain = env['THINGS_DOMAIN'];
  const prod = domain ? WEB_APPS.map((app) => `https://${app}.${domain}`) : [];
  return [...prod, ...devWebOrigins];
}

/**
 * Parent cookie domain for cross-subdomain sessions (e.g. ".things.test").
 * Undefined when AUTH_COOKIE_DOMAIN is unset → Better Auth keeps host-scoped cookies.
 */
export function authCookieDomain(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const d = env['AUTH_COOKIE_DOMAIN'];
  return d && d.length > 0 ? d : undefined;
}
```

Add to `packages/auth/src/index.ts` (after the existing exports):

```ts
export { trustedWebOrigins, authCookieDomain } from './origins';
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npm run test:unit -w @things/auth`
Expected: PASS (new + existing `service-jwt`/`session-validator`/`smoke` tests green).

- [ ] **Step 5: Rebuild the package so consumers resolve the new exports**

Run: `npm run build -w @things/auth`
Expected: exits 0; `packages/auth/dist/origins.d.ts` exists (apps import `@things/auth` via its built `dist/`).

- [ ] **Step 6: Commit**

```bash
git add packages/auth/src/origins.ts packages/auth/src/__tests__/origins.test.ts packages/auth/src/index.ts
git commit -m "feat(@things/auth): env-driven trustedWebOrigins + authCookieDomain helpers"
```

---

### Task 2: Add `@things/auth` dependency to api-auth and api-do

**Files:**

- Modify: `apps/api-auth/package.json`
- Modify: `apps/api-do/package.json`

- [ ] **Step 1: Add the dependency to both package.json files**

In `apps/api-auth/package.json` and `apps/api-do/package.json`, add to `"dependencies"` (alphabetically, matching how the other apps list it):

```json
"@things/auth": "*",
```

- [ ] **Step 2: Link the workspace dependency**

Run: `npm install`
Expected: exits 0; `apps/api-auth/node_modules/@things/auth` and `apps/api-do/node_modules/@things/auth` resolve (symlinked).

- [ ] **Step 3: Commit**

```bash
git add apps/api-auth/package.json apps/api-do/package.json package-lock.json
git commit -m "chore(api-auth,api-do): depend on @things/auth"
```

---

### Task 3: Wire `auth.ts` in all 6 apps

**Files (each modified):**

- `apps/api-auth/src/auth/auth.ts`
- `apps/api-do/src/auth/auth.ts`
- `apps/api-say/src/auth/auth.ts`
- `apps/api-buy/src/auth/auth.ts`
- `apps/api-eat/src/auth/auth.ts`
- `apps/api-send/src/auth/auth.ts`

The edit is the same in every file: import the helpers, delete the local `devWebOrigins` const, swap `...devWebOrigins` → `...trustedWebOrigins()`, and conditionally add `advanced.crossSubDomainCookies`.

- [ ] **Step 1: Add the import (top of each file, after the existing imports)**

```ts
import { trustedWebOrigins, authCookieDomain } from '@things/auth';
```

- [ ] **Step 2: Delete the local dev-origins line in each file**

Remove this line (present in all 6):

```ts
// Expo dev servers bind 8081 upward; trust the first five for side-by-side apps.
const devWebOrigins = Array.from({ length: 5 }, (_, i) => `http://localhost:${8081 + i}`);
```

- [ ] **Step 3: Replace the `trustedOrigins` line and add `advanced`**

In each `betterAuth({ ... })` call, replace the `trustedOrigins:` line with the two lines below. Keep each app's existing own-URL element unchanged **except api-do** (see Step 4).

```ts
  trustedOrigins: [process.env['BETTER_AUTH_URL'] ?? '<OWN_FALLBACK>', ...trustedWebOrigins()],
  ...(authCookieDomain()
    ? { advanced: { crossSubDomainCookies: { enabled: true, domain: authCookieDomain()! } } }
    : {}),
```

`<OWN_FALLBACK>` is already correct in 5 of 6 files — leave it as-is:

- api-auth: `http://localhost:3001` · api-say: `http://localhost:3003` · api-buy: `http://localhost:3004` · api-eat: `http://localhost:3005` · api-send: `http://localhost:3006`

- [ ] **Step 4: api-do only — make its own-URL env-driven too**

`apps/api-do/src/auth/auth.ts` currently hardcodes the literal. Its `trustedOrigins` line must become:

```ts
  trustedOrigins: [process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3002', ...trustedWebOrigins()],
  ...(authCookieDomain()
    ? { advanced: { crossSubDomainCookies: { enabled: true, domain: authCookieDomain()! } } }
    : {}),
```

- [ ] **Step 5: Verify typecheck + existing auth specs pass**

Run: `npm run typecheck && npm run test:unit -w @things/api-auth -w @things/api-do -w @things/api-say -w @things/api-buy -w @things/api-eat -w @things/api-send`
Expected: typecheck exits 0 (all 6 resolve `@things/auth`); existing auth specs (`auth.controller`, `session.guard`, `service-jwt.guard`, etc.) stay green.

- [ ] **Step 6: Commit**

```bash
git add apps/api-*/src/auth/auth.ts
git commit -m "feat(api-*): env-driven trustedOrigins + crossSubDomainCookies in auth"
```

---

### Task 4: Wire `main.ts` CORS in all 6 apps

**Files (each modified):** `apps/{api-auth,api-do,api-say,api-buy,api-eat,api-send}/src/main.ts`

Every `main.ts` has the identical `devWebOrigins` block + `enableCors` line; the edit is the same in all 6.

- [ ] **Step 1: Add the import (after the existing imports, before `bootstrap`)**

```ts
import { trustedWebOrigins } from '@things/auth';
```

- [ ] **Step 2: Delete the local dev-origins block**

Remove (present in all 6):

```ts
// Expo dev servers bind 8081 upward; allow the first five for side-by-side apps.
const devWebOrigins = Array.from({ length: 5 }, (_, i) => `http://localhost:${8081 + i}`);
```

- [ ] **Step 3: Use the helper in `enableCors`**

Replace:

```ts
app.enableCors({ origin: devWebOrigins, credentials: true });
```

with:

```ts
app.enableCors({ origin: trustedWebOrigins(), credentials: true });
```

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/api-*/src/main.ts
git commit -m "feat(api-*): env-driven CORS origins via @things/auth"
```

---

### Task 5: Pass `THINGS_DOMAIN`/`AUTH_COOKIE_DOMAIN` to each API container

**Files:** Modify `infra/docker-compose.prod.yml`

- [ ] **Step 1: Add the two env lines to every API service**

Under each of `api-auth`, `api-do`, `api-say`, `api-buy`, `api-eat`, `api-send` → `environment:`, add:

```yaml
THINGS_DOMAIN: ${THINGS_DOMAIN}
AUTH_COOKIE_DOMAIN: ${AUTH_COOKIE_DOMAIN:-}
```

(`THINGS_DOMAIN` is already required at the top for Caddy; `AUTH_COOKIE_DOMAIN` defaults to empty so prod without it just keeps host-scoped cookies.)

- [ ] **Step 2: Validate the compose still parses**

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('infra/docker-compose.prod.yml','utf8')); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add infra/docker-compose.prod.yml
git commit -m "feat(infra): expose THINGS_DOMAIN/AUTH_COOKIE_DOMAIN to API containers"
```

---

### Task 6: Caddyfile internal-CA toggle

**Files:** Modify `infra/Caddyfile`

- [ ] **Step 1: Add the env-substituted line to the global block**

Change:

```
{
	email {$ACME_EMAIL}
}
```

to:

```
{
	email {$ACME_EMAIL}
	{$CADDY_EXTRA_GLOBAL}
}
```

- [ ] **Step 2: Commit**

```bash
git add infra/Caddyfile
git commit -m "feat(infra): CADDY_EXTRA_GLOBAL hook (set local_certs for local CA)"
```

---

### Task 7: Local compose override

**Files:** Create `infra/docker-compose.local.yml`

- [ ] **Step 1: Create the override**

`infra/docker-compose.local.yml`:

```yaml
# Local single-machine deploy overlay. Use WITH the prod compose:
#   docker compose -f infra/docker-compose.prod.yml -f infra/docker-compose.local.yml \
#     --env-file infra/.env up -d
# Differences from prod: use locally-built images (never pull GHCR) and serve
# every subdomain through Caddy's internal CA instead of Let's Encrypt.
services:
  caddy:
    environment:
      CADDY_EXTRA_GLOBAL: local_certs
  api-auth: { pull_policy: never }
  api-do: { pull_policy: never }
  api-say: { pull_policy: never }
  api-buy: { pull_policy: never }
  api-eat: { pull_policy: never }
  api-send: { pull_policy: never }
  web-do: { pull_policy: never }
  web-say: { pull_policy: never }
  web-buy: { pull_policy: never }
  web-eat: { pull_policy: never }
  web-send: { pull_policy: never }
```

- [ ] **Step 2: Validate the merge parses**

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('infra/docker-compose.local.yml','utf8')); console.log('ok')"`
Expected: prints `ok`. (Full `docker compose config` merge is verified on the box in Task 10.)

- [ ] **Step 3: Commit**

```bash
git add infra/docker-compose.local.yml
git commit -m "feat(infra): docker-compose.local.yml overlay (local images + internal CA)"
```

---

### Task 8: Local build script

**Files:** Create `scripts/build-local.sh`

- [ ] **Step 1: Create the script**

`scripts/build-local.sh`:

```bash
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
```

- [ ] **Step 2: Make it executable + syntax-check**

Run: `chmod +x scripts/build-local.sh && bash -n scripts/build-local.sh && echo OK`
Expected: prints `OK` (no syntax errors; actual build runs on the box in Task 10).

- [ ] **Step 3: Commit**

```bash
git add scripts/build-local.sh
git commit -m "feat(scripts): build-local.sh — build+tag all images with local URLs"
```

---

### Task 9: Document local vars + bring-up

**Files:** Modify `infra/.env.example`, `infra/README.md`

- [ ] **Step 1: Add the new vars to `infra/.env.example`**

After the `THINGS_DOMAIN`/`ACME_EMAIL` block, add:

```
# Parent cookie domain for cross-subdomain sessions (Better Auth crossSubDomainCookies).
# Leading dot. Prod: .things.app   Local: .things.test   (leave blank to disable)
AUTH_COOKIE_DOMAIN=.things.app
# Local single-machine deploy only: set to `local_certs` to use Caddy's internal CA
# instead of Let's Encrypt. Leave blank in production.
CADDY_EXTRA_GLOBAL=
```

- [ ] **Step 2: Add a "Local single-machine deploy" section to `infra/README.md`**

Insert after the "First-time VPS bring-up" section:

```markdown
## Local single-machine deploy (no cloud)

Run the whole stack on one Linux box, reachable in a browser on that machine.

1. `/etc/hosts`:
   `127.0.0.1  auth.things.test api.do.things.test api.say.things.test api.buy.things.test api.eat.things.test api.send.things.test do.things.test say.things.test buy.things.test eat.things.test send.things.test`
2. `cp infra/.env.example infra/.env && chmod 600 infra/.env`; set `THINGS_DOMAIN=things.test`,
   `AUTH_COOKIE_DOMAIN=.things.test`, `CADDY_EXTRA_GLOBAL=local_certs`, and generate the
   passwords/secrets (`openssl rand -base64 36`). `OPENAI_/ANTHROPIC_KEY` are optional.
3. `scripts/build-local.sh`
4. `docker compose -f infra/docker-compose.prod.yml -f infra/docker-compose.local.yml --env-file infra/.env up -d`
5. Trust Caddy's local CA: `docker compose ... cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-local-ca.crt`,
   then add it to your browser/system trust store. Open `https://do.things.test`.
```

- [ ] **Step 3: Commit**

```bash
git add infra/.env.example infra/README.md
git commit -m "docs(infra): document AUTH_COOKIE_DOMAIN + local single-machine deploy"
```

---

### Task 10: Bring-up + acceptance (run ON the Linux box)

> These steps run on the target machine (needs Docker); they are not part of the sandbox jest/tsc loop.

- [ ] **Step 1: Validate the merged compose**

Run: `docker compose -f infra/docker-compose.prod.yml -f infra/docker-compose.local.yml --env-file infra/.env config >/dev/null && echo OK`
Expected: `OK` (env resolves, override merges).

- [ ] **Step 2: Build + start**

Run: `scripts/build-local.sh && docker compose -f infra/docker-compose.prod.yml -f infra/docker-compose.local.yml --env-file infra/.env up -d`
Expected: all 13 containers start; `docker compose ... ps` shows API/web services `healthy` within ~1–2 min.

- [ ] **Step 3: Trust the local CA + load a web app**

Trust `caddy:/data/caddy/pki/authorities/local/root.crt` (README Step 5), then open `https://do.things.test`.
Expected: the Do Things web app loads over HTTPS with no cert warning.

- [ ] **Step 4: Acceptance — cross-subdomain login**

Log in at `https://auth.things.test`, then return to `https://do.things.test`.
Expected: you are authenticated; the app's calls to `https://api.do.things.test` succeed (session cookie sent cross-subdomain). Repeat-spot-check one more app (e.g. `say`).

- [ ] **Step 5: Commit any box-side fixups** (only if Step 1–4 required changes)

```bash
git add -A && git commit -m "fix(infra): local bring-up adjustments"
```

---

## Notes for the executor

- **Sandbox vs box:** Tasks 1–9 are implemented and verified in the sandbox (jest + tsc; no Docker). Task 10 runs on the Linux box (Docker). Push after Task 9 so the box can pull the branch.
- **`@things/auth` must be rebuilt** (Task 1 Step 5) before the apps typecheck against the new exports — apps resolve workspace packages via their built `dist/`, not source.
- **Don't touch `deploy.yml`** — the prod CI/GHCR path is unchanged; local builds are native via `build-local.sh`.
