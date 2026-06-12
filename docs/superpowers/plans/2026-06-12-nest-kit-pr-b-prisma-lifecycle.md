# nest-kit finish — PR-B: `PrismaLifecycleMixin` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Share the Nest-DI Prisma connection lifecycle via a `PrismaLifecycleMixin(Base)` in `@things/nest-kit`; adopt it in the 4 apps that already have a `PrismaService` (buy/eat/say/send) and bring `api-do` into line by giving it a real `PrismaService` (replacing its raw `PrismaClient` DI token).

**Architecture:** A generic mixin injects `onModuleInit`→`$connect` / `onModuleDestroy`→`$disconnect` into any generated `PrismaClient` subclass while preserving its full type. api-do additionally gains a `@Global() PrismaModule` (mirroring api-buy) and rewires `tasks.module`/`tasks.service` from `PrismaClient` to `PrismaService`. api-auth is untouched (no domain DB). No behavior change.

**Tech Stack:** NestJS 11 DI, Prisma 5 generated clients, Jest 29 + `@swc/jest` (nest-kit) / jest-expo-less node (apps).

**Spec:** `docs/superpowers/specs/2026-06-12-nest-kit-finish-bootstrap-prisma.md` — PR-B section.

---

## Preconditions

- Branch `refactor/nest-kit-prisma` (off `main` after PR #13 merged). nest-kit already exports `bootstrapThingsApp`; `@nestjs/common` is a peer.
- **api-do test wiring (verified):** `tasks.service.spec.ts` constructs `new TasksService(prisma as unknown as PrismaClient)` (a hand-built mock) — only the cast type changes. `tasks.integration.spec.ts` boots the real `AppModule` via `Test.createTestingModule({ imports: [AppModule] })`, so once `AppModule` imports `PrismaModule`, DI resolves `PrismaService` with **no integration-test change**.

## File Structure

| File                                                       | Change     | Responsibility                               |
| ---------------------------------------------------------- | ---------- | -------------------------------------------- |
| `packages/nest-kit/src/prisma-lifecycle.ts`                | **create** | `PrismaLifecycleMixin`                       |
| `packages/nest-kit/src/__tests__/prisma-lifecycle.test.ts` | **create** | Mixin unit test                              |
| `packages/nest-kit/src/index.ts`                           | modify     | Export the mixin                             |
| `apps/api-{buy,eat,say,send}/src/prisma/prisma.service.ts` | modify     | `extends PrismaLifecycleMixin(PrismaClient)` |
| `apps/api-do/src/prisma/prisma.service.ts`                 | **create** | api-do's `PrismaService`                     |
| `apps/api-do/src/prisma/prisma.module.ts`                  | **create** | `@Global()` provider (mirror api-buy)        |
| `apps/api-do/src/app.module.ts`                            | modify     | Import `PrismaModule`                        |
| `apps/api-do/src/tasks/tasks.module.ts`                    | modify     | Drop the `PrismaClient` factory provider     |
| `apps/api-do/src/tasks/tasks.service.ts`                   | modify     | Inject `PrismaService`                       |
| `apps/api-do/src/tasks/__tests__/tasks.service.spec.ts`    | modify     | Cast mock to `PrismaService`                 |

---

## Task 1: `PrismaLifecycleMixin` in `@things/nest-kit`

**Files:** create `packages/nest-kit/src/prisma-lifecycle.ts`, `packages/nest-kit/src/__tests__/prisma-lifecycle.test.ts`; modify `packages/nest-kit/src/index.ts`.

- [ ] **Step 1: Write the failing test** — `packages/nest-kit/src/__tests__/prisma-lifecycle.test.ts`:

```ts
import { PrismaLifecycleMixin } from '../prisma-lifecycle';

describe('PrismaLifecycleMixin', () => {
  it('calls $connect on module init and $disconnect on module destroy', async () => {
    const $connect = jest.fn().mockResolvedValue(undefined);
    const $disconnect = jest.fn().mockResolvedValue(undefined);
    class FakeClient {
      $connect = $connect;
      $disconnect = $disconnect;
    }
    class Service extends PrismaLifecycleMixin(FakeClient) {}

    const svc = new Service();
    await svc.onModuleInit();
    expect($connect).toHaveBeenCalledTimes(1);
    await svc.onModuleDestroy();
    expect($disconnect).toHaveBeenCalledTimes(1);
  });

  it('preserves base-class members on the mixed class', () => {
    class FakeClient {
      $connect = jest.fn().mockResolvedValue(undefined);
      $disconnect = jest.fn().mockResolvedValue(undefined);
      ping(): string {
        return 'pong';
      }
    }
    class Service extends PrismaLifecycleMixin(FakeClient) {}
    expect(new Service().ping()).toBe('pong');
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module '../prisma-lifecycle'`)

Run: `npm run test:unit -w @things/nest-kit -- prisma-lifecycle.test`

- [ ] **Step 3: Implement `packages/nest-kit/src/prisma-lifecycle.ts`**

```ts
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

/** The connection-lifecycle surface every generated PrismaClient exposes. */
export interface PrismaLifecycleClient {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}

// A mixin base must use an `any[]` rest constructor (TS requirement for `extends`).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctor<T> = new (...args: any[]) => T;

/**
 * Mixes Nest's connect-on-init / disconnect-on-destroy lifecycle into a
 * generated PrismaClient subclass:
 *   @Injectable()
 *   export class PrismaService extends PrismaLifecycleMixin(PrismaClient) {}
 */
export function PrismaLifecycleMixin<TBase extends Ctor<PrismaLifecycleClient>>(Base: TBase) {
  class PrismaLifecycle extends Base implements OnModuleInit, OnModuleDestroy {
    async onModuleInit(): Promise<void> {
      await this.$connect();
    }
    async onModuleDestroy(): Promise<void> {
      await this.$disconnect();
    }
  }
  return PrismaLifecycle;
}
```

- [ ] **Step 4: Run it — expect PASS** (2 tests)

Run: `npm run test:unit -w @things/nest-kit -- prisma-lifecycle.test`

- [ ] **Step 5: Export it** — append to `packages/nest-kit/src/index.ts`:

```ts
export { PrismaLifecycleMixin, type PrismaLifecycleClient } from './prisma-lifecycle';
```

- [ ] **Step 6: Build + typecheck + lint**

Run:

```bash
npm run build -w @things/nest-kit
npm run typecheck -w @things/nest-kit
npm run lint -w @things/nest-kit
```

Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add packages/nest-kit/src/prisma-lifecycle.ts packages/nest-kit/src/__tests__/prisma-lifecycle.test.ts packages/nest-kit/src/index.ts
git commit -m "feat(nest-kit): PrismaLifecycleMixin

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Adopt the mixin in buy/eat/say/send

**Files:** modify `apps/api-{buy,eat,say,send}/src/prisma/prisma.service.ts`.

- [ ] **Step 1: Rewrite each `prisma.service.ts`** (identical across the 4 apps) to:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaLifecycleMixin } from '@things/nest-kit';
import { PrismaClient } from '../../prisma/generated/client';

@Injectable()
export class PrismaService extends PrismaLifecycleMixin(PrismaClient) {}
```

- [ ] **Step 2: Typecheck + unit-test each app**

Run:

```bash
for app in api-buy api-eat api-say api-send; do
  echo "== $app =="
  npm run typecheck -w @things/$app 2>&1 | tail -1
  npm run test:unit -w @things/$app 2>&1 | grep -E "Tests:|FAIL"
done
```

Expected: every app typechecks (the mixed class keeps every model delegate) and its unit suite passes (PrismaService is still a class; tests that cast a mock to `PrismaService` are unaffected).

- [ ] **Step 3: Commit**

```bash
git add apps/api-buy/src/prisma/prisma.service.ts apps/api-eat/src/prisma/prisma.service.ts apps/api-say/src/prisma/prisma.service.ts apps/api-send/src/prisma/prisma.service.ts
git commit -m "refactor(api): PrismaService via @things/nest-kit mixin (buy/eat/say/send)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Give api-do a real `PrismaService`

**Files:** create `apps/api-do/src/prisma/prisma.service.ts`, `apps/api-do/src/prisma/prisma.module.ts`; modify `apps/api-do/src/app.module.ts`, `apps/api-do/src/tasks/tasks.module.ts`, `apps/api-do/src/tasks/tasks.service.ts`, `apps/api-do/src/tasks/__tests__/tasks.service.spec.ts`.

- [ ] **Step 1: Create `apps/api-do/src/prisma/prisma.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaLifecycleMixin } from '@things/nest-kit';
import { PrismaClient } from '../../prisma/generated/client';

@Injectable()
export class PrismaService extends PrismaLifecycleMixin(PrismaClient) {}
```

- [ ] **Step 2: Create `apps/api-do/src/prisma/prisma.module.ts`** (mirrors api-buy)

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

- [ ] **Step 3: Import `PrismaModule` in `apps/api-do/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [PrismaModule, TasksModule],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 4: Drop the `PrismaClient` factory from `apps/api-do/src/tasks/tasks.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
```

- [ ] **Step 5: Inject `PrismaService` in `apps/api-do/src/tasks/tasks.service.ts`**

Change the top two lines from:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '../../prisma/generated/client';
```

to:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
```

and change the constructor from `constructor(private readonly prisma: PrismaClient) {}` to:

```ts
  constructor(private readonly prisma: PrismaService) {}
```

(The `Prisma` namespace import stays — the service uses `Prisma.InputJsonValue` / `Prisma.JsonNull`. All `this.prisma.task.*` calls are unchanged: `PrismaService` carries every delegate.)

- [ ] **Step 6: Update the unit spec cast** — in `apps/api-do/src/tasks/__tests__/tasks.service.spec.ts`, add the import and change the cast:

Add near the top:

```ts
import { PrismaService } from '../../prisma/prisma.service';
```

Change `service = new TasksService(prisma as unknown as PrismaClient);` to:

```ts
service = new TasksService(prisma as unknown as PrismaService);
```

(Leave the `jest.mock('../../../prisma/generated/client', …)` block and the `PrismaClient` import that builds the mock — `PrismaClient` is still used to construct the fake.)

- [ ] **Step 7: Typecheck + unit-test api-do**

Run:

```bash
npm run typecheck -w @things/api-do
npm run test:unit -w @things/api-do
```

Expected: typecheck clean; unit suite passes (`tasks.service.spec` now casts to `PrismaService`; controller spec untouched). The task integration spec is covered in CI.

- [ ] **Step 8: Commit**

```bash
git add apps/api-do/src/prisma apps/api-do/src/app.module.ts apps/api-do/src/tasks/tasks.module.ts apps/api-do/src/tasks/tasks.service.ts apps/api-do/src/tasks/__tests__/tasks.service.spec.ts
git commit -m "refactor(api-do): adopt a PrismaService (nest-kit lifecycle mixin)

Replaces the raw PrismaClient DI token with a @Global PrismaModule-provided
PrismaService, matching the other domain apps.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Workspace gate + PR

- [ ] **Step 1: Confirm the lifecycle is centralized**

```bash
grep -rn "onModuleInit" apps/*/src/prisma/prisma.service.ts || echo "no app re-implements the lifecycle"
grep -rln "PrismaLifecycleMixin" apps/*/src/prisma/prisma.service.ts | wc -l   # expect 5
```

Expected: no app declares `onModuleInit` in its `prisma.service.ts`; 5 apps use the mixin.

- [ ] **Step 2: Run the CI gate**

```bash
npm run build:packages
npm run typecheck
npm run lint
npm run test:unit
```

Expected: all PASS (nest-kit gains the mixin test; app suites unchanged in count except api-do's cast).

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin refactor/nest-kit-prisma
gh pr create --base main --title "refactor(api): shared PrismaLifecycleMixin in @things/nest-kit" \
  --body "PR-B (final) of the nest-kit refactor (spec: docs/superpowers/specs/2026-06-12-nest-kit-finish-bootstrap-prisma.md). Adds PrismaLifecycleMixin to @things/nest-kit; buy/eat/say/send adopt it, and api-do gains a real PrismaService (+@Global PrismaModule), replacing its raw PrismaClient DI token. api-auth untouched (no domain DB). No behavior change."
```

---

## Self-review (plan vs. spec PR-B)

- **Spec coverage:** mixin + test + export (Task 1); buy/eat/say/send adopt it (Task 2); api-do gains PrismaService + PrismaModule + app.module wire + tasks.module/service rewire + spec cast (Task 3); centralization check + gate (Task 4). api-auth excluded (not in any task). Covered.
- **Placeholder scan:** none — full mixin, full test, full per-file edits with exact before/after.
- **Consistency:** `PrismaLifecycleMixin(PrismaClient)` identical in all 5 `prisma.service.ts`; api-do's `PrismaModule` mirrors api-buy's exactly; `tasks.service` keeps the `Prisma` namespace import (needed for `Prisma.JsonNull`); the spec's risk note (api-do integration test needs no change because it boots the real `AppModule`) is reflected in Task 3 Step 7.
