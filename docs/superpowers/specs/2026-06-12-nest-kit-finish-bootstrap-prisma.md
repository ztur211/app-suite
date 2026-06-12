# Finish the nest-kit refactor — shared bootstrap + Prisma lifecycle — design

> **Status:** 📝 designed (2026-06-12). Closes out the audit-driven cross-app duplication refactor (increments 1–3 merged; web-app dedup done via `@things/web-kit`).
> **Sub-skill for implementation:** `superpowers:writing-plans` → `superpowers:test-driven-development`.

## Goal

Remove the last two pockets of cross-app NestJS duplication the audit flagged, by adding two helpers to `@things/nest-kit`:

1. **`bootstrapThingsApp({ name, module, port })`** — the `main.ts` bootstrap is byte-identical across all 6 API apps except the `[api-X]` log tag.
2. **`PrismaLifecycleMixin(Base)`** — the Nest-DI `PrismaService` (`onModuleInit`→`$connect` / `onModuleDestroy`→`$disconnect`) is byte-identical across the apps that have one.

## Non-goals / scope clarification

- **Better Auth clients stay module-level.** Every app's `auth/auth.ts` instantiates a `PrismaClient`/`AuthPrismaClient` at import time for Better Auth's `prismaAdapter`. That is configured outside Nest DI (synchronously, before `onModuleInit`) and is **not** a candidate for a Nest-managed service. Untouched.
- **`api-auth` is excluded from the Prisma work.** It is the auth issuer and has **no domain DB** — its only Prisma usage is the Better Auth client above. There is nothing to give it a domain `PrismaService` for. ("Unify all 6" therefore means: unify the 5 apps with a domain DB.)
- No logging-framework change (`console.warn` startup line is preserved verbatim).

## Decisions (with rejected alternatives)

- **Mixin, not a shared base class, for Prisma.** Each app's `PrismaService` must `extends` its **own generated** `PrismaClient` (distinct generated types per app), so a single base class can't work. `PrismaLifecycleMixin(PrismaClient)` injects the lifecycle while preserving the app's full generated client type. Rejected a shared `@Injectable PrismaService` in nest-kit (can't extend an app-specific generated client).
- **Two PRs, to isolate risk.** PR-A (bootstrap) is pure boilerplate collapse. PR-B (Prisma) includes the one behavior-adjacent change — `api-do`'s DI token moves from raw `PrismaClient` to a new `PrismaService`. Keeping them separate makes the riskier diff reviewable on its own.
- **`@nestjs/core` becomes a nest-kit peerDependency** (for `NestFactory`); `@things/auth` is already a dep (for `trustedWebOrigins`).

---

## `@things/nest-kit` additions

### `src/bootstrap.ts`

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

Unit test mocks `@nestjs/core` (`NestFactory.create`) and `@things/auth` (`trustedWebOrigins`); asserts create→module, enableCors→`{ origin, credentials: true }`, listen→port.

### `src/prisma-lifecycle.ts`

```ts
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

/** The connection-lifecycle surface every generated PrismaClient exposes. */
export interface PrismaLifecycleClient {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}

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

Unit test: a fake client with `$connect`/`$disconnect` spies; `class S extends PrismaLifecycleMixin(Fake) {}`; `onModuleInit()`→connect called, `onModuleDestroy()`→disconnect called.

Both exported from `src/index.ts`.

---

## PR-A — shared bootstrap (all 6 apps)

Each `apps/api-*/src/main.ts` collapses to:

```ts
import 'dotenv/config';
import 'reflect-metadata';
import { bootstrapThingsApp } from '@things/nest-kit';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

void bootstrapThingsApp({ name: 'api-do', module: AppModule, port: loadEnv().PORT });
```

(`loadEnv()` is still called — it performs the fail-fast env validation added in PR #9 — and supplies `PORT`.) Verification: `typecheck` + `lint` + `build:packages` (main.ts is not exercised by unit tests; boot is covered by integration/e2e in CI).

## PR-B — Prisma lifecycle (5 domain-DB apps)

- **buy / eat / say / send:** `src/prisma/prisma.service.ts` becomes:

  ```ts
  import { Injectable } from '@nestjs/common';
  import { PrismaLifecycleMixin } from '@things/nest-kit';
  import { PrismaClient } from '../../prisma/generated/client';

  @Injectable()
  export class PrismaService extends PrismaLifecycleMixin(PrismaClient) {}
  ```

- **api-do:** gains `src/prisma/prisma.service.ts` (as above) + `src/prisma/prisma.module.ts` (mirroring api-buy's); `tasks.module.ts` drops the `PrismaClient` factory provider and imports `PrismaModule`; `tasks.service.ts` injects `PrismaService` instead of `PrismaClient`. The integration tests (api-do tasks) verify behavior in CI.
- **api-auth:** untouched (no domain DB).

Each app's existing unit + integration suites are the safety net; `PrismaLifecycleMixin` itself is unit-tested in nest-kit.

---

## Risks / watch-items

- **api-do DI rewire** is the only behavior-adjacent change: `TasksService`'s injected token changes from `PrismaClient` to `PrismaService`. The factory currently passes `datasources.db.url = DATABASE_URL` explicitly; the generated client already defaults to `DATABASE_URL`, so the new no-arg `PrismaService` resolves the same connection. Confirmed by api-do's existing task integration tests (CI).
- **Mixin typing:** `PrismaLifecycleMixin(PrismaClient)` must preserve the full generated client instance type so injected `PrismaService` keeps every model delegate. `extends Base` (generic) preserves it; `typecheck` across the apps is the gate.
- **`console.warn` + lint:** the startup log uses `console.warn` (as today's main.ts does and passes lint); kept verbatim.
