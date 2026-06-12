# nest-kit finish — PR-A: shared `bootstrapThingsApp` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the byte-identical NestJS bootstrap in all 6 API apps' `main.ts` into a single `bootstrapThingsApp({ name, module, port })` helper in `@things/nest-kit`.

**Architecture:** Add `bootstrapThingsApp` (TDD, `NestFactory`/`@things/auth` mocked) to nest-kit; each `main.ts` becomes a ~6-line call. No behavior change — the `console.warn` startup line and `loadEnv()` fail-fast validation are preserved.

**Tech Stack:** NestJS 11 (`@nestjs/core` `NestFactory`), `@things/auth` `trustedWebOrigins`, Jest 29 + `@swc/jest` (node env).

**Spec:** `docs/superpowers/specs/2026-06-12-nest-kit-finish-bootstrap-prisma.md` — PR-A section.

---

## Preconditions

- Branch `refactor/nest-kit-bootstrap` (off `main`; spec committed there).
- `main.ts` is not imported by unit tests, so PR-A's gate is `typecheck` + `lint` + `build:packages`; the actual boot is covered by integration/e2e in CI.

## File Structure

| File                                                | Change     | Responsibility                        |
| --------------------------------------------------- | ---------- | ------------------------------------- |
| `packages/nest-kit/package.json`                    | modify     | Add `@nestjs/core` peer + dev dep     |
| `packages/nest-kit/src/bootstrap.ts`                | **create** | `bootstrapThingsApp` helper           |
| `packages/nest-kit/src/__tests__/bootstrap.test.ts` | **create** | Unit test (mocked NestFactory)        |
| `packages/nest-kit/src/index.ts`                    | modify     | Export `bootstrapThingsApp`           |
| `apps/api-{auth,do,say,buy,eat,send}/src/main.ts`   | modify     | Reduce to a `bootstrapThingsApp` call |

---

## Task 1: `bootstrapThingsApp` in `@things/nest-kit`

**Files:** modify `packages/nest-kit/package.json`, `packages/nest-kit/src/index.ts`; create `packages/nest-kit/src/bootstrap.ts`, `packages/nest-kit/src/__tests__/bootstrap.test.ts`.

- [ ] **Step 1: Add `@nestjs/core` to nest-kit deps**

In `packages/nest-kit/package.json`, add `"@nestjs/core": "^11.0.0"` to **both** `peerDependencies` and `devDependencies` (alongside `@nestjs/common`).

- [ ] **Step 2: Write the failing test** — `packages/nest-kit/src/__tests__/bootstrap.test.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { bootstrapThingsApp } from '../bootstrap';

jest.mock('@nestjs/core', () => ({ NestFactory: { create: jest.fn() } }));
jest.mock('@things/auth', () => ({ trustedWebOrigins: () => ['http://web.test'] }));

describe('bootstrapThingsApp', () => {
  it('creates the app, enables CORS with trusted origins, listens, and returns the app', async () => {
    const enableCors = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);
    const fakeApp = { enableCors, listen };
    (NestFactory.create as jest.Mock).mockResolvedValueOnce(fakeApp);
    class AppModule {}

    const app = await bootstrapThingsApp({ name: 'api-x', module: AppModule, port: 4321 });

    expect(NestFactory.create).toHaveBeenCalledWith(AppModule);
    expect(enableCors).toHaveBeenCalledWith({ origin: ['http://web.test'], credentials: true });
    expect(listen).toHaveBeenCalledWith(4321);
    expect(app).toBe(fakeApp);
  });
});
```

- [ ] **Step 3: Run it — expect FAIL** (`Cannot find module '../bootstrap'`)

Run: `npm run test:unit -w @things/nest-kit -- bootstrap.test`

- [ ] **Step 4: Implement `packages/nest-kit/src/bootstrap.ts`**

```ts
import { NestFactory } from '@nestjs/core';
import type { INestApplication, Type } from '@nestjs/common';
import { trustedWebOrigins } from '@things/auth';

export interface BootstrapOptions {
  name: string;
  module: Type<unknown>;
  port: number;
}

export async function bootstrapThingsApp(opts: BootstrapOptions): Promise<INestApplication> {
  const app = await NestFactory.create(opts.module);
  app.enableCors({ origin: trustedWebOrigins(), credentials: true });
  await app.listen(opts.port);
  console.warn(`[${opts.name}] listening on http://localhost:${opts.port}`);
  return app;
}
```

- [ ] **Step 5: Export it** — append to `packages/nest-kit/src/index.ts`:

```ts
export { bootstrapThingsApp, type BootstrapOptions } from './bootstrap';
```

- [ ] **Step 6: Install, run test (PASS), build, typecheck, lint**

Run:

```bash
npm install
npm run test:unit -w @things/nest-kit -- bootstrap.test
npm run build -w @things/nest-kit
npm run typecheck -w @things/nest-kit
npm run lint -w @things/nest-kit
```

Expected: test PASS (1 test); build/typecheck/lint clean. (`npm install` links `@nestjs/core` into nest-kit.)

- [ ] **Step 7: Commit**

```bash
git add packages/nest-kit/package.json packages/nest-kit/src/bootstrap.ts packages/nest-kit/src/__tests__/bootstrap.test.ts packages/nest-kit/src/index.ts package-lock.json
git commit -m "feat(nest-kit): bootstrapThingsApp helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Collapse the 6 `main.ts` files

**Files:** rewrite `apps/api-{auth,do,say,buy,eat,send}/src/main.ts`.

- [ ] **Step 1: Rewrite each `main.ts`** to the wrapper, with the app's own `name`. `apps/api-do/src/main.ts`:

```ts
import 'dotenv/config';
import 'reflect-metadata';
import { bootstrapThingsApp } from '@things/nest-kit';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

void bootstrapThingsApp({ name: 'api-do', module: AppModule, port: loadEnv().PORT });
```

Apply the identical shape to the other five, changing only the `name`:

- `apps/api-auth/src/main.ts` → `name: 'api-auth'`
- `apps/api-say/src/main.ts` → `name: 'api-say'`
- `apps/api-buy/src/main.ts` → `name: 'api-buy'`
- `apps/api-eat/src/main.ts` → `name: 'api-eat'`
- `apps/api-send/src/main.ts` → `name: 'api-send'`

- [ ] **Step 2: Confirm `@things/nest-kit` is a dependency of each app**

Run:

```bash
for app in api-auth api-do api-say api-buy api-eat api-send; do echo "$app: $(grep -c '@things/nest-kit' apps/$app/package.json) nest-kit dep"; done
```

Expected: each prints `1` (the apps already depend on nest-kit from increment 1's guards). If any prints `0`, add `"@things/nest-kit": "*"` to that app's `dependencies` and re-run `npm install`.

- [ ] **Step 3: Typecheck each app**

Run:

```bash
for app in api-auth api-do api-say api-buy api-eat api-send; do echo "== $app =="; npm run typecheck -w @things/$app 2>&1 | tail -1; done
```

Expected: every app typechecks (the `INestApplication` return is discarded via `void`).

- [ ] **Step 4: Commit**

```bash
git add apps/api-auth/src/main.ts apps/api-do/src/main.ts apps/api-say/src/main.ts apps/api-buy/src/main.ts apps/api-eat/src/main.ts apps/api-send/src/main.ts
git commit -m "refactor(api): bootstrap via @things/nest-kit in all 6 apps

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Workspace gate + PR

- [ ] **Step 1: Confirm no app re-implements the bootstrap**

```bash
grep -rn "NestFactory" apps/*/src/main.ts || echo "no app main.ts calls NestFactory directly"
```

Expected: none — bootstrap is centralized.

- [ ] **Step 2: Run the CI gate**

```bash
npm run build:packages
npm run typecheck
npm run lint
npm run test:unit
```

Expected: all PASS across the workspace (nest-kit gains 1 test; app unit suites unchanged).

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin refactor/nest-kit-bootstrap
gh pr create --base main --title "refactor(api): shared bootstrapThingsApp in @things/nest-kit" \
  --body "Collapses the byte-identical main.ts bootstrap across all 6 API apps into @things/nest-kit's bootstrapThingsApp({ name, module, port }). No behavior change. Spec: docs/superpowers/specs/2026-06-12-nest-kit-finish-bootstrap-prisma.md (PR-A). PR-B (Prisma lifecycle) follows."
```

---

## Self-review (plan vs. spec PR-A)

- **Spec coverage:** `bootstrapThingsApp` helper + test + `@nestjs/core` peer (Task 1); 6 `main.ts` wrappers preserving `loadEnv()` + `console.warn` (Task 2); centralization check + gate (Task 3). Covered.
- **Placeholder scan:** none — full helper, full test, exact wrapper with per-app `name` list.
- **Consistency:** `bootstrapThingsApp({ name, module, port })` signature identical in helper, test, and all 6 wrappers; `void` discards the returned `INestApplication`.
