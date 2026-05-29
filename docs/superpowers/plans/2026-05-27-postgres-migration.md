# P5 — SQLite → Postgres Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every NestJS app off SQLite onto Postgres, matching the foundation spec §3.5 topology (one database per app, owned by a dedicated role; shared `auth_reader` role on `things_auth` for cross-app session lookup). Integration tests use the `@things/testing` Postgres testcontainers helper. No SQLite traces remain in code, env files, or docs.

**Why:** SQLite was an explicit dev-only stopgap (first introduced in commit `01badfd` with the message "SQLite provider for dev/test (Postgres switch in P5)"). The Postgres switch was always planned for P5 and is a prerequisite for the rest of P5 — docker-compose.dev.yml, docker-compose.prod.yml, per-app DB roles, `pg_dump` backups, the deploy pipeline, and the cross-app E2E that's currently `describe.skip`'d.

**Status as of 2026-05-27:**

- ✅ `@things/testing` ships `setupSuitePostgres({ apps, authReader? })`. Provisions per-app DBs + owner roles + optional read-only `auth_reader` role for cross-app session lookup. Container cleanup is handled by testcontainers' Ryuk sidecar.
- ✅ `api-auth` fully migrated end-to-end (commit `42a5533`): provider `postgresql`; Better Auth adapter postgresql; `.env`/.env.example use a Postgres URL; `jest.integration.globalSetup.ts` boots a Postgres testcontainer and runs `prisma db push`. All 5 `auth.integration.spec.ts` cases pass green.
- ✅ `api-do`, `api-buy`, `api-eat`, `api-send`, `api-say` all migrated using the two-Prisma-client pattern (option B below): domain client connects to `things_<app>` via `<app>_owner`; second client (`authPrisma`) connects to `things_auth` via the read-only `auth_reader` role. Better Auth's `prismaAdapter` is constructed with `authPrisma`. Each app exposes `apps/<app>/prisma/auth-schema.prisma` mirroring the Better Auth tables and generating into `./generated/auth-client/`.
  - **api-do**: commit `5e6a69c`. 8 integration tests pass; Task.source converted to native Json.
  - **api-buy**: commit `da8c733`. Unit tests only (no integration tests yet); schema cleanup only.
  - **api-eat**: commit `ece1b89`. Same shape as api-buy.
  - **api-send**: commit `7724e44`. Same shape as api-buy.
  - **api-say**: commit `7ff77b5`. 18 integration tests pass against Postgres; new `src/test-utils/auth-owner-prisma.ts` lets tests seed users via a write-enabled auth client.
- ✅ All docs/specs/plans/CLAUDE.md scrubbed of SQLite references (this plan documents the migration that replaced it).

**Shipped follow-ups:**

- ✅ **api-say schema-type cleanup**: `Dictation.{proposedPayload,editedPayload,usage}` are now native `Json`; `intent`/`state`/`destination`/`captureMode` are native Postgres `enum`s. `DictationsService` and `PendingService` no longer wrap reads/writes in `JSON.stringify`/`JSON.parse`; the awkward `DictationRow`/`hydrate()` indirection is gone and `DictationView` is just the Prisma `Dictation` type. Integration spec seed data updated to pass objects.
- ✅ **`infra/docker-compose.dev.yml`**: local Postgres + Redis + Mailhog stack. `infra/postgres/init.sql` provisions the same per-app DB+role topology as `setupSuitePostgres` (six `<app>_owner` roles, six `things_<app>` DBs, plus `auth_reader` with `CONNECT` on `things_auth` and `ALTER DEFAULT PRIVILEGES FOR ROLE auth_owner ... GRANT SELECT` so that any future tables auth_owner creates auto-grant to auth_reader). Devs no longer need testcontainers to run the apps.
- ✅ **api-buy/api-eat/api-send integration-test scaffolding**: each app now has `jest.integration.globalSetup.ts` + `tsconfig.jest.json` + an ESM-mode `jest.integration.config.ts` matching api-do's template; `@things/testing` + `cross-env` added to devDeps; `test:integration` script wrapped with `cross-env NODE_OPTIONS=--experimental-vm-modules`. Verified end-to-end on api-buy via a throwaway smoke spec (testcontainer boots, both schemas push, domain client queries `SELECT now()` from `things_buy`, auth_reader URL points at `things_auth`). The other two apps use the same template with only the app-name token swapped, so they inherit the same correctness.
- ✅ **Legacy `apps/api-auth/prisma/things_auth.db` removed** from local working trees. The file was always gitignored (`*.db` in `.gitignore`) and nothing in code/config referenced it, so the cleanup is purely a local-disk delete — no commit needed beyond this plan note.
- ✅ **First real integration specs for api-buy/api-eat/api-send landed.** api-buy's `items.integration.spec.ts` shipped in `1db5e07`; api-eat (`meals.integration.spec.ts`) and api-send (`messages.integration.spec.ts`) followed, each mirroring the api-buy/api-do template — boot a Postgres testcontainer via the existing `jest.integration.globalSetup`, sign up a test user through a temporary write-enabled Better Auth instance (the app's own instance is read-only), and exercise full domain CRUD through the HTTP layer + SessionGuard against the real per-app DB. 10 cases each, all green against `postgres:16-alpine`. Cross-user ownership isolation stays unit-covered in each app's `*.service.spec`.
- ✅ **Cross-app E2E unskipped** (commit `10c8a69`): `apps/api-say/__tests__/e2e/cross-app/say-to-do.e2e.spec.ts` boots api-do and api-say in-process against a 3-app testcontainer (`apps: ['auth', 'do', 'say']`) and exercises the typed dictation → DispatchService → DoHandler → DoSdk → HTTP → api-do TasksService → things_do path. New `apps/api-say/jest.e2e.globalSetup.ts` runs `setupSuitePostgres` + per-app `prisma db push` + `grantAuthReaderOnAuthTables`. Also fixed a latent lazy-spawn hazard in `apps/api-do/src/tasks/tasks.module.ts`: Prisma's query engine resolves `DATABASE_URL` at first query, not at `new PrismaClient()`, so TasksModule's useFactory now passes `datasources.db.url` explicitly to pin the URL at construction.

- ✅ **Production migration files generated + committed.** Every owned schema now has an `_init` migration under `apps/<app>/prisma/migrations/`: api-auth (`User`/`Session`/`Account`/`Verification`/`AiCall` in things_auth) and the five domain schemas (api-do `Task`, api-buy `ShoppingItem`, api-eat `MealItem`, api-say `Dictation` + 4 enums + `IdempotencyKey` + mirrored `AiCall`, api-send `Message`). Generated via `prisma migrate dev --name init` against a throwaway Postgres; each verified drift-free with `prisma migrate diff --from-migrations … --to-schema-datamodel … --exit-code` (all exit 0) and the deploy path dogfooded via `prisma migrate deploy` into a fresh DB. The read-only `auth-schema.prisma` mirrors in the five non-auth apps get **no** migrations — api-auth owns the auth tables; the others only read them via `auth_reader`. Each app gained `db:migrate` (dev) and `db:migrate:deploy` (prod) scripts.

**Still deferred to follow-up commits:**

- **CI drift-guard (optional, non-blocking):** integration tests still use `prisma db push` (faster cold start), so a schema edit that skips generating a matching migration would not fail tests. A CI step running `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code` per app (with a throwaway shadow DB) would catch migration↔schema drift before deploy.

**Tech Stack:** Postgres 16 (image `postgres:16-alpine`), Prisma 5.22, Better Auth 1.6+, testcontainers 12, NestJS 11, Jest 29.

---

## Cross-app auth: design decision required before api-do

Today every app's PrismaClient connects to the same SQLite file (`apps/api-auth/prisma/things_auth.db`) so sessions written by api-auth's Better Auth instance are visible to api-do/api-say/etc. That hack doesn't translate to per-app Postgres databases. Three viable options:

| Option                             | How sessions are read                                                                                                                                | Pros                                                             | Cons                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **A — Mirrored tables, sync**      | Each app's `things_<app>` DB has its own copy of `User`/`Session`/`Account`/`Verification`. api-auth pushes changes via a queue (or LISTEN/NOTIFY).  | Apps only need one Prisma client. Reads are local (fast).        | Real sync infrastructure to build, eventual consistency.                      |
| **B — Two Prisma clients per app** | Each app has two Prisma schemas: one for its own domain (writable), one for `things_auth` (read-only via `auth_reader`). Two PrismaClient instances. | Strongly consistent reads. No sync. Matches spec §3.5 literally. | Each app doubles its Prisma surface area.                                     |
| **C — HTTP session lookup**        | Each app calls a `GET /sessions/by-token` endpoint on api-auth on every request.                                                                     | One source of truth, no DB-layer coupling.                       | Extra hop per request, api-auth becomes a hot dependency for every other app. |

**Spec leaning:** §3.5 says `things_auth` is "read access from all apps (via shared `auth_reader` role for session lookup)" — that's option B. Settling on B before the api-do migration starts.

- [ ] **D1: Confirm option B with the user.** Specifically: each app gets two PrismaClients (`prisma` for its own DB, `authPrisma` for session reads against `things_auth` via the `auth_reader` role). SessionGuard does `authPrisma.session.findUnique` instead of relying on Better Auth's adapter.

---

## Per-app migration template

Applied identically to api-do, api-say, api-buy, api-eat, api-send.

- [ ] **Step 1: Update schema.prisma**

Change `provider = "sqlite"` → `provider = "postgresql"`. Strip the mirrored Better Auth tables (User/Session/Account/Verification) — they move to a second `prisma/auth-schema.prisma` schema in step 4.

- [ ] **Step 2: Convert String workarounds to native types**

Wherever the current schema uses `String` for JSON or enum-shaped fields (because SQLite didn't support `Json`/`enum`), switch to native types:

| App      | Field                                       | Today     | Target                                                                         |
| -------- | ------------------------------------------- | --------- | ------------------------------------------------------------------------------ |
| api-do   | `Task.source`                               | `String?` | `Json?`                                                                        |
| api-say  | `Dictation.intent`                          | `String`  | `enum Intent { DO NOTE SEND BUY EAT }`                                         |
| api-say  | `Dictation.state`                           | `String`  | `enum DictationState { proposed confirmed dispatched cancelled }`              |
| api-say  | `Dictation.destination`                     | `String`  | `enum Destination { DO_THINGS SAY_LIBRARY CLIPBOARD PENDING_BUY PENDING_EAT }` |
| api-say  | `Dictation.captureMode`                     | `String`  | `enum CaptureMode { tap drive type }`                                          |
| api-say  | `Dictation.proposedPayload`/`editedPayload` | `String`  | `Json`                                                                         |
| api-say  | `Dictation.usage`                           | `String`  | `Json`                                                                         |
| api-buy  | `Item.source` (if present)                  | `String?` | `Json?`                                                                        |
| api-eat  | (audit at migration time)                   | —         | —                                                                              |
| api-send | (audit at migration time)                   | —         | —                                                                              |

App code that currently calls `JSON.stringify` / `JSON.parse` around those columns must be removed in the same commit.

- [ ] **Step 3: Update Better Auth adapter**

`prismaAdapter(prisma, { provider: 'sqlite' })` → `prismaAdapter(authPrisma, { provider: 'postgresql' })`. Note the client changes from the app's own `prisma` (per-app DB) to `authPrisma` (read of `things_auth`).

- [ ] **Step 4: Create the second Prisma schema for auth reads**

Create `apps/<app>/prisma/auth-schema.prisma` mirroring the User/Session/Account/Verification models from api-auth, generating into `./generated/auth-client/`. `authPrisma` connects via `AUTH_DATABASE_URL` (the `auth_reader` URL). The app's session guard reads sessions via this client.

- [ ] **Step 5: Update .env and .env.example**

```
DATABASE_URL="postgresql://<app>_owner:<app>_owner@localhost:5432/things_<app>?schema=public"
AUTH_DATABASE_URL="postgresql://auth_reader:auth_reader@localhost:5432/things_auth?schema=public"
```

- [ ] **Step 6: Add @things/testing as a workspace dep**

`"@things/testing": "*"` in `devDependencies`.

- [ ] **Step 7: Add jest.integration.globalSetup.ts**

Mirror `apps/api-auth/jest.integration.globalSetup.ts`. Differences:

- `setupSuitePostgres({ apps: ['auth', '<app>'], authReader: true })` so both the app's own DB and the read-only auth view exist
- `prisma db push --skip-generate --schema=prisma/schema.prisma` against `urls.<app>`
- `prisma db push --skip-generate --schema=prisma/auth-schema.prisma` against `urls.auth`
- `await suite.grantAuthReaderOnAuthTables()` after the auth-schema push so `auth_reader` can SELECT
- Set both `DATABASE_URL` and `AUTH_DATABASE_URL`

- [ ] **Step 8: Update integration tests**

Drop the existing `things_auth.db` references and the `BETTER_AUTH_SECRET ?? 'set-via-env'` workarounds. Tests now sign up users via api-auth's sign-up endpoint OR by inserting directly via the `authPrisma` client (which has been granted SELECT via `auth_reader` in step 7 — but tests need a writable path; the cleanest approach is to spin up a small in-test Better Auth instance against `urls.auth` for signup).

- [ ] **Step 9: Run typecheck, lint, test:unit, test:integration**

All must pass green before the per-app migration commit.

---

## Per-app rollout order

Recommended order (least dependency surface first):

1. **api-do** — smallest domain (just `Task`); first to validate the two-client + auth_reader pattern. Cross-app contract: `@things/do-sdk` is consumed by api-say.
2. **api-buy** — small domain; consumes `@things/say-sdk` (for sync). No consumers.
3. **api-eat** — small domain; same shape as api-buy.
4. **api-send** — small domain; no cross-app dependencies.
5. **api-say** — biggest domain (Dictation + IntentResult + 5 dispatch handlers); has the most schema-type cleanup (intent/state/destination/captureMode enums, payload Json columns). Touching this last means the testcontainers + auth_reader pattern is well-shaken-out by then.

After all five apps are migrated:

- [ ] **Step 10: Re-enable the skipped cross-app E2E**

`apps/api-say/__tests__/e2e/cross-app/say-to-do.e2e.spec.ts` is currently `describe.skip`'d on the assumption that per-app Prisma clients couldn't coexist. That assumption is no longer true (each app already generates to `./prisma/generated/client/`; the Postgres migration only reinforces it). Wire the test against a testcontainers Postgres provisioned with `apps: ['auth', 'do', 'say']`. The test boots both api-say and api-do in-process, exercises the DoSdk → api-do dispatch path, and asserts the resulting Task in api-do's DB.

- [x] **Step 11: Remove the legacy `apps/api-auth/prisma/things_auth.db` file**

File was gitignored (`*.db`) so the cleanup is a local-disk delete; the `apps/api-auth/prisma/` directory still contains `schema.prisma` + `generated/`, so no `.gitkeep` is needed.

---

## Out of scope (separate plans)

- `infra/docker-compose.prod.yml`, `infra/Caddyfile`, per-app Dockerfiles, `.github/workflows/deploy.yml` — the rest of P5. ✅ Shipped — see `infra/README.md`. The prod stack (Caddy auto-TLS + 6 api + 5 web + postgres + redis), shared parameterized `api`/`web` Dockerfiles, `init-prod.sh` (env-driven role/DB topology), GHCR build+SSH deploy workflow, `scripts/{deploy.sh,smoke.mjs}`, and nightly `pg_dump` backups all landed. Validated via `docker compose config`, `caddy validate`, `actionlint`, and a host-side build-order + `prisma generate` check; the full in-image `npm ci` build runs in CI (`pull-request.yml` already proves it on `ubuntu-latest`) but couldn't be executed in the dev sandbox (build-container egress to the npm registry is proxied/blocked).
- Migration files (Prisma migrate). ✅ Shipped — see the "Production migration files generated + committed" entry under Shipped follow-ups above. Tests still use `prisma db push`; production uses the committed `_init` migrations via `db:migrate:deploy`.
