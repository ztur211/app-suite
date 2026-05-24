# Say Things — Backend (api-say) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `apps/api-say` NestJS service end-to-end — record-then-classify pipeline, dispatch handlers (DO/NOTE/SEND/BUY/EAT), idempotency, reclassify, the inbound pending API for future Buy/Eat apps, and the intent-classification eval harness. Also lands the cross-app prerequisites (User.timezone column, api-do `source` field, Say-Things payload schemas, `@things/say-sdk` package).

**Architecture:** Mirrors the api-do pattern — own Prisma schema with mirrored Better Auth tables pointing at the shared `things_auth.db`. NestJS modules: `auth/`, `idempotency/`, `dictations/`, `dispatch/`, `pending/`. AI calls go through `@things/ai` (interface only — implementation is P4, a separate plan that MUST land before this one executes). Cross-app `DO` dispatch calls `@things/do-sdk` with a signed service JWT. Inbound pending API is guarded by a `ServiceJwtGuard` whitelisting `api-buy` / `api-eat` as callers.

**Tech Stack:** NestJS 11, Prisma 5, SQLite (dev), Better Auth 1.x, multer (audio upload), TypeScript 5.6 strict, Jest 29 (unit + integration), supertest, @nestjs/schedule (cron), Zod (env + payload validation).

**Spec:** `../../../project-ideas/docs/superpowers/specs/2026-05-22-say-things-design.md`

## Hard prerequisites (MUST be complete before any task here runs)

1. **P4 — `@things/ai` package built** per foundation spec §5: exposes `transcribe()` (OpenAI Whisper) and `chatStructured()` (Claude Haiku 4.5 with `cacheSystem: true`). This plan calls those methods; it does not implement them. P4 has its own brainstorm + spec + plan. **API surface required by this plan:** `AiClient` exported as a class (not just an interface) so it can serve as a NestJS DI token; `createAiClient(opts)` factory taking `{ openaiApiKey, anthropicApiKey }` and returning an `AiClient` instance. P4's plan must include both.
2. **`@things/do-sdk` exists** with `tasks.create()` and `tasks.delete()`. (Already built in Do Things v1 — verify by reading `packages/do-sdk/src/`.)
3. **`@things/auth/service-jwt` exists** with `sign()` and `verify()`. (Already built in P3 — verify by reading `packages/auth/src/service-jwt/`.)

If any of these is missing, stop and build it first.

---

## File Map

| Path                                                                     | Action | Responsibility                                                                                                                                                                |
| ------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 0 — Foundation extensions**                                      |        |                                                                                                                                                                               |
| `apps/api-auth/prisma/schema.prisma`                                     | Modify | Add `User.timezone String @default("UTC")`                                                                                                                                    |
| `apps/api-auth/src/auth/auth.ts`                                         | Modify | Add `additionalFields.user.timezone` to Better Auth config                                                                                                                    |
| `apps/api-auth/prisma/migrations/<ts>_user_timezone/`                    | Create | Migration                                                                                                                                                                     |
| `apps/api-do/prisma/schema.prisma`                                       | Modify | Mirror `User.timezone`                                                                                                                                                        |
| `apps/api-do/prisma/migrations/<ts>_user_timezone/`                      | Create | Migration                                                                                                                                                                     |
| `apps/api-do/src/tasks/tasks.service.ts`                                 | Modify | Accept optional `source: { app, dictationId }` in `create()`                                                                                                                  |
| `apps/api-do/src/tasks/tasks.controller.ts`                              | Modify | Add `source` to CreateTaskDto                                                                                                                                                 |
| `apps/api-do/src/tasks/__tests__/tasks.service.spec.ts`                  | Modify | Test `source` round-trip                                                                                                                                                      |
| `apps/api-do/src/tasks/__tests__/tasks.controller.spec.ts`               | Modify | Test DTO accepts `source`                                                                                                                                                     |
| `apps/api-do/src/auth/service-jwt.guard.ts`                              | Create | Whitelist `api-say` for `POST /tasks`                                                                                                                                         |
| `packages/do-sdk/src/tasks.ts`                                           | Modify | Add `source?: { app, dictationId }` to `create()` params                                                                                                                      |
| `packages/do-sdk/src/__tests__/tasks.spec.ts`                            | Modify | Test source round-trip                                                                                                                                                        |
| **Phase 1 — `@things/types` payloads**                                   |        |                                                                                                                                                                               |
| `packages/types/src/say-things/payloads.ts`                              | Create | Zod schemas for each intent payload + `intentResult` discriminated union                                                                                                      |
| `packages/types/src/say-things/index.ts`                                 | Create | Barrel                                                                                                                                                                        |
| `packages/types/src/index.ts`                                            | Modify | Re-export `say-things`                                                                                                                                                        |
| `packages/types/__tests__/say-things/payloads.spec.ts`                   | Create | Round-trip + invalid-input tests                                                                                                                                              |
| **Phase 2 — `@things/say-sdk`**                                          |        |                                                                                                                                                                               |
| `packages/say-sdk/package.json`                                          | Modify | Add deps `axios`, `@things/auth`, `@things/types`                                                                                                                             |
| `packages/say-sdk/src/index.ts`                                          | Create | `SaySdk` class + barrel                                                                                                                                                       |
| `packages/say-sdk/src/pending.ts`                                        | Create | `SayPendingApi` with `list()` and `consume()`                                                                                                                                 |
| `packages/say-sdk/__tests__/pending.spec.ts`                             | Create | Unit tests with mocked axios                                                                                                                                                  |
| **Phase 3 — api-say Prisma + env**                                       |        |                                                                                                                                                                               |
| `apps/api-say/prisma/schema.prisma`                                      | Create | `Dictation`, `IdempotencyKey`, mirrored Better Auth tables                                                                                                                    |
| `apps/api-say/.env.example`                                              | Create | Document env vars                                                                                                                                                             |
| `apps/api-say/.env`                                                      | Create | Real dev values (gitignored)                                                                                                                                                  |
| `apps/api-say/package.json`                                              | Modify | Add `@prisma/client`, `prisma`, `better-auth`, `multer`, `@types/multer`, `@nestjs/schedule`, `@things/ai`, `@things/do-sdk`, `@things/auth`, `@things/types`, `zod`, `luxon` |
| `apps/api-say/prisma/migrations/<ts>_init/`                              | Create | Initial migration                                                                                                                                                             |
| **Phase 4 — api-say auth + Prisma module**                               |        |                                                                                                                                                                               |
| `apps/api-say/src/auth/auth.ts`                                          | Create | `betterAuth()` instance with `additionalFields.user.timezone`                                                                                                                 |
| `apps/api-say/src/auth/session.guard.ts`                                 | Create | Validate cookie → attach `req.session = { user: { id, timezone } }`                                                                                                           |
| `apps/api-say/src/auth/__tests__/session.guard.spec.ts`                  | Create | Unit tests                                                                                                                                                                    |
| `apps/api-say/src/prisma/prisma.service.ts`                              | Create | Shared PrismaClient (extends `PrismaClient implements OnModuleInit`)                                                                                                          |
| `apps/api-say/src/prisma/prisma.module.ts`                               | Create | Global module exporting PrismaService                                                                                                                                         |
| `apps/api-say/src/config/env.ts`                                         | Create | Zod env schema + factory                                                                                                                                                      |
| `apps/api-say/src/config/__tests__/env.spec.ts`                          | Create | Reject missing/invalid env                                                                                                                                                    |
| **Phase 5 — Idempotency**                                                |        |                                                                                                                                                                               |
| `apps/api-say/src/idempotency/idempotency.interceptor.ts`                | Create | Stripe-style key-check; replay on hit; 409 on conflict                                                                                                                        |
| `apps/api-say/src/idempotency/idempotency.module.ts`                     | Create | Module wiring                                                                                                                                                                 |
| `apps/api-say/src/idempotency/__tests__/idempotency.interceptor.spec.ts` | Create | Replay / conflict / concurrent race tests                                                                                                                                     |
| `apps/api-say/src/idempotency/cleanup.cron.ts`                           | Create | Nightly cron deleting expired keys                                                                                                                                            |
| `apps/api-say/src/idempotency/__tests__/cleanup.cron.spec.ts`            | Create | Test                                                                                                                                                                          |
| **Phase 6 — AI prompts**                                                 |        |                                                                                                                                                                               |
| `apps/api-say/src/ai/prompts/intent-classify-prompt.ts`                  | Create | `INTENT_CLASSIFY_PROMPT` (the static cacheable system prompt)                                                                                                                 |
| `apps/api-say/src/ai/prompts/intent-classify-examples.ts`                | Create | 8-10 hand-curated few-shot examples                                                                                                                                           |
| `apps/api-say/src/ai/prompts/reshape-prompts.ts`                         | Create | One reshape prompt per intent (`RESHAPE_PROMPT_BY_INTENT`)                                                                                                                    |
| `apps/api-say/src/ai/__tests__/prompts.spec.ts`                          | Create | Snapshot tests (prompt content is stable & cacheable)                                                                                                                         |
| **Phase 7 — Dispatch handlers**                                          |        |                                                                                                                                                                               |
| `apps/api-say/src/dispatch/intent-destination.ts`                        | Create | `intentToDestination` static map                                                                                                                                              |
| `apps/api-say/src/dispatch/handlers/do.handler.ts`                       | Create | Calls `@things/do-sdk` `tasks.create()`                                                                                                                                       |
| `apps/api-say/src/dispatch/handlers/note.handler.ts`                     | Create | No-op (returns null destinationRef)                                                                                                                                           |
| `apps/api-say/src/dispatch/handlers/send.handler.ts`                     | Create | Renders email text; returns it in response                                                                                                                                    |
| `apps/api-say/src/dispatch/handlers/buy.handler.ts`                      | Create | No-op (PENDING_BUY)                                                                                                                                                           |
| `apps/api-say/src/dispatch/handlers/eat.handler.ts`                      | Create | No-op (PENDING_EAT)                                                                                                                                                           |
| `apps/api-say/src/dispatch/dispatch.service.ts`                          | Create | Branches on intent → handler                                                                                                                                                  |
| `apps/api-say/src/dispatch/__tests__/*.spec.ts`                          | Create | Per-handler unit tests                                                                                                                                                        |
| `apps/api-say/src/dispatch/dispatch.module.ts`                           | Create | Module wiring                                                                                                                                                                 |
| **Phase 8 — Dictations endpoint**                                        |        |                                                                                                                                                                               |
| `apps/api-say/src/dictations/dto/create-dictation.dto.ts`                | Create | `previewTranscript`, `captureMode`                                                                                                                                            |
| `apps/api-say/src/dictations/dto/reclassify.dto.ts`                      | Create | `forceIntent`                                                                                                                                                                 |
| `apps/api-say/src/dictations/dictations.service.ts`                      | Create | `create`, `dispatch`, `reclassify`, `undoDispatch`, `list`, `remove`                                                                                                          |
| `apps/api-say/src/dictations/dictations.controller.ts`                   | Create | Routes per §3 architecture                                                                                                                                                    |
| `apps/api-say/src/dictations/dictations.module.ts`                       | Create | Module wiring                                                                                                                                                                 |
| `apps/api-say/src/dictations/__tests__/dictations.service.spec.ts`       | Create | Unit tests (mocked AI + dispatch)                                                                                                                                             |
| `apps/api-say/src/dictations/__tests__/dictations.controller.spec.ts`    | Create | Unit tests                                                                                                                                                                    |
| `apps/api-say/src/dictations/__tests__/dictations.integration.spec.ts`   | Create | Real DB + supertest; mocked AI                                                                                                                                                |
| **Phase 9 — Pending API (inbound from future Buy/Eat)**                  |        |                                                                                                                                                                               |
| `apps/api-say/src/pending/service-jwt.guard.ts`                          | Create | Validate inbound JWT; whitelist `api-buy`, `api-eat`                                                                                                                          |
| `apps/api-say/src/pending/pending.controller.ts`                         | Create | `GET /pending`, `POST /pending/:id/consume`                                                                                                                                   |
| `apps/api-say/src/pending/pending.service.ts`                            | Create | Query + consume logic                                                                                                                                                         |
| `apps/api-say/src/pending/pending.module.ts`                             | Create | Module wiring                                                                                                                                                                 |
| `apps/api-say/src/pending/__tests__/*.spec.ts`                           | Create | Guard + service + integration tests                                                                                                                                           |
| **Phase 10 — App wiring**                                                |        |                                                                                                                                                                               |
| `apps/api-say/src/app.module.ts`                                         | Modify | Import all feature modules + cron                                                                                                                                             |
| `apps/api-say/src/main.ts`                                               | Modify | CORS for `http://localhost:8081`, `http://localhost:8082`; multer config                                                                                                      |
| **Phase 11 — Eval harness**                                              |        |                                                                                                                                                                               |
| `apps/api-say/__tests__/eval/intent-classification/cases.jsonl`          | Create | 50 hand-curated cases                                                                                                                                                         |
| `apps/api-say/__tests__/eval/intent-classification/run-eval.ts`          | Create | CLI: runs each case through real `chatStructured`, reports accuracy + Brier                                                                                                   |
| `apps/api-say/__tests__/eval/intent-classification/baseline.json`        | Create | Initial known-good metrics                                                                                                                                                    |
| `apps/api-say/package.json`                                              | Modify | Add `eval:intent` script + CI gate                                                                                                                                            |
| **Phase 12 — Cross-app contract test**                                   |        |                                                                                                                                                                               |
| `apps/api-say/__tests__/e2e/cross-app/say-to-do.e2e.spec.ts`             | Create | Boots api-auth + api-do + api-say in Testcontainers; full dispatch round-trip + undo                                                                                          |

---

## Phase 0 — Foundation extensions

These are small extensions to api-auth and api-do that unblock api-say. Each is small but touches multiple apps.

### Task 0.1: Add `User.timezone` to api-auth schema + Better Auth config

**Files:**

- Modify: `apps/api-auth/prisma/schema.prisma`
- Modify: `apps/api-auth/src/auth/auth.ts`
- Create: `apps/api-auth/prisma/migrations/<ts>_user_timezone/migration.sql` (generated)

- [ ] **Step 1: Write a failing integration test in api-auth that signs up a user with a timezone field**

Append to `apps/api-auth/src/auth/__tests__/auth.integration.spec.ts`:

```typescript
it('persists timezone on signup', async () => {
  const res = await request(app.getHttpServer())
    .post('/auth/sign-up/email')
    .send({
      email: 'tz@example.com',
      password: 'password123',
      name: 'TZ User',
      timezone: 'Pacific/Auckland',
    })
    .expect(200);

  const user = await prisma.user.findUnique({ where: { email: 'tz@example.com' } });
  expect(user?.timezone).toBe('Pacific/Auckland');
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npm -w apps/api-auth run test:integration -- auth.integration.spec.ts`
Expected: FAIL — `timezone` field unknown OR DB column missing.

- [ ] **Step 3: Add the column to the Prisma schema**

In `apps/api-auth/prisma/schema.prisma`, modify the `User` model:

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified Boolean   @default(false)
  name          String?
  image         String?
  timezone      String    @default("UTC")    // NEW — IANA name; captured at signup
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]
}
```

- [ ] **Step 4: Generate the migration**

Run: `npm -w apps/api-auth exec prisma migrate dev --name user_timezone`
Expected: New migration directory under `apps/api-auth/prisma/migrations/<ts>_user_timezone/` with `ALTER TABLE "User" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC'`.

- [ ] **Step 5: Add `timezone` to Better Auth `additionalFields`**

In `apps/api-auth/src/auth/auth.ts`, in the `betterAuth({...})` call:

```typescript
export const auth = betterAuth({
  // ... existing config ...
  user: {
    additionalFields: {
      timezone: {
        type: 'string',
        defaultValue: 'UTC',
        required: false,
      },
    },
  },
});
```

- [ ] **Step 6: Run the test, confirm it passes**

Run: `npm -w apps/api-auth run test:integration -- auth.integration.spec.ts`
Expected: PASS.

- [ ] **Step 7: Run the full api-auth test suite**

Run: `npm -w apps/api-auth run test:unit && npm -w apps/api-auth run test:integration`
Expected: All green.

- [ ] **Step 8: Commit**

```bash
git add apps/api-auth/prisma/schema.prisma apps/api-auth/prisma/migrations apps/api-auth/src/auth
git commit -m "feat(api-auth): add User.timezone field (IANA) captured at signup"
```

### Task 0.2: Mirror `User.timezone` in api-do schema

**Files:**

- Modify: `apps/api-do/prisma/schema.prisma`
- Create: `apps/api-do/prisma/migrations/<ts>_user_timezone/migration.sql`

- [ ] **Step 1: Add `timezone` to the mirrored `User` model in api-do**

In `apps/api-do/prisma/schema.prisma`, modify the `User` model the same way as Task 0.1 step 3.

- [ ] **Step 2: Generate the migration**

Run: `npm -w apps/api-do exec prisma migrate dev --name user_timezone`
Expected: Migration created; SQLite file picks up the new column.

- [ ] **Step 3: Run the api-do test suite**

Run: `npm -w apps/api-do run test:unit && npm -w apps/api-do run test:integration`
Expected: All green — no api-do code reads `timezone` yet, so no test changes needed.

- [ ] **Step 4: Commit**

```bash
git add apps/api-do/prisma/schema.prisma apps/api-do/prisma/migrations
git commit -m "feat(api-do): mirror User.timezone from api-auth"
```

### Task 0.3: Extend api-do `POST /tasks` to accept `source` field

**Files:**

- Modify: `apps/api-do/src/tasks/tasks.controller.ts` (CreateTaskDto)
- Modify: `apps/api-do/src/tasks/tasks.service.ts` (create method)
- Modify: `apps/api-do/src/tasks/__tests__/tasks.service.spec.ts`
- Modify: `apps/api-do/src/tasks/__tests__/tasks.controller.spec.ts`

- [ ] **Step 1: Write failing controller test for the new `source` field**

In `apps/api-do/src/tasks/__tests__/tasks.controller.spec.ts`, add:

```typescript
it('accepts and forwards source field', async () => {
  const svc = { create: jest.fn().mockResolvedValue({ id: 't1' }) };
  const ctrl = new TasksController(svc as any);
  const result = await ctrl.create({ userId: 'u1' } as any, {
    title: 'Email Jamie',
    dueAt: null,
    source: { app: 'say-things', dictationId: 'd1' },
  });
  expect(svc.create).toHaveBeenCalledWith('u1', {
    title: 'Email Jamie',
    dueAt: null,
    source: { app: 'say-things', dictationId: 'd1' },
  });
  expect(result).toEqual({ id: 't1' });
});
```

- [ ] **Step 2: Write failing service test that round-trips `source`**

In `apps/api-do/src/tasks/__tests__/tasks.service.spec.ts`, add:

```typescript
it('persists source on create', async () => {
  const created = await service.create('u1', {
    title: 'Email Jamie',
    dueAt: null,
    source: { app: 'say-things', dictationId: 'd1' },
  });
  const found = await prisma.task.findUnique({ where: { id: created.id } });
  expect(found?.source).toEqual({ app: 'say-things', dictationId: 'd1' });
});
```

- [ ] **Step 3: Run both tests, confirm they fail**

Run: `npm -w apps/api-do run test:unit && npm -w apps/api-do run test:integration`
Expected: FAIL — `source` unknown.

- [ ] **Step 4: Add `source` to `Task` model in Prisma**

In `apps/api-do/prisma/schema.prisma`:

```prisma
model Task {
  id        String    @id @default(cuid())
  userId    String
  title     String
  completed Boolean   @default(false)
  dueAt     DateTime?
  source    Json?                                    // NEW — { app: string, dictationId?: string, ... }
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([userId, completed])
  @@index([userId, createdAt])
}
```

- [ ] **Step 5: Generate migration**

Run: `npm -w apps/api-do exec prisma migrate dev --name task_source`

- [ ] **Step 6: Update `CreateTaskDto` and controller**

In `apps/api-do/src/tasks/tasks.controller.ts`:

```typescript
export class CreateTaskDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsOptional() @IsISO8601() dueAt?: string | null;
  @IsOptional() @ValidateNested() source?: TaskSourceDto;
}

export class TaskSourceDto {
  @IsString() app!: string; // e.g. 'say-things'
  @IsOptional() @IsString() dictationId?: string;
}
```

- [ ] **Step 7: Update service `create` to pass `source` through**

In `apps/api-do/src/tasks/tasks.service.ts`:

```typescript
async create(userId: string, dto: CreateTaskDto) {
  return this.prisma.task.create({
    data: {
      userId,
      title: dto.title,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      source: dto.source ?? undefined,
    },
  });
}
```

- [ ] **Step 8: Run tests, confirm they pass**

Run: `npm -w apps/api-do run test:unit && npm -w apps/api-do run test:integration`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api-do/prisma apps/api-do/src/tasks
git commit -m "feat(api-do): accept source field on POST /tasks for cross-app provenance"
```

### Task 0.4: Add `ServiceJwtGuard` to api-do and whitelist `api-say` for `POST /tasks`

**Files:**

- Create: `apps/api-do/src/auth/service-jwt.guard.ts`
- Create: `apps/api-do/src/auth/__tests__/service-jwt.guard.spec.ts`
- Modify: `apps/api-do/src/tasks/tasks.controller.ts` (apply guard to `POST /tasks` as alternative to SessionGuard)

- [ ] **Step 1: Write failing guard test**

`apps/api-do/src/auth/__tests__/service-jwt.guard.spec.ts`:

```typescript
import { ServiceJwtGuard } from '../service-jwt.guard';
import { signServiceToken } from '@things/auth';

describe('ServiceJwtGuard', () => {
  const guard = new ServiceJwtGuard(['api-say']);

  function mockCtx(headers: Record<string, string>) {
    const req = { headers };
    return { switchToHttp: () => ({ getRequest: () => req }) } as any;
  }

  it('accepts valid JWT from whitelisted caller', async () => {
    const token = await signServiceToken({
      iss: 'api-say',
      aud: 'api-do',
      sub: 'u1',
      secret: process.env.SERVICE_TOKEN_SECRET!,
    });
    const ctx = mockCtx({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects JWT from non-whitelisted caller', async () => {
    const token = await signServiceToken({
      iss: 'api-buy',
      aud: 'api-do',
      sub: 'u1',
      secret: process.env.SERVICE_TOKEN_SECRET!,
    });
    const ctx = mockCtx({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/not whitelisted/i);
  });

  it('rejects missing / malformed JWT', async () => {
    await expect(guard.canActivate(mockCtx({}))).rejects.toThrow();
    await expect(guard.canActivate(mockCtx({ authorization: 'foo' }))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npm -w apps/api-do run test:unit -- service-jwt.guard.spec.ts`
Expected: FAIL — guard does not exist.

- [ ] **Step 3: Implement the guard**

`apps/api-do/src/auth/service-jwt.guard.ts`:

```typescript
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { verifyServiceToken } from '@things/auth';

@Injectable()
export class ServiceJwtGuard implements CanActivate {
  constructor(private readonly whitelist: string[]) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header = req.headers['authorization'] as string | undefined;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    const token = header.slice('Bearer '.length);

    let payload;
    try {
      payload = await verifyServiceToken(token, {
        expectedAud: 'api-do',
        secret: process.env.SERVICE_TOKEN_SECRET!,
      });
    } catch (e) {
      throw new UnauthorizedException(`Invalid service token: ${(e as Error).message}`);
    }

    if (!this.whitelist.includes(payload.iss)) {
      throw new ForbiddenException(`Caller ${payload.iss} not whitelisted for this operation`);
    }

    req.serviceCaller = payload; // { iss, aud, sub, iat, exp }
    req.userId = payload.sub; // for the controller
    return true;
  }
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm -w apps/api-do run test:unit -- service-jwt.guard.spec.ts`
Expected: PASS.

- [ ] **Step 5: Apply guard to `POST /tasks` as an alternative to SessionGuard**

In `apps/api-do/src/tasks/tasks.controller.ts`, change the POST decorator to allow EITHER a session OR a service JWT. NestJS doesn't have a built-in OR-guard, so we make a composite:

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { ServiceJwtGuard } from '../auth/service-jwt.guard';

@Injectable()
export class SessionOrServiceJwtGuard implements CanActivate {
  private readonly session = new SessionGuard();
  private readonly service = new ServiceJwtGuard(['api-say']);

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    if (req.headers['authorization']?.startsWith('Bearer ')) {
      return this.service.canActivate(ctx);
    }
    return this.session.canActivate(ctx);
  }
}
```

Apply it:

```typescript
@Post()
@UseGuards(SessionOrServiceJwtGuard)
async create(@Req() req: { userId: string }, @Body() dto: CreateTaskDto) {
  return this.svc.create(req.userId, dto);
}
```

- [ ] **Step 6: Run all api-do tests**

Run: `npm -w apps/api-do run test:unit && npm -w apps/api-do run test:integration`
Expected: All green.

- [ ] **Step 7: Commit**

```bash
git add apps/api-do/src/auth apps/api-do/src/tasks/tasks.controller.ts
git commit -m "feat(api-do): accept service-JWT auth on POST /tasks; whitelist api-say"
```

### Task 0.5: Update `@things/do-sdk` to support `source` field

**Files:**

- Modify: `packages/do-sdk/src/tasks.ts`
- Modify: `packages/do-sdk/src/__tests__/tasks.spec.ts`

- [ ] **Step 1: Write failing test that `tasks.create({source})` forwards `source` in the request body**

In `packages/do-sdk/src/__tests__/tasks.spec.ts`, add:

```typescript
it('forwards source field', async () => {
  axiosMock.onPost('/tasks').reply((config) => {
    expect(JSON.parse(config.data).source).toEqual({ app: 'say-things', dictationId: 'd1' });
    return [201, { id: 't1' }];
  });
  const result = await sdk.tasks.create({
    userId: 'u1',
    title: 'Email Jamie',
    dueAt: null,
    source: { app: 'say-things', dictationId: 'd1' },
  });
  expect(result.id).toBe('t1');
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npm -w packages/do-sdk run test:unit -- tasks.spec.ts`
Expected: FAIL — `source` field stripped or types reject it.

- [ ] **Step 3: Add `source` to the SDK's request shape**

In `packages/do-sdk/src/tasks.ts`:

```typescript
export interface TaskSource {
  app: string;                          // e.g. 'say-things'
  dictationId?: string;
  [k: string]: unknown;
}

export interface CreateTaskParams {
  userId: string;
  title: string;
  dueAt: string | null;
  notes?: string;
  source?: TaskSource;
}

async create(params: CreateTaskParams) {
  const { data } = await this.http.post('/tasks', {
    title:  params.title,
    dueAt:  params.dueAt,
    notes:  params.notes,
    source: params.source,
  }, this.serviceJwtHeaders(params.userId));
  return data as { id: string; userId: string; title: string };
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm -w packages/do-sdk run test:unit -- tasks.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/do-sdk/src
git commit -m "feat(do-sdk): accept source field on tasks.create() for cross-app provenance"
```

---

## Phase 1 — `@things/types` Say-Things payloads

### Task 1.1: Add Zod payload schemas and the `intentResult` discriminated union

**Files:**

- Create: `packages/types/src/say-things/payloads.ts`
- Create: `packages/types/src/say-things/index.ts`
- Modify: `packages/types/src/index.ts`
- Create: `packages/types/__tests__/say-things/payloads.spec.ts`

- [ ] **Step 1: Write failing schema tests**

`packages/types/__tests__/say-things/payloads.spec.ts`:

```typescript
import {
  taskPayload,
  notePayload,
  emailPayload,
  shoppingPayload,
  mealPayload,
  intentResult,
} from '@things/types';

describe('say-things payloads', () => {
  it('taskPayload accepts valid input', () => {
    expect(taskPayload.parse({ title: 'X', dueAt: null })).toEqual({ title: 'X', dueAt: null });
    expect(
      taskPayload.parse({ title: 'X', dueAt: '2026-05-23T17:00:00+12:00', notes: 'n' }),
    ).toBeDefined();
  });

  it('taskPayload rejects empty title', () => {
    expect(() => taskPayload.parse({ title: '', dueAt: null })).toThrow();
  });

  it('notePayload requires non-empty body', () => {
    expect(notePayload.parse({ body: 'hello' })).toEqual({ body: 'hello' });
    expect(() => notePayload.parse({ body: '' })).toThrow();
  });

  it('emailPayload requires subject + body + nullable recipientHint', () => {
    expect(emailPayload.parse({ subject: 'S', body: 'B', recipientHint: null })).toBeDefined();
    expect(emailPayload.parse({ subject: 'S', body: 'B', recipientHint: 'Sarah' })).toBeDefined();
    expect(() => emailPayload.parse({ subject: '', body: 'B', recipientHint: null })).toThrow();
  });

  it('shoppingPayload allows nullable quantity', () => {
    expect(shoppingPayload.parse({ item: 'oat milk', quantity: null })).toBeDefined();
    expect(shoppingPayload.parse({ item: 'oat milk', quantity: 2 })).toBeDefined();
    expect(() => shoppingPayload.parse({ item: 'oat milk', quantity: -1 })).toThrow();
  });

  it('mealPayload constrains kind to enum', () => {
    expect(mealPayload.parse({ name: 'sourdough', kind: 'recipe' })).toBeDefined();
    expect(() => mealPayload.parse({ name: 'sourdough', kind: 'pizza' })).toThrow();
  });

  it('intentResult parses each variant', () => {
    expect(
      intentResult.parse({ intent: 'DO', payload: { title: 'X', dueAt: null }, confidence: 0.9 }),
    ).toBeDefined();
    expect(
      intentResult.parse({ intent: 'NOTE', payload: { body: 'b' }, confidence: 0.9 }),
    ).toBeDefined();
    expect(
      intentResult.parse({
        intent: 'EAT',
        payload: { name: 'x', kind: 'either' },
        confidence: 0.9,
      }),
    ).toBeDefined();
  });

  it('intentResult rejects mismatched payload/intent combos', () => {
    expect(() =>
      intentResult.parse({ intent: 'DO', payload: { body: 'b' }, confidence: 0.9 }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npm -w packages/types run test:unit -- payloads.spec.ts`
Expected: FAIL — module does not export these symbols.

- [ ] **Step 3: Implement schemas**

`packages/types/src/say-things/payloads.ts`:

```typescript
import { z } from 'zod';

export const taskPayload = z.object({
  title: z.string().min(1).max(500),
  dueAt: z.string().datetime({ offset: true }).nullable(),
  notes: z.string().optional(),
});

export const notePayload = z.object({
  title: z.string().max(200).optional(),
  body: z.string().min(1),
});

export const emailPayload = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  recipientHint: z.string().nullable(),
});

export const shoppingPayload = z.object({
  item: z.string().min(1).max(200),
  quantity: z.number().int().positive().nullable(),
  notes: z.string().optional(),
});

export const mealPayload = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(['recipe', 'restaurant', 'either']),
  notes: z.string().optional(),
});

export const intentResult = z.discriminatedUnion('intent', [
  z.object({ intent: z.literal('DO'), payload: taskPayload, confidence: z.number().min(0).max(1) }),
  z.object({
    intent: z.literal('NOTE'),
    payload: notePayload,
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    intent: z.literal('SEND'),
    payload: emailPayload,
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    intent: z.literal('BUY'),
    payload: shoppingPayload,
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    intent: z.literal('EAT'),
    payload: mealPayload,
    confidence: z.number().min(0).max(1),
  }),
]);

export type TaskPayload = z.infer<typeof taskPayload>;
export type NotePayload = z.infer<typeof notePayload>;
export type EmailPayload = z.infer<typeof emailPayload>;
export type ShoppingPayload = z.infer<typeof shoppingPayload>;
export type MealPayload = z.infer<typeof mealPayload>;
export type IntentResult = z.infer<typeof intentResult>;
export type Intent = IntentResult['intent'];
```

`packages/types/src/say-things/index.ts`:

```typescript
export * from './payloads';
```

Modify `packages/types/src/index.ts` to add:

```typescript
export * from './say-things';
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm -w packages/types run test:unit -- payloads.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/say-things packages/types/src/index.ts packages/types/__tests__/say-things
git commit -m "feat(types): add Say Things payload schemas + intentResult discriminated union"
```

---

## Phase 2 — `@things/say-sdk`

### Task 2.1: Scaffold `SaySdk` + `SayPendingApi` with tests

**Files:**

- Modify: `packages/say-sdk/package.json`
- Create: `packages/say-sdk/src/index.ts`
- Create: `packages/say-sdk/src/pending.ts`
- Create: `packages/say-sdk/__tests__/pending.spec.ts`

- [ ] **Step 1: Add deps to `packages/say-sdk/package.json`**

```json
{
  "dependencies": {
    "axios": "^1.7.0",
    "@things/auth": "*",
    "@things/types": "*"
  },
  "devDependencies": {
    "axios-mock-adapter": "^2.0.0"
  }
}
```

Run: `npm install`

- [ ] **Step 2: Write failing test for `SayPendingApi.list()` and `.consume()`**

`packages/say-sdk/__tests__/pending.spec.ts`:

```typescript
import { SaySdk } from '../src';
import MockAdapter from 'axios-mock-adapter';

describe('SayPendingApi', () => {
  const opts = {
    baseUrl: 'http://api-say:3003',
    callerService: 'api-buy',
    serviceTokenSecret: 'test-secret',
  };
  let sdk: SaySdk;
  let mock: MockAdapter;
  beforeEach(() => {
    sdk = new SaySdk(opts);
    mock = new MockAdapter((sdk as any).http);
  });
  afterEach(() => {
    mock.reset();
  });

  it('list() returns parsed pending items, scoped to userId via service-JWT sub', async () => {
    mock.onGet('/pending').reply((config) => {
      expect(config.headers?.authorization).toMatch(/^Bearer /);
      const params = config.params as { destination: string };
      expect(params.destination).toBe('PENDING_BUY');
      return [
        200,
        [
          {
            dictationId: 'd1',
            createdAt: '2026-05-22T10:00:00Z',
            payload: { item: 'oat milk', quantity: 1 },
            transcript: 'pick up oat milk',
          },
        ],
      ];
    });
    const items = await sdk.pending.list({ userId: 'u1', destination: 'PENDING_BUY' });
    expect(items).toHaveLength(1);
    expect(items[0]?.payload).toEqual({ item: 'oat milk', quantity: 1 });
  });

  it('consume() stamps destinationRef', async () => {
    mock.onPost('/pending/d1/consume').reply((config) => {
      const body = JSON.parse(config.data);
      expect(body.destinationRef).toBe('buy-item-42');
      return [200, { ok: true }];
    });
    const res = await sdk.pending.consume('d1', { userId: 'u1', destinationRef: 'buy-item-42' });
    expect(res.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Run, confirm fail**

Run: `npm -w packages/say-sdk run test:unit`
Expected: FAIL — module does not exist.

- [ ] **Step 4: Implement `SaySdk` + `SayPendingApi`**

`packages/say-sdk/src/index.ts`:

```typescript
import axios, { AxiosInstance } from 'axios';
import { SayPendingApi } from './pending';

export interface SaySdkOpts {
  baseUrl: string;
  callerService: string;
  serviceTokenSecret: string;
}

export class SaySdk {
  private readonly http: AxiosInstance;
  readonly pending: SayPendingApi;

  constructor(private readonly opts: SaySdkOpts) {
    this.http = axios.create({ baseURL: opts.baseUrl, timeout: 10_000 });
    this.pending = new SayPendingApi(this.http, opts);
  }
}

export type { PendingItem } from './pending';
```

`packages/say-sdk/src/pending.ts`:

```typescript
import { AxiosInstance } from 'axios';
import { signServiceToken } from '@things/auth';
import type { ShoppingPayload, MealPayload } from '@things/types';
import type { SaySdkOpts } from './index';

export interface PendingItem {
  dictationId: string;
  createdAt: string;
  payload: ShoppingPayload | MealPayload;
  transcript: string;
}

export class SayPendingApi {
  constructor(
    private readonly http: AxiosInstance,
    private readonly opts: SaySdkOpts,
  ) {}

  async list(args: {
    userId: string;
    destination: 'PENDING_BUY' | 'PENDING_EAT';
  }): Promise<PendingItem[]> {
    const token = await signServiceToken({
      iss: this.opts.callerService,
      aud: 'api-say',
      sub: args.userId,
      secret: this.opts.serviceTokenSecret,
    });
    const { data } = await this.http.get<PendingItem[]>('/pending', {
      params: { destination: args.destination },
      headers: { authorization: `Bearer ${token}` },
    });
    return data;
  }

  async consume(
    dictationId: string,
    args: { userId: string; destinationRef: string },
  ): Promise<{ ok: true }> {
    const token = await signServiceToken({
      iss: this.opts.callerService,
      aud: 'api-say',
      sub: args.userId,
      secret: this.opts.serviceTokenSecret,
    });
    const { data } = await this.http.post<{ ok: true }>(
      `/pending/${dictationId}/consume`,
      { destinationRef: args.destinationRef },
      { headers: { authorization: `Bearer ${token}` } },
    );
    return data;
  }
}
```

- [ ] **Step 5: Run, confirm pass**

Run: `npm -w packages/say-sdk run test:unit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/say-sdk
git commit -m "feat(say-sdk): SaySdk + SayPendingApi (list, consume) with service-JWT auth"
```

---

## Phase 3 — api-say Prisma schema + env

### Task 3.1: Prisma schema, env files, package deps

**Files:**

- Create: `apps/api-say/prisma/schema.prisma`
- Create: `apps/api-say/.env.example`
- Create: `apps/api-say/.env`
- Modify: `apps/api-say/package.json`
- Create: `apps/api-say/prisma/migrations/<ts>_init/migration.sql` (generated)

- [ ] **Step 1: Add Prisma + Better Auth + multer + scheduling deps to `apps/api-say/package.json`**

```json
{
  "dependencies": {
    "@prisma/client": "^5.20.0",
    "better-auth": "^1.0.0",
    "multer": "^1.4.5-lts.1",
    "@nestjs/schedule": "^4.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "luxon": "^3.5.0",
    "zod": "^3.23.8",
    "@things/ai": "*",
    "@things/auth": "*",
    "@things/do-sdk": "*",
    "@things/types": "*",
    "@things/config": "*"
  },
  "devDependencies": {
    "prisma": "^5.20.0",
    "@types/multer": "^1.4.12",
    "@types/luxon": "^3.4.2",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2"
  },
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy"
  }
}
```

Run: `npm install`

- [ ] **Step 2: Create `apps/api-say/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ---- Things Say domain ----

enum Intent {
  DO
  NOTE
  SEND
  BUY
  EAT
}

enum DictationState {
  proposed
  confirmed
  dispatched
  cancelled
}

enum Destination {
  DO_THINGS
  SAY_LIBRARY
  CLIPBOARD
  PENDING_BUY
  PENDING_EAT
}

enum CaptureMode {
  tap
  drive
}

model Dictation {
  id                String         @id @default(cuid())
  userId            String

  audioPath         String?
  previewTranscript String?
  finalTranscript   String
  language          String
  captureMode       CaptureMode    @default(tap)

  intent            Intent
  confidence        Float
  proposedPayload   Json
  editedPayload     Json?

  state             DictationState @default(proposed)
  destination       Destination
  destinationRef    String?
  dispatchedAt      DateTime?
  cancelledAt       DateTime?

  usage             Json

  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  user              User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([userId, intent, state])
  @@index([destination, state])
}

model IdempotencyKey {
  key             String   @id
  userId          String
  endpoint        String
  requestBodyHash String
  statusCode      Int
  responseBody    Json
  expiresAt       DateTime
  createdAt       DateTime @default(now())

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([expiresAt])
  @@index([userId, endpoint, createdAt])
}

// ---- Mirrored from things_auth.db for session validation ----

model User {
  id            String           @id @default(cuid())
  email         String           @unique
  emailVerified Boolean          @default(false)
  name          String?
  image         String?
  timezone      String           @default("UTC")
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  sessions      Session[]
  accounts      Account[]
  dictations    Dictation[]
  idempotency   IdempotencyKey[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Account {
  id           String   @id @default(cuid())
  userId       String
  providerId   String
  accountId    String
  password     String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([providerId, accountId])
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
}
```

- [ ] **Step 3: Create env files**

`apps/api-say/.env.example`:

```env
DATABASE_URL="file:../api-auth/prisma/things_auth.db"
PORT=3003
BETTER_AUTH_SECRET="dev-secret-change-me"
BETTER_AUTH_URL="http://localhost:3001"
SERVICE_TOKEN_SECRET="dev-service-secret"
DO_API_URL="http://localhost:3002"
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
TMP_AUDIO_DIR="./tmp"
```

`apps/api-say/.env` (gitignored — fill with real dev values):

```env
DATABASE_URL="file:../api-auth/prisma/things_auth.db"
PORT=3003
BETTER_AUTH_SECRET="dev-secret-change-me-locally"
BETTER_AUTH_URL="http://localhost:3001"
SERVICE_TOKEN_SECRET="dev-service-secret"
DO_API_URL="http://localhost:3002"
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
TMP_AUDIO_DIR="./tmp"
```

- [ ] **Step 4: Generate Prisma client and run initial migration**

Run: `npm -w apps/api-say exec prisma generate`
Run: `npm -w apps/api-say exec prisma migrate dev --name init`
Expected: Migration created; types generated; no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api-say/package.json apps/api-say/.env.example apps/api-say/prisma
git commit -m "feat(api-say): Prisma schema (Dictation + IdempotencyKey + mirrored auth) + env"
```

---

## Phase 4 — api-say auth + Prisma + env validation

### Task 4.1: Zod env schema with validation

**Files:**

- Create: `apps/api-say/src/config/env.ts`
- Create: `apps/api-say/src/config/__tests__/env.spec.ts`

- [ ] **Step 1: Write failing tests**

`apps/api-say/src/config/__tests__/env.spec.ts`:

```typescript
import { loadEnv } from '../env';

describe('env', () => {
  it('parses a valid env', () => {
    const env = loadEnv({
      DATABASE_URL: 'file:./test.db',
      PORT: '3003',
      BETTER_AUTH_SECRET: 's',
      BETTER_AUTH_URL: 'http://localhost:3001',
      SERVICE_TOKEN_SECRET: 'st',
      DO_API_URL: 'http://localhost:3002',
      OPENAI_API_KEY: 'sk-x',
      ANTHROPIC_API_KEY: 'sk-ant-x',
      TMP_AUDIO_DIR: './tmp',
    });
    expect(env.PORT).toBe(3003);
    expect(env.TMP_AUDIO_DIR).toBe('./tmp');
  });

  it('throws on missing required env', () => {
    expect(() => loadEnv({ DATABASE_URL: 'file:./test.db' } as any)).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('throws on invalid PORT', () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: 'file:./test.db',
        PORT: 'abc',
        BETTER_AUTH_SECRET: 's',
        BETTER_AUTH_URL: 'http://localhost:3001',
        SERVICE_TOKEN_SECRET: 'st',
        DO_API_URL: 'http://localhost:3002',
        OPENAI_API_KEY: 'sk-x',
        ANTHROPIC_API_KEY: 'sk-ant-x',
        TMP_AUDIO_DIR: './tmp',
      } as any),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npm -w apps/api-say run test:unit -- env.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/api-say/src/config/env.ts`:

```typescript
import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string(),
  PORT: z.coerce.number().int().positive().default(3003),
  BETTER_AUTH_SECRET: z.string().min(8),
  BETTER_AUTH_URL: z.string().url(),
  SERVICE_TOKEN_SECRET: z.string().min(8),
  DO_API_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  TMP_AUDIO_DIR: z.string().default('./tmp'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }
  return parsed.data;
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm -w apps/api-say run test:unit -- env.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api-say/src/config
git commit -m "feat(api-say): Zod env schema with strict validation on boot"
```

### Task 4.2: PrismaService + module

**Files:**

- Create: `apps/api-say/src/prisma/prisma.service.ts`
- Create: `apps/api-say/src/prisma/prisma.module.ts`

- [ ] **Step 1: Implement PrismaService**

`apps/api-say/src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

`apps/api-say/src/prisma/prisma.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api-say/src/prisma
git commit -m "feat(api-say): PrismaService global module"
```

### Task 4.3: Better Auth instance + SessionGuard (mirror from api-do)

**Files:**

- Create: `apps/api-say/src/auth/auth.ts`
- Create: `apps/api-say/src/auth/session.guard.ts`
- Create: `apps/api-say/src/auth/__tests__/session.guard.spec.ts`
- Create: `apps/api-say/src/auth/auth.module.ts`

- [ ] **Step 1: Write failing SessionGuard test**

`apps/api-say/src/auth/__tests__/session.guard.spec.ts`:

```typescript
import { SessionGuard } from '../session.guard';
import { auth } from '../auth';

describe('SessionGuard', () => {
  const guard = new SessionGuard();

  function mockCtx(headers: Record<string, string>) {
    const req = { headers } as any;
    return { switchToHttp: () => ({ getRequest: () => req }) } as any;
  }

  it('rejects request with no cookie', async () => {
    await expect(guard.canActivate(mockCtx({}))).rejects.toThrow(/unauthorized/i);
  });

  it('attaches session on valid cookie', async () => {
    const spy = jest.spyOn(auth.api, 'getSession').mockResolvedValue({
      user: { id: 'u1', email: 'x', timezone: 'UTC' },
      session: { id: 's1', userId: 'u1', expiresAt: new Date() },
    } as any);
    const req: any = { headers: { cookie: 'better-auth.session=...' } };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as any;
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.session.user.id).toBe('u1');
    expect(req.session.user.timezone).toBe('UTC');
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npm -w apps/api-say run test:unit -- session.guard.spec.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement Better Auth instance**

`apps/api-say/src/auth/auth.ts`:

```typescript
import { betterAuth } from 'better-auth';
import { PrismaClient } from '@prisma/client';
import { prismaAdapter } from 'better-auth/adapters/prisma';

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  basePath: '/auth',
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      timezone: { type: 'string', defaultValue: 'UTC', required: false },
    },
  },
});
```

- [ ] **Step 4: Implement SessionGuard**

`apps/api-say/src/auth/session.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { auth } from './auth';
import { fromNodeHeaders } from 'better-auth/node';

export interface SessionData {
  user: { id: string; email: string; timezone: string };
  session: { id: string; userId: string; expiresAt: Date };
}

declare module 'express-serve-static-core' {
  interface Request {
    session?: SessionData;
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new UnauthorizedException();
    req.session = session as SessionData;
    return true;
  }
}
```

- [ ] **Step 5: Auth module**

`apps/api-say/src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { SessionGuard } from './session.guard';

@Module({ providers: [SessionGuard], exports: [SessionGuard] })
export class AuthModule {}
```

- [ ] **Step 6: Run tests, confirm pass**

Run: `npm -w apps/api-say run test:unit -- session.guard.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api-say/src/auth
git commit -m "feat(api-say): Better Auth instance + SessionGuard (with timezone field)"
```

---

## Phase 5 — Idempotency

### Task 5.1: `IdempotencyInterceptor` — replay + conflict + concurrent-race

**Files:**

- Create: `apps/api-say/src/idempotency/idempotency.interceptor.ts`
- Create: `apps/api-say/src/idempotency/idempotency.module.ts`
- Create: `apps/api-say/src/idempotency/__tests__/idempotency.interceptor.spec.ts`

- [ ] **Step 1: Write failing tests covering replay, conflict, and race**

`apps/api-say/src/idempotency/__tests__/idempotency.interceptor.spec.ts`:

```typescript
import { IdempotencyInterceptor } from '../idempotency.interceptor';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';

describe('IdempotencyInterceptor', () => {
  let prisma: PrismaService;
  let interceptor: IdempotencyInterceptor;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    interceptor = new IdempotencyInterceptor(prisma);
  });
  beforeEach(async () => {
    await prisma.idempotencyKey.deleteMany();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const userId = 'u1';
  function makeCtx(headers: Record<string, string>, body: unknown, statusSink = { value: 200 }) {
    const req: any = {
      headers,
      body,
      method: 'POST',
      route: { path: '/dictations' },
      session: { user: { id: userId } },
    };
    const res: any = {
      statusCode: 200,
      status(c: number) {
        statusSink.value = c;
        this.statusCode = c;
        return this;
      },
    };
    return { switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) } as any;
  }

  it('throws BadRequest when Idempotency-Key missing', async () => {
    const ctx = makeCtx({}, { a: 1 });
    await expect(
      lastValueFrom(await interceptor.intercept(ctx, { handle: () => of({}) } as any)),
    ).rejects.toThrow(BadRequestException);
  });

  it('executes handler on first request, caches the response', async () => {
    const ctx = makeCtx({ 'idempotency-key': 'k1' }, { a: 1 });
    const out = await lastValueFrom(
      await interceptor.intercept(ctx, { handle: () => of({ ok: true, v: 7 }) } as any),
    );
    expect(out).toEqual({ ok: true, v: 7 });
    const row = await prisma.idempotencyKey.findUnique({ where: { key: 'k1' } });
    expect(row).not.toBeNull();
    expect(row?.responseBody).toEqual({ ok: true, v: 7 });
  });

  it('replays cached response on same key + same body', async () => {
    const ctx1 = makeCtx({ 'idempotency-key': 'k2' }, { a: 1 });
    await lastValueFrom(
      await interceptor.intercept(ctx1, { handle: () => of({ id: 'd1' }) } as any),
    );

    const ctx2 = makeCtx({ 'idempotency-key': 'k2' }, { a: 1 });
    const handler = { handle: jest.fn(() => of({ id: 'NEVER' })) };
    const out = await lastValueFrom(await interceptor.intercept(ctx2, handler as any));
    expect(out).toEqual({ id: 'd1' });
    expect(handler.handle).not.toHaveBeenCalled();
  });

  it('returns 409 on same key + different body', async () => {
    const ctx1 = makeCtx({ 'idempotency-key': 'k3' }, { a: 1 });
    await lastValueFrom(
      await interceptor.intercept(ctx1, { handle: () => of({ id: 'd1' }) } as any),
    );

    const ctx2 = makeCtx({ 'idempotency-key': 'k3' }, { a: 2 });
    await expect(
      lastValueFrom(await interceptor.intercept(ctx2, { handle: () => of({}) } as any)),
    ).rejects.toThrow(ConflictException);
  });

  it('returns 409 on same key + different user', async () => {
    const ctx1 = makeCtx({ 'idempotency-key': 'k4' }, { a: 1 });
    await lastValueFrom(
      await interceptor.intercept(ctx1, { handle: () => of({ id: 'd1' }) } as any),
    );

    const ctx2 = makeCtx({ 'idempotency-key': 'k4' }, { a: 1 });
    (ctx2.switchToHttp().getRequest() as any).session.user.id = 'other-user';
    await expect(
      lastValueFrom(await interceptor.intercept(ctx2, { handle: () => of({}) } as any)),
    ).rejects.toThrow(ConflictException);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npm -w apps/api-say run test:integration -- idempotency.interceptor.spec.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement interceptor**

`apps/api-say/src/idempotency/idempotency.interceptor.ts`:

```typescript
import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, of, tap } from 'rxjs';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = ctx.switchToHttp().getRequest();
    const key = req.headers['idempotency-key'];
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Idempotency-Key header required');
    }
    const userId = req.session?.user?.id;
    if (!userId)
      throw new BadRequestException('SessionGuard must run before IdempotencyInterceptor');

    const endpoint = `${req.method} ${req.route?.path ?? req.originalUrl ?? ''}`;
    const bodyHash = sha256(stableStringify(req.body ?? {}));

    const existing = await this.prisma.idempotencyKey.findUnique({ where: { key } });
    if (existing) {
      if (existing.userId !== userId || existing.endpoint !== endpoint) {
        throw new ConflictException('Idempotency-Key reused with different request');
      }
      if (existing.requestBodyHash !== bodyHash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'Idempotency-Key reused with different request body',
        });
      }
      ctx.switchToHttp().getResponse().status(existing.statusCode);
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      tap(async (response: unknown) => {
        try {
          await this.prisma.idempotencyKey.create({
            data: {
              key,
              userId,
              endpoint,
              requestBodyHash: bodyHash,
              statusCode: ctx.switchToHttp().getResponse().statusCode,
              responseBody: response as object,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          });
        } catch (e) {
          // Concurrent race: another request with same key already won. Fall through —
          // the next call with this key will replay the winning response.
        }
      }),
    );
  }
}
```

- [ ] **Step 4: Module file**

`apps/api-say/src/idempotency/idempotency.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { IdempotencyInterceptor } from './idempotency.interceptor';

@Module({ providers: [IdempotencyInterceptor], exports: [IdempotencyInterceptor] })
export class IdempotencyModule {}
```

- [ ] **Step 5: Run, confirm pass**

Run: `npm -w apps/api-say run test:integration -- idempotency.interceptor.spec.ts`
Expected: PASS (all 5 cases).

- [ ] **Step 6: Commit**

```bash
git add apps/api-say/src/idempotency
git commit -m "feat(api-say): Stripe-style IdempotencyInterceptor with replay + conflict + race handling"
```

### Task 5.2: Cleanup cron

**Files:**

- Create: `apps/api-say/src/idempotency/cleanup.cron.ts`
- Create: `apps/api-say/src/idempotency/__tests__/cleanup.cron.spec.ts`

- [ ] **Step 1: Failing test**

`apps/api-say/src/idempotency/__tests__/cleanup.cron.spec.ts`:

```typescript
import { IdempotencyCleanupCron } from '../cleanup.cron';
import { PrismaService } from '../../prisma/prisma.service';

describe('IdempotencyCleanupCron', () => {
  let prisma: PrismaService;
  let cron: IdempotencyCleanupCron;
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    cron = new IdempotencyCleanupCron(prisma);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await prisma.idempotencyKey.deleteMany();
  });

  it('deletes expired keys only', async () => {
    const user = await prisma.user.create({
      data: { id: 'u-cron', email: 'cron@x', emailVerified: true, timezone: 'UTC' },
    });
    await prisma.idempotencyKey.createMany({
      data: [
        {
          key: 'old',
          userId: user.id,
          endpoint: 'X',
          requestBodyHash: 'h',
          statusCode: 200,
          responseBody: {},
          expiresAt: new Date(Date.now() - 1000),
        },
        {
          key: 'new',
          userId: user.id,
          endpoint: 'X',
          requestBodyHash: 'h',
          statusCode: 200,
          responseBody: {},
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    });
    const deleted = await cron.run();
    expect(deleted).toBe(1);
    expect(await prisma.idempotencyKey.findUnique({ where: { key: 'old' } })).toBeNull();
    expect(await prisma.idempotencyKey.findUnique({ where: { key: 'new' } })).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npm -w apps/api-say run test:integration -- cleanup.cron.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/api-say/src/idempotency/cleanup.cron.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IdempotencyCleanupCron {
  private readonly log = new Logger(IdempotencyCleanupCron.name);
  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduled(): Promise<void> {
    const n = await this.run();
    this.log.log(`Cleaned ${n} expired idempotency keys`);
  }

  async run(): Promise<number> {
    const r = await this.prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return r.count;
  }
}
```

Update `apps/api-say/src/idempotency/idempotency.module.ts` to include the cron:

```typescript
import { Module } from '@nestjs/common';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyCleanupCron } from './cleanup.cron';

@Module({
  providers: [IdempotencyInterceptor, IdempotencyCleanupCron],
  exports: [IdempotencyInterceptor],
})
export class IdempotencyModule {}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm -w apps/api-say run test:integration -- cleanup.cron.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api-say/src/idempotency
git commit -m "feat(api-say): nightly cron deleting expired idempotency keys"
```

---

## Phase 6 — AI prompts

### Task 6.1: Intent-classify prompt + examples + reshape prompts

**Files:**

- Create: `apps/api-say/src/ai/prompts/intent-classify-prompt.ts`
- Create: `apps/api-say/src/ai/prompts/intent-classify-examples.ts`
- Create: `apps/api-say/src/ai/prompts/reshape-prompts.ts`
- Create: `apps/api-say/src/ai/__tests__/prompts.spec.ts`

- [ ] **Step 1: Implement the static system prompts and examples**

`apps/api-say/src/ai/prompts/intent-classify-examples.ts`:

```typescript
export interface ClassifyExample {
  transcript: string;
  intent: 'DO' | 'NOTE' | 'SEND' | 'BUY' | 'EAT';
  payload: Record<string, unknown>;
  confidence: number;
}

export const INTENT_CLASSIFY_EXAMPLES: ClassifyExample[] = [
  {
    transcript: 'remind me to email Jamie about Q3 by Thursday',
    intent: 'DO',
    confidence: 0.94,
    payload: { title: 'Email Jamie about Q3', dueAt: '__RELATIVE_THURSDAY__' },
  },
  {
    transcript: 'make a note that the door code is 4471',
    intent: 'NOTE',
    confidence: 0.95,
    payload: { body: 'door code is 4471' },
  },
  {
    transcript: 'draft an email to Sarah saying I will be late',
    intent: 'SEND',
    confidence: 0.92,
    payload: {
      subject: 'Running late',
      body: 'Hi Sarah, I will be late. Apologies for the inconvenience.',
      recipientHint: 'Sarah',
    },
  },
  {
    transcript: 'pick up oat milk and lightbulbs',
    intent: 'BUY',
    confidence: 0.88,
    payload: { item: 'oat milk and lightbulbs', quantity: null },
  },
  {
    transcript: 'want to try making sourdough this weekend',
    intent: 'EAT',
    confidence: 0.86,
    payload: { name: 'sourdough', kind: 'recipe' },
  },
  {
    transcript: 'want to check out that ramen place on Cuba Street',
    intent: 'EAT',
    confidence: 0.87,
    payload: { name: 'ramen place on Cuba Street', kind: 'restaurant' },
  },
  {
    transcript: 'umm',
    intent: 'NOTE',
    confidence: 0.1,
    payload: { body: 'umm' },
  },
  {
    transcript: 'add to shopping list: bin liners three pack',
    intent: 'BUY',
    confidence: 0.93,
    payload: { item: 'bin liners three pack', quantity: 3 },
  },
];
```

`apps/api-say/src/ai/prompts/intent-classify-prompt.ts`:

```typescript
import { INTENT_CLASSIFY_EXAMPLES } from './intent-classify-examples';

const EXAMPLES_BLOCK = INTENT_CLASSIFY_EXAMPLES.map(
  (ex, i) =>
    `Example ${i + 1}:\n  transcript: ${JSON.stringify(ex.transcript)}\n  output: ${JSON.stringify({ intent: ex.intent, payload: ex.payload, confidence: ex.confidence })}`,
).join('\n\n');

export const INTENT_CLASSIFY_PROMPT = `You are the intent classifier for Say Things, a voice-dictation app.

Classify the user's transcript into ONE of five intents and produce a structured payload:

  DO   — "remind me / add a task / I need to / don't forget to" → things-to-do
  NOTE — "make a note that / for the record / random thought / remember that" → information to remember
  SEND — "email / message / reply to / draft a message to" → outbound communication
  BUY  — "I need to buy / pick up / add to shopping" → purchase intent
  EAT  — "I want to eat / try / cook / make / go to <restaurant>" → food intent

Date parsing rules:
  - Resolve all relative dates ("tomorrow", "next Tue", "Friday at 3", "in 2 hours")
    against the user's local time and timezone provided in the message.
  - Output dueAt as ISO 8601 with UTC offset matching user timezone.
  - If no date mentioned, dueAt is null.

Confidence rules:
  - 0.9+   clear intent words, unambiguous payload extraction
  - 0.6-0.9  inferred intent, plausible payload
  - <0.6   unclear; prefer NOTE as safe fallback
  - If transcript is gibberish / silent / a single non-word: confidence < 0.3, intent=NOTE,
    payload.body=transcript verbatim

Drive-mode hint:
  - If the message indicates "captureMode: drive", the user cannot easily edit. Prefer NOTE
    or signal uncertainty (confidence < 0.6) when payload extraction is iffy.

Always emit valid output matching the schema. Never refuse.

${EXAMPLES_BLOCK}
`;
```

`apps/api-say/src/ai/prompts/reshape-prompts.ts`:

```typescript
import type { Intent } from '@things/types';

export const RESHAPE_PROMPT_BY_INTENT: Record<Intent, string> = {
  DO: `Reshape this transcript into a task payload {title, dueAt, notes}.
Resolve relative dates against the user's timezone and local time provided in the message.
Title should be concise and action-oriented. Notes are optional supplemental info.`,
  NOTE: `Reshape this transcript into a note payload {title?, body}.
Title is optional — a short summary. Body is the full content.`,
  SEND: `Reshape this transcript into an email draft {subject, body, recipientHint}.
Subject is concise. Body is professional but matches the tone of the dictation. recipientHint is
the user's stated addressee if any (name, role, "the team"), or null.`,
  BUY: `Reshape this transcript into a shopping item {item, quantity?, notes?}.
Item is the thing to buy. quantity is a positive integer if stated, else null.`,
  EAT: `Reshape this transcript into a food intent {name, kind, notes?}.
name is what the user wants to eat/cook/visit. kind is "recipe" (cooking), "restaurant" (eating out),
or "either" if unclear.`,
};
```

- [ ] **Step 2: Add snapshot tests confirming prompt content is stable**

`apps/api-say/src/ai/__tests__/prompts.spec.ts`:

```typescript
import { INTENT_CLASSIFY_PROMPT } from '../prompts/intent-classify-prompt';
import { RESHAPE_PROMPT_BY_INTENT } from '../prompts/reshape-prompts';

describe('AI prompts', () => {
  it('intent-classify prompt is stable (cacheability)', () => {
    expect(INTENT_CLASSIFY_PROMPT).toMatchSnapshot();
  });
  it('reshape prompts cover all 5 intents', () => {
    for (const intent of ['DO', 'NOTE', 'SEND', 'BUY', 'EAT'] as const) {
      expect(RESHAPE_PROMPT_BY_INTENT[intent]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 3: Run tests; first run writes snapshot**

Run: `npm -w apps/api-say run test:unit -- prompts.spec.ts`
Expected: PASS (snapshot written on first run).

- [ ] **Step 4: Commit**

```bash
git add apps/api-say/src/ai
git commit -m "feat(api-say): static intent-classify prompt + reshape prompts + few-shot examples"
```

---

## Phase 7 — Dispatch handlers

### Task 7.1: `intentToDestination` map + per-handler skeleton

**Files:**

- Create: `apps/api-say/src/dispatch/intent-destination.ts`

- [ ] **Step 1: Implement map**

`apps/api-say/src/dispatch/intent-destination.ts`:

```typescript
import type { Intent } from '@things/types';
import type { Destination } from '@prisma/client';

export const intentToDestination: Record<Intent, Destination> = {
  DO: 'DO_THINGS',
  NOTE: 'SAY_LIBRARY',
  SEND: 'CLIPBOARD',
  BUY: 'PENDING_BUY',
  EAT: 'PENDING_EAT',
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/api-say/src/dispatch/intent-destination.ts
git commit -m "feat(api-say): intent → destination static map"
```

### Task 7.2: `DoHandler` (uses `@things/do-sdk`)

**Files:**

- Create: `apps/api-say/src/dispatch/handlers/do.handler.ts`
- Create: `apps/api-say/src/dispatch/handlers/__tests__/do.handler.spec.ts`

- [ ] **Step 1: Failing test**

`apps/api-say/src/dispatch/handlers/__tests__/do.handler.spec.ts`:

```typescript
import { DoHandler } from '../do.handler';

describe('DoHandler', () => {
  it('calls do-sdk tasks.create() and returns destinationRef', async () => {
    const sdk = { tasks: { create: jest.fn().mockResolvedValue({ id: 't1' }), delete: jest.fn() } };
    const handler = new DoHandler(sdk as any);
    const out = await handler.dispatch({
      dictationId: 'd1',
      userId: 'u1',
      payload: { title: 'Email Jamie', dueAt: null, notes: undefined },
    });
    expect(sdk.tasks.create).toHaveBeenCalledWith({
      userId: 'u1',
      title: 'Email Jamie',
      dueAt: null,
      notes: undefined,
      source: { app: 'say-things', dictationId: 'd1' },
    });
    expect(out).toEqual({ destinationRef: 't1' });
  });

  it('undo() deletes the task', async () => {
    const sdk = { tasks: { create: jest.fn(), delete: jest.fn().mockResolvedValue(undefined) } };
    const handler = new DoHandler(sdk as any);
    await handler.undo({ destinationRef: 't1' });
    expect(sdk.tasks.delete).toHaveBeenCalledWith('t1');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npm -w apps/api-say run test:unit -- do.handler.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/api-say/src/dispatch/handlers/do.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { DoSdk } from '@things/do-sdk';
import type { TaskPayload } from '@things/types';

export interface DoDispatchInput {
  dictationId: string;
  userId: string;
  payload: TaskPayload;
}
export interface DoDispatchOutput {
  destinationRef: string;
}

@Injectable()
export class DoHandler {
  constructor(private readonly sdk: DoSdk) {}

  async dispatch(i: DoDispatchInput): Promise<DoDispatchOutput> {
    const task = await this.sdk.tasks.create({
      userId: i.userId,
      title: i.payload.title,
      dueAt: i.payload.dueAt,
      notes: i.payload.notes,
      source: { app: 'say-things', dictationId: i.dictationId },
    });
    return { destinationRef: task.id };
  }

  async undo(i: { destinationRef: string }): Promise<void> {
    await this.sdk.tasks.delete(i.destinationRef);
  }
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm -w apps/api-say run test:unit -- do.handler.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api-say/src/dispatch/handlers/do.handler.ts apps/api-say/src/dispatch/handlers/__tests__
git commit -m "feat(api-say): DoHandler dispatches/undoes via @things/do-sdk"
```

### Task 7.3: Note / Send / Buy / Eat handlers

**Files:**

- Create: `apps/api-say/src/dispatch/handlers/note.handler.ts`
- Create: `apps/api-say/src/dispatch/handlers/send.handler.ts`
- Create: `apps/api-say/src/dispatch/handlers/buy.handler.ts`
- Create: `apps/api-say/src/dispatch/handlers/eat.handler.ts`
- Create: `apps/api-say/src/dispatch/handlers/__tests__/{note,send,buy,eat}.handler.spec.ts`

- [ ] **Step 1: Tests for each**

`note.handler.spec.ts`:

```typescript
import { NoteHandler } from '../note.handler';
describe('NoteHandler', () => {
  it('returns null destinationRef', async () => {
    expect(
      await new NoteHandler().dispatch({ dictationId: 'd', userId: 'u', payload: { body: 'x' } }),
    ).toEqual({ destinationRef: null });
  });
});
```

`send.handler.spec.ts`:

```typescript
import { SendHandler } from '../send.handler';
describe('SendHandler', () => {
  it('renders email text and returns it', async () => {
    const out = await new SendHandler().dispatch({
      dictationId: 'd',
      userId: 'u',
      payload: { subject: 'Hi', body: 'How are you?', recipientHint: 'Sarah' },
    });
    expect(out.destinationRef).toBeNull();
    expect(out.renderedEmail).toContain('Subject: Hi');
    expect(out.renderedEmail).toContain('How are you?');
    expect(out.renderedEmail).toContain('Sarah');
  });

  it('omits recipient line when null', async () => {
    const out = await new SendHandler().dispatch({
      dictationId: 'd',
      userId: 'u',
      payload: { subject: 'Hi', body: 'Body', recipientHint: null },
    });
    expect(out.renderedEmail).not.toContain('To:');
  });
});
```

`buy.handler.spec.ts` and `eat.handler.spec.ts`:

```typescript
import { BuyHandler } from '../buy.handler';
describe('BuyHandler', () => {
  it('returns null destinationRef (parks in PENDING_BUY)', async () => {
    expect(
      await new BuyHandler().dispatch({
        dictationId: 'd',
        userId: 'u',
        payload: { item: 'milk', quantity: 1 },
      }),
    ).toEqual({ destinationRef: null });
  });
});
```

```typescript
import { EatHandler } from '../eat.handler';
describe('EatHandler', () => {
  it('returns null destinationRef (parks in PENDING_EAT)', async () => {
    expect(
      await new EatHandler().dispatch({
        dictationId: 'd',
        userId: 'u',
        payload: { name: 'pasta', kind: 'recipe' },
      }),
    ).toEqual({ destinationRef: null });
  });
});
```

- [ ] **Step 2: Run all 4, confirm fail**

Run: `npm -w apps/api-say run test:unit -- handlers/__tests__`
Expected: FAIL on all four.

- [ ] **Step 3: Implement**

`note.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { NotePayload } from '@things/types';

@Injectable()
export class NoteHandler {
  async dispatch(_i: { dictationId: string; userId: string; payload: NotePayload }) {
    return { destinationRef: null as string | null };
  }
  async undo(_i: { destinationRef: string | null }) {
    /* no-op */
  }
}
```

`send.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { EmailPayload } from '@things/types';

@Injectable()
export class SendHandler {
  async dispatch(i: { dictationId: string; userId: string; payload: EmailPayload }) {
    const recipientLine = i.payload.recipientHint ? `(To: ${i.payload.recipientHint})\n\n` : '';
    const renderedEmail =
      `Subject: ${i.payload.subject}\n\n${i.payload.body}\n\n${recipientLine}`.trimEnd();
    return { destinationRef: null as string | null, renderedEmail };
  }
  async undo(_i: { destinationRef: string | null }) {
    /* can't un-copy */
  }
}
```

`buy.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { ShoppingPayload } from '@things/types';

@Injectable()
export class BuyHandler {
  async dispatch(_i: { dictationId: string; userId: string; payload: ShoppingPayload }) {
    return { destinationRef: null as string | null };
  }
  async undo(_i: { destinationRef: string | null }) {
    /* no-op */
  }
}
```

`eat.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { MealPayload } from '@things/types';

@Injectable()
export class EatHandler {
  async dispatch(_i: { dictationId: string; userId: string; payload: MealPayload }) {
    return { destinationRef: null as string | null };
  }
  async undo(_i: { destinationRef: string | null }) {
    /* no-op */
  }
}
```

- [ ] **Step 4: Run all, confirm pass**

Run: `npm -w apps/api-say run test:unit -- handlers/__tests__`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api-say/src/dispatch/handlers
git commit -m "feat(api-say): Note/Send/Buy/Eat dispatch handlers"
```

### Task 7.4: `DispatchService` + dispatch module

**Files:**

- Create: `apps/api-say/src/dispatch/dispatch.service.ts`
- Create: `apps/api-say/src/dispatch/dispatch.module.ts`
- Create: `apps/api-say/src/dispatch/__tests__/dispatch.service.spec.ts`

- [ ] **Step 1: Failing test**

`apps/api-say/src/dispatch/__tests__/dispatch.service.spec.ts`:

```typescript
import { DispatchService } from '../dispatch.service';

describe('DispatchService', () => {
  const handlers: any = {
    do: { dispatch: jest.fn().mockResolvedValue({ destinationRef: 't1' }), undo: jest.fn() },
    note: { dispatch: jest.fn().mockResolvedValue({ destinationRef: null }), undo: jest.fn() },
    send: {
      dispatch: jest.fn().mockResolvedValue({ destinationRef: null, renderedEmail: 'X' }),
      undo: jest.fn(),
    },
    buy: { dispatch: jest.fn().mockResolvedValue({ destinationRef: null }), undo: jest.fn() },
    eat: { dispatch: jest.fn().mockResolvedValue({ destinationRef: null }), undo: jest.fn() },
  };
  const svc = new DispatchService(
    handlers.do,
    handlers.note,
    handlers.send,
    handlers.buy,
    handlers.eat,
  );

  it('routes DO to DoHandler', async () => {
    const r = await svc.dispatch({
      intent: 'DO',
      dictationId: 'd',
      userId: 'u',
      payload: { title: 'X', dueAt: null },
    });
    expect(handlers.do.dispatch).toHaveBeenCalled();
    expect(r.destinationRef).toBe('t1');
  });
  it('routes SEND and includes renderedEmail', async () => {
    const r = await svc.dispatch({
      intent: 'SEND',
      dictationId: 'd',
      userId: 'u',
      payload: { subject: 'X', body: 'Y', recipientHint: null },
    });
    expect(handlers.send.dispatch).toHaveBeenCalled();
    expect(r.renderedEmail).toBe('X');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npm -w apps/api-say run test:unit -- dispatch.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement service + module**

`apps/api-say/src/dispatch/dispatch.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type {
  Intent,
  TaskPayload,
  NotePayload,
  EmailPayload,
  ShoppingPayload,
  MealPayload,
} from '@things/types';
import { DoHandler } from './handlers/do.handler';
import { NoteHandler } from './handlers/note.handler';
import { SendHandler } from './handlers/send.handler';
import { BuyHandler } from './handlers/buy.handler';
import { EatHandler } from './handlers/eat.handler';

export interface DispatchInput {
  intent: Intent;
  dictationId: string;
  userId: string;
  payload: TaskPayload | NotePayload | EmailPayload | ShoppingPayload | MealPayload;
}

export interface DispatchOutput {
  destinationRef: string | null;
  renderedEmail?: string;
}

@Injectable()
export class DispatchService {
  constructor(
    private readonly doH: DoHandler,
    private readonly noteH: NoteHandler,
    private readonly sendH: SendHandler,
    private readonly buyH: BuyHandler,
    private readonly eatH: EatHandler,
  ) {}

  async dispatch(i: DispatchInput): Promise<DispatchOutput> {
    switch (i.intent) {
      case 'DO':
        return this.doH.dispatch({
          dictationId: i.dictationId,
          userId: i.userId,
          payload: i.payload as TaskPayload,
        });
      case 'NOTE':
        return this.noteH.dispatch({
          dictationId: i.dictationId,
          userId: i.userId,
          payload: i.payload as NotePayload,
        });
      case 'SEND':
        return this.sendH.dispatch({
          dictationId: i.dictationId,
          userId: i.userId,
          payload: i.payload as EmailPayload,
        });
      case 'BUY':
        return this.buyH.dispatch({
          dictationId: i.dictationId,
          userId: i.userId,
          payload: i.payload as ShoppingPayload,
        });
      case 'EAT':
        return this.eatH.dispatch({
          dictationId: i.dictationId,
          userId: i.userId,
          payload: i.payload as MealPayload,
        });
    }
  }

  async undo(i: { intent: Intent; destinationRef: string | null }): Promise<void> {
    if (!i.destinationRef) return;
    switch (i.intent) {
      case 'DO':
        return this.doH.undo({ destinationRef: i.destinationRef });
      case 'NOTE':
        return this.noteH.undo({ destinationRef: i.destinationRef });
      case 'SEND':
        return this.sendH.undo({ destinationRef: i.destinationRef });
      case 'BUY':
        return this.buyH.undo({ destinationRef: i.destinationRef });
      case 'EAT':
        return this.eatH.undo({ destinationRef: i.destinationRef });
    }
  }
}
```

`apps/api-say/src/dispatch/dispatch.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DoSdk } from '@things/do-sdk';
import { DispatchService } from './dispatch.service';
import { DoHandler } from './handlers/do.handler';
import { NoteHandler } from './handlers/note.handler';
import { SendHandler } from './handlers/send.handler';
import { BuyHandler } from './handlers/buy.handler';
import { EatHandler } from './handlers/eat.handler';

@Module({
  providers: [
    {
      provide: DoSdk,
      useFactory: () =>
        new DoSdk({
          baseUrl: process.env.DO_API_URL!,
          callerService: 'api-say',
          serviceTokenSecret: process.env.SERVICE_TOKEN_SECRET!,
        }),
    },
    DoHandler,
    NoteHandler,
    SendHandler,
    BuyHandler,
    EatHandler,
    DispatchService,
  ],
  exports: [DispatchService],
})
export class DispatchModule {}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm -w apps/api-say run test:unit -- dispatch.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api-say/src/dispatch/dispatch.service.ts apps/api-say/src/dispatch/dispatch.module.ts apps/api-say/src/dispatch/__tests__
git commit -m "feat(api-say): DispatchService routes by intent; module wires DoSdk + handlers"
```

---

## Phase 8 — Dictations endpoint

### Task 8.1: DTOs

**Files:**

- Create: `apps/api-say/src/dictations/dto/create-dictation.dto.ts`
- Create: `apps/api-say/src/dictations/dto/reclassify.dto.ts`

- [ ] **Step 1: Create DTOs**

`create-dictation.dto.ts`:

```typescript
import { IsOptional, IsString, IsIn } from 'class-validator';

export class CreateDictationDto {
  @IsOptional() @IsString() previewTranscript?: string;
  @IsIn(['tap', 'drive']) captureMode!: 'tap' | 'drive';
}
```

`reclassify.dto.ts`:

```typescript
import { IsIn } from 'class-validator';

export class ReclassifyDto {
  @IsIn(['DO', 'NOTE', 'SEND', 'BUY', 'EAT']) forceIntent!: 'DO' | 'NOTE' | 'SEND' | 'BUY' | 'EAT';
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api-say/src/dictations/dto
git commit -m "feat(api-say): DTOs for CreateDictation and Reclassify"
```

### Task 8.2: `DictationsService.create()` — record-then-classify pipeline

**Files:**

- Create: `apps/api-say/src/dictations/dictations.service.ts`
- Create: `apps/api-say/src/dictations/__tests__/dictations.service.spec.ts`

- [ ] **Step 1: Failing test for `create()` happy path**

`apps/api-say/src/dictations/__tests__/dictations.service.spec.ts`:

```typescript
import { DictationsService } from '../dictations.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('DictationsService.create', () => {
  let prisma: PrismaService;
  let svc: DictationsService;
  const ai = {
    transcribe: jest.fn(),
    chatStructured: jest.fn(),
  };
  const dispatch = { dispatch: jest.fn(), undo: jest.fn() };
  const tmpDir = fs.mkdtemp(path.join(os.tmpdir(), 'say-test-')) as unknown as string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.user.upsert({
      where: { id: 'u-svc' },
      update: {},
      create: { id: 'u-svc', email: 'svc@x', emailVerified: true, timezone: 'Pacific/Auckland' },
    });
  });
  beforeEach(async () => {
    await prisma.dictation.deleteMany({ where: { userId: 'u-svc' } });
    ai.transcribe.mockReset();
    ai.chatStructured.mockReset();
    dispatch.dispatch.mockReset();
    const dir = await tmpDir;
    svc = new DictationsService(prisma, ai as any, dispatch as any, dir); // ctor order: prisma, ai, dispatchSvc, tmpDir
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('transcribes, classifies, persists Dictation with state=proposed, cleans up audio', async () => {
    ai.transcribe.mockResolvedValue({
      text: 'remind me to call mum',
      language: 'en',
      usage: { elapsedMs: 1200, costUsd: 0.002 },
    });
    ai.chatStructured.mockResolvedValue({
      value: { intent: 'DO', payload: { title: 'Call mum', dueAt: null }, confidence: 0.9 },
      usage: { elapsedMs: 900, costUsd: 0.001 },
    });

    const dir = await tmpDir;
    const tmpAudioFile = path.join(dir, 'audio.webm');
    await fs.writeFile(tmpAudioFile, Buffer.from('fake-audio'));

    const out = await svc.create({
      idempotencyKey: 'd-svc-1',
      userId: 'u-svc',
      userTimezone: 'Pacific/Auckland',
      previewTranscript: 'remind me to call mum',
      captureMode: 'tap',
      audioBuffer: Buffer.from('fake-audio'),
    });

    expect(ai.transcribe).toHaveBeenCalled();
    expect(ai.chatStructured).toHaveBeenCalled();
    expect(out.dictation.id).toBe('d-svc-1');
    expect(out.dictation.state).toBe('proposed');
    expect(out.dictation.destination).toBe('DO_THINGS');
    expect(out.dictation.finalTranscript).toBe('remind me to call mum');
    expect(out.proposal.intent).toBe('DO');

    const persisted = await prisma.dictation.findUnique({ where: { id: 'd-svc-1' } });
    expect(persisted?.audioPath).toBeNull();
    expect(persisted?.state).toBe('proposed');
  });

  it('cleans up audio file even on AI failure', async () => {
    ai.transcribe.mockRejectedValue(new Error('whisper down'));
    const dir = await tmpDir;

    await expect(
      svc.create({
        idempotencyKey: 'd-svc-2',
        userId: 'u-svc',
        userTimezone: 'UTC',
        captureMode: 'tap',
        audioBuffer: Buffer.from('x'),
      }),
    ).rejects.toThrow();

    const files = await fs.readdir(dir);
    expect(files.filter((f) => f.startsWith('d-svc-2'))).toHaveLength(0);
  });

  it('falls back to NOTE on intentResult parse failure', async () => {
    ai.transcribe.mockResolvedValue({
      text: 'umm',
      language: 'en',
      usage: { elapsedMs: 1, costUsd: 0 },
    });
    ai.chatStructured.mockRejectedValue(new Error('schema parse failed twice'));

    const out = await svc.create({
      idempotencyKey: 'd-svc-3',
      userId: 'u-svc',
      userTimezone: 'UTC',
      captureMode: 'tap',
      audioBuffer: Buffer.from('x'),
    });

    expect(out.dictation.intent).toBe('NOTE');
    expect(out.dictation.confidence).toBe(0);
    expect((out.dictation.proposedPayload as any).body).toBe('umm');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npm -w apps/api-say run test:integration -- dictations.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement service**

`apps/api-say/src/dictations/dictations.service.ts`:

```typescript
import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { intentToDestination } from '../dispatch/intent-destination';
import { INTENT_CLASSIFY_PROMPT } from '../ai/prompts/intent-classify-prompt';
import { RESHAPE_PROMPT_BY_INTENT } from '../ai/prompts/reshape-prompts';
import {
  intentResult,
  taskPayload,
  notePayload,
  emailPayload,
  shoppingPayload,
  mealPayload,
  type Intent,
} from '@things/types';
import { AiClient } from '@things/ai'; // class export (P4 requirement) — used as DI token + type

export interface CreateInput {
  idempotencyKey: string;
  userId: string;
  userTimezone: string;
  previewTranscript?: string;
  captureMode: 'tap' | 'drive';
  audioBuffer: Buffer;
}

const PAYLOAD_SCHEMA_BY_INTENT = {
  DO: taskPayload,
  NOTE: notePayload,
  SEND: emailPayload,
  BUY: shoppingPayload,
  EAT: mealPayload,
} as const;

@Injectable()
export class DictationsService {
  private readonly log = new Logger(DictationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiClient,
    private readonly dispatchSvc: DispatchService,
    @Inject('TMP_AUDIO_DIR') private readonly tmpDir: string,
  ) {}

  async create(input: CreateInput) {
    const id = input.idempotencyKey;
    const audioPath = path.join(this.tmpDir, `${id}.webm`);
    await fs.mkdir(this.tmpDir, { recursive: true });
    await fs.writeFile(audioPath, input.audioBuffer);

    try {
      const trans = await this.ai.transcribe(input.audioBuffer);
      const nowLocal = DateTime.now().setZone(input.userTimezone).toISO();

      let proposal;
      try {
        const r = await this.ai.chatStructured({
          schema: intentResult,
          systemPrompt: INTENT_CLASSIFY_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Current user timezone: ${input.userTimezone}\nCurrent user local time: ${nowLocal}\ncaptureMode: ${input.captureMode}\n\nTranscript: """${trans.text}"""`,
            },
          ],
          cacheSystem: true,
        });
        proposal = { value: r.value, usage: r.usage };
      } catch (err) {
        this.log.warn(`intentResult failed (${(err as Error).message}); falling back to NOTE`);
        proposal = {
          value: { intent: 'NOTE' as const, payload: { body: trans.text }, confidence: 0 },
          usage: { elapsedMs: 0, costUsd: 0 },
        };
      }

      const dictation = await this.prisma.dictation.create({
        data: {
          id,
          userId: input.userId,
          previewTranscript: input.previewTranscript ?? null,
          finalTranscript: trans.text,
          language: trans.language,
          captureMode: input.captureMode,
          intent: proposal.value.intent,
          confidence: proposal.value.confidence,
          proposedPayload: proposal.value.payload,
          state: 'proposed',
          destination: intentToDestination[proposal.value.intent],
          usage: {
            transcribeMs: trans.usage.elapsedMs,
            classifyMs: proposal.usage.elapsedMs,
            transcribeCostUsd: trans.usage.costUsd,
            classifyCostUsd: proposal.usage.costUsd,
          },
        },
      });

      return { dictation, proposal: proposal.value };
    } finally {
      await fs.unlink(audioPath).catch(() => {});
    }
  }

  async getOwned(id: string, userId: string) {
    const d = await this.prisma.dictation.findUnique({ where: { id } });
    if (!d || d.userId !== userId) throw new NotFoundException();
    return d;
  }

  async dispatch(id: string, userId: string) {
    const d = await this.getOwned(id, userId);
    if (d.state !== 'proposed')
      throw new BadRequestException(`Cannot dispatch in state=${d.state}`);
    const effective = (d.editedPayload ?? d.proposedPayload) as object;
    const out = await this.dispatchSvc.dispatch({
      intent: d.intent as Intent,
      dictationId: d.id,
      userId,
      payload: effective as never,
    });
    const updated = await this.prisma.dictation.update({
      where: { id },
      data: { state: 'dispatched', destinationRef: out.destinationRef, dispatchedAt: new Date() },
    });
    return { dictation: updated, renderedEmail: out.renderedEmail };
  }

  async undoDispatch(id: string, userId: string) {
    const d = await this.getOwned(id, userId);
    if (d.state !== 'dispatched') throw new BadRequestException(`Cannot undo in state=${d.state}`);
    await this.dispatchSvc.undo({ intent: d.intent as Intent, destinationRef: d.destinationRef });
    return this.prisma.dictation.update({
      where: { id },
      data: { state: 'proposed', destinationRef: null, dispatchedAt: null },
    });
  }

  async reclassify(id: string, userId: string, forceIntent: Intent, userTimezone: string) {
    const d = await this.getOwned(id, userId);
    if (d.state !== 'proposed')
      throw new BadRequestException(`Cannot reclassify in state=${d.state}`);

    const nowLocal = DateTime.now().setZone(userTimezone).toISO();
    const schema = PAYLOAD_SCHEMA_BY_INTENT[forceIntent];
    const r = await this.ai.chatStructured({
      schema,
      systemPrompt: RESHAPE_PROMPT_BY_INTENT[forceIntent],
      messages: [
        {
          role: 'user',
          content: `Transcript: """${d.finalTranscript}"""\nUser timezone: ${userTimezone}\nCurrent user local time: ${nowLocal}`,
        },
      ],
      cacheSystem: true,
    });

    const updated = await this.prisma.dictation.update({
      where: { id },
      data: {
        intent: forceIntent,
        proposedPayload: r.value as object,
        destination: intentToDestination[forceIntent],
        editedPayload: null,
      },
    });
    return {
      dictation: updated,
      proposal: { intent: forceIntent, payload: r.value, confidence: 1.0 },
    };
  }

  async patchEdit(id: string, userId: string, editedPayload: object) {
    const d = await this.getOwned(id, userId);
    if (d.state !== 'proposed') throw new BadRequestException(`Cannot edit in state=${d.state}`);
    return this.prisma.dictation.update({ where: { id }, data: { editedPayload } });
  }

  async list(userId: string, opts: { intent?: Intent; limit?: number } = {}) {
    return this.prisma.dictation.findMany({
      where: { userId, ...(opts.intent ? { intent: opts.intent } : {}) },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 50,
    });
  }

  async remove(id: string, userId: string) {
    await this.getOwned(id, userId);
    await this.prisma.dictation.delete({ where: { id } });
  }
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm -w apps/api-say run test:integration -- dictations.service.spec.ts`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api-say/src/dictations/dictations.service.ts apps/api-say/src/dictations/__tests__/dictations.service.spec.ts
git commit -m "feat(api-say): DictationsService — create, dispatch, undo, reclassify, edit, list, remove"
```

### Task 8.3: `DictationsController` + module + integration test

**Files:**

- Create: `apps/api-say/src/dictations/dictations.controller.ts`
- Create: `apps/api-say/src/dictations/dictations.module.ts`
- Create: `apps/api-say/src/dictations/__tests__/dictations.integration.spec.ts`

- [ ] **Step 1: Failing integration test**

`apps/api-say/src/dictations/__tests__/dictations.integration.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AiClient } from '@things/ai';

describe('Dictations (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stubAi: jest.Mocked<AiClient> = {
    transcribe: jest
      .fn()
      .mockResolvedValue({
        text: 'remind me to call mum',
        language: 'en',
        segments: [],
        usage: { elapsedMs: 100, costUsd: 0.001 },
      }),
    chatStructured: jest
      .fn()
      .mockResolvedValue({
        value: { intent: 'DO', payload: { title: 'Call mum', dueAt: null }, confidence: 0.93 },
        usage: { elapsedMs: 100, costUsd: 0.0005 },
      }),
  } as never;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiClient)
      .useValue(stubAi)
      .compile();
    app = mod.createNestApplication();
    await app.init();
    prisma = mod.get(PrismaService);
    await prisma.user.upsert({
      where: { id: 'u-int' },
      update: {},
      create: { id: 'u-int', email: 'int@x', emailVerified: true, timezone: 'Pacific/Auckland' },
    });
  });
  afterAll(async () => {
    await app.close();
  });

  function loginCookie() {
    /* fabricate a Better Auth session cookie OR mock SessionGuard */
    return 'better-auth.session=mocked';
  }

  it('POST /dictations + POST /dispatch returns dictation + proposal then dispatches', async () => {
    const res1 = await request(app.getHttpServer())
      .post('/dictations')
      .set('Idempotency-Key', 'int-1')
      .set('Cookie', loginCookie())
      .field('captureMode', 'tap')
      .field('previewTranscript', 'remind me to call mum')
      .attach('audio', Buffer.from('fake'), 'a.webm')
      .expect(201);
    expect(res1.body.proposal.intent).toBe('DO');

    const res2 = await request(app.getHttpServer())
      .post(`/dictations/${res1.body.dictation.id}/dispatch`)
      .set('Idempotency-Key', 'int-2')
      .set('Cookie', loginCookie())
      .send({})
      .expect(201);
    expect(res2.body.dictation.state).toBe('dispatched');
  });

  it('POST /dictations replays on Idempotency-Key reuse', async () => {
    const res1 = await request(app.getHttpServer())
      .post('/dictations')
      .set('Idempotency-Key', 'int-rep')
      .set('Cookie', loginCookie())
      .field('captureMode', 'tap')
      .attach('audio', Buffer.from('fake'), 'a.webm');
    const res2 = await request(app.getHttpServer())
      .post('/dictations')
      .set('Idempotency-Key', 'int-rep')
      .set('Cookie', loginCookie())
      .field('captureMode', 'tap')
      .attach('audio', Buffer.from('fake'), 'a.webm');
    expect(res2.body.dictation.id).toBe(res1.body.dictation.id);
    expect(stubAi.transcribe).toHaveBeenCalledTimes(1); // not called twice
  });
});
```

Note: for the test to work, `SessionGuard` needs to be overridable too. The test setup should `.overrideGuard(SessionGuard).useValue({ canActivate: (ctx) => { ctx.switchToHttp().getRequest().session = { user: { id: 'u-int', email: 'int@x', timezone: 'Pacific/Auckland' } }; return true; } })`. Include that in the `Test.createTestingModule(...)` chain.

- [ ] **Step 2: Run, confirm fail**

Run: `npm -w apps/api-say run test:integration -- dictations.integration.spec.ts`
Expected: FAIL — controller doesn't exist.

- [ ] **Step 3: Implement controller**

`apps/api-say/src/dictations/dictations.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionGuard } from '../auth/session.guard';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';
import { DictationsService } from './dictations.service';
import { CreateDictationDto } from './dto/create-dictation.dto';
import { ReclassifyDto } from './dto/reclassify.dto';
import type { Intent } from '@things/types';
import type { Request } from 'express';

@Controller('dictations')
@UseGuards(SessionGuard)
export class DictationsController {
  constructor(private readonly svc: DictationsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('audio'), IdempotencyInterceptor)
  async create(
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: CreateDictationDto,
    @UploadedFile() audio: Express.Multer.File,
  ) {
    const session = req.session!;
    return this.svc.create({
      idempotencyKey,
      userId: session.user.id,
      userTimezone: session.user.timezone,
      previewTranscript: body.previewTranscript,
      captureMode: body.captureMode,
      audioBuffer: audio.buffer,
    });
  }

  @Get()
  async list(
    @Req() req: Request,
    @Query('intent') intent?: Intent,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list(req.session!.user.id, {
      intent,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Patch(':id')
  @UseInterceptors(IdempotencyInterceptor)
  async edit(@Req() req: Request, @Param('id') id: string, @Body() editedPayload: object) {
    return this.svc.patchEdit(id, req.session!.user.id, editedPayload);
  }

  @Post(':id/dispatch')
  @UseInterceptors(IdempotencyInterceptor)
  async dispatch(@Req() req: Request, @Param('id') id: string) {
    return this.svc.dispatch(id, req.session!.user.id);
  }

  @Delete(':id/dispatch')
  @UseInterceptors(IdempotencyInterceptor)
  async undoDispatch(@Req() req: Request, @Param('id') id: string) {
    return this.svc.undoDispatch(id, req.session!.user.id);
  }

  @Post(':id/reclassify')
  @UseInterceptors(IdempotencyInterceptor)
  async reclassify(@Req() req: Request, @Param('id') id: string, @Body() body: ReclassifyDto) {
    return this.svc.reclassify(
      id,
      req.session!.user.id,
      body.forceIntent,
      req.session!.user.timezone,
    );
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.svc.remove(id, req.session!.user.id);
    return { ok: true };
  }
}
```

`apps/api-say/src/dictations/dictations.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DictationsController } from './dictations.controller';
import { DictationsService } from './dictations.service';
import { DispatchModule } from '../dispatch/dispatch.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { AuthModule } from '../auth/auth.module';
import { AiClient, createAiClient } from '@things/ai';

@Module({
  imports: [DispatchModule, IdempotencyModule, AuthModule],
  controllers: [DictationsController],
  providers: [
    DictationsService,
    {
      provide: AiClient,
      useFactory: () =>
        createAiClient({
          openaiApiKey: process.env.OPENAI_API_KEY!,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
        }),
    },
    {
      provide: 'TMP_AUDIO_DIR',
      useValue: process.env.TMP_AUDIO_DIR ?? './tmp',
    },
  ],
  exports: [DictationsService],
})
export class DictationsModule {}
```

(The `DictationsService` constructor in Task 8.2 already uses `@Inject('TMP_AUDIO_DIR')` and the `dispatchSvc` property name — no further edits needed here.)

- [ ] **Step 4: Run, confirm pass**

Run: `npm -w apps/api-say run test:integration -- dictations.integration.spec.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api-say/src/dictations
git commit -m "feat(api-say): DictationsController + module + integration tests for create+dispatch+replay"
```

---

## Phase 9 — Pending API (inbound for future Buy/Eat)

### Task 9.1: `ServiceJwtGuard` for inbound calls

**Files:**

- Create: `apps/api-say/src/pending/service-jwt.guard.ts`
- Create: `apps/api-say/src/pending/__tests__/service-jwt.guard.spec.ts`

- [ ] **Step 1: Failing test**

`apps/api-say/src/pending/__tests__/service-jwt.guard.spec.ts`:

```typescript
import { ServiceJwtGuard } from '../service-jwt.guard';
import { signServiceToken } from '@things/auth';

describe('ServiceJwtGuard (api-say)', () => {
  const guard = new ServiceJwtGuard(['api-buy', 'api-eat']);
  const secret = 'test-secret';
  process.env.SERVICE_TOKEN_SECRET = secret;

  function ctx(headers: Record<string, string>) {
    const req: any = { headers };
    return { switchToHttp: () => ({ getRequest: () => req }) } as any;
  }

  it('accepts api-buy', async () => {
    const tok = await signServiceToken({ iss: 'api-buy', aud: 'api-say', sub: 'u1', secret });
    await expect(guard.canActivate(ctx({ authorization: `Bearer ${tok}` }))).resolves.toBe(true);
  });
  it('rejects api-do (not whitelisted)', async () => {
    const tok = await signServiceToken({ iss: 'api-do', aud: 'api-say', sub: 'u1', secret });
    await expect(guard.canActivate(ctx({ authorization: `Bearer ${tok}` }))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npm -w apps/api-say run test:unit -- service-jwt.guard.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement (mirror api-do version from Task 0.4)**

`apps/api-say/src/pending/service-jwt.guard.ts`:

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyServiceToken } from '@things/auth';

@Injectable()
export class ServiceJwtGuard implements CanActivate {
  constructor(private readonly whitelist: string[]) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header = req.headers['authorization'] as string | undefined;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    const token = header.slice('Bearer '.length);

    let payload;
    try {
      payload = await verifyServiceToken(token, {
        expectedAud: 'api-say',
        secret: process.env.SERVICE_TOKEN_SECRET!,
      });
    } catch (e) {
      throw new UnauthorizedException(`Invalid service token: ${(e as Error).message}`);
    }
    if (!this.whitelist.includes(payload.iss)) {
      throw new ForbiddenException(`Caller ${payload.iss} not whitelisted`);
    }
    req.serviceCaller = payload;
    req.userId = payload.sub;
    return true;
  }
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm -w apps/api-say run test:unit -- service-jwt.guard.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api-say/src/pending/service-jwt.guard.ts apps/api-say/src/pending/__tests__
git commit -m "feat(api-say): inbound ServiceJwtGuard whitelisting api-buy/api-eat"
```

### Task 9.2: PendingService + PendingController

**Files:**

- Create: `apps/api-say/src/pending/pending.service.ts`
- Create: `apps/api-say/src/pending/pending.controller.ts`
- Create: `apps/api-say/src/pending/pending.module.ts`
- Create: `apps/api-say/src/pending/__tests__/pending.integration.spec.ts`

- [ ] **Step 1: Failing integration test**

`apps/api-say/src/pending/__tests__/pending.integration.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { signServiceToken } from '@things/auth';

describe('Pending (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const secret = 'test-svc-secret';
  process.env.SERVICE_TOKEN_SECRET = secret;
  const userId = 'u-pend';

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    prisma = mod.get(PrismaService);
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: 'pend@x', emailVerified: true, timezone: 'UTC' },
    });
    await prisma.dictation.createMany({
      data: [
        {
          id: 'p1',
          userId,
          finalTranscript: 'oat milk',
          language: 'en',
          captureMode: 'tap',
          intent: 'BUY',
          confidence: 0.9,
          proposedPayload: { item: 'oat milk', quantity: 1 },
          state: 'dispatched',
          destination: 'PENDING_BUY',
          dispatchedAt: new Date(),
          usage: {},
        },
        {
          id: 'p2',
          userId,
          finalTranscript: 'pasta',
          language: 'en',
          captureMode: 'tap',
          intent: 'EAT',
          confidence: 0.9,
          proposedPayload: { name: 'pasta', kind: 'recipe' },
          state: 'dispatched',
          destination: 'PENDING_EAT',
          dispatchedAt: new Date(),
          usage: {},
        },
      ],
    });
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /pending requires service JWT', async () => {
    await request(app.getHttpServer())
      .get('/pending')
      .query({ destination: 'PENDING_BUY' })
      .expect(401);
  });

  it('GET /pending returns pending items for whitelisted caller, scoped to userId', async () => {
    const tok = await signServiceToken({ iss: 'api-buy', aud: 'api-say', sub: userId, secret });
    const res = await request(app.getHttpServer())
      .get('/pending')
      .query({ destination: 'PENDING_BUY' })
      .set('Authorization', `Bearer ${tok}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].dictationId).toBe('p1');
  });

  it('POST /pending/:id/consume stamps destinationRef', async () => {
    const tok = await signServiceToken({ iss: 'api-buy', aud: 'api-say', sub: userId, secret });
    await request(app.getHttpServer())
      .post('/pending/p1/consume')
      .set('Authorization', `Bearer ${tok}`)
      .send({ destinationRef: 'buy-42' })
      .expect(201);
    const row = await prisma.dictation.findUnique({ where: { id: 'p1' } });
    expect(row?.destinationRef).toBe('buy-42');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `npm -w apps/api-say run test:integration -- pending.integration.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement service**

`apps/api-say/src/pending/pending.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PendingService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, destination: 'PENDING_BUY' | 'PENDING_EAT') {
    const rows = await this.prisma.dictation.findMany({
      where: { userId, destination, state: 'dispatched', destinationRef: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      dictationId: r.id,
      createdAt: r.createdAt.toISOString(),
      payload: r.editedPayload ?? r.proposedPayload,
      transcript: r.finalTranscript,
    }));
  }

  async consume(dictationId: string, userId: string, destinationRef: string) {
    const row = await this.prisma.dictation.findUnique({ where: { id: dictationId } });
    if (!row || row.userId !== userId) throw new NotFoundException();
    if (row.destinationRef) return { ok: true as const }; // already consumed (idempotent)
    await this.prisma.dictation.update({ where: { id: dictationId }, data: { destinationRef } });
    return { ok: true as const };
  }
}
```

`apps/api-say/src/pending/pending.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ServiceJwtGuard } from './service-jwt.guard';
import { PendingService } from './pending.service';

@Controller('pending')
@UseGuards(new ServiceJwtGuard(['api-buy', 'api-eat']))
export class PendingController {
  constructor(private readonly svc: PendingService) {}

  @Get()
  list(
    @Req() req: Request & { userId: string },
    @Query('destination') destination: 'PENDING_BUY' | 'PENDING_EAT',
  ) {
    return this.svc.list(req.userId, destination);
  }

  @Post(':id/consume')
  consume(
    @Req() req: Request & { userId: string },
    @Param('id') id: string,
    @Body() body: { destinationRef: string },
  ) {
    return this.svc.consume(id, req.userId, body.destinationRef);
  }
}
```

`apps/api-say/src/pending/pending.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PendingController } from './pending.controller';
import { PendingService } from './pending.service';

@Module({ controllers: [PendingController], providers: [PendingService] })
export class PendingModule {}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npm -w apps/api-say run test:integration -- pending.integration.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api-say/src/pending
git commit -m "feat(api-say): inbound pending API (list, consume) for future Buy/Eat apps"
```

---

## Phase 10 — App wiring

### Task 10.1: AppModule + main.ts

**Files:**

- Modify: `apps/api-say/src/app.module.ts`
- Modify: `apps/api-say/src/main.ts`

- [ ] **Step 1: Update AppModule**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { DictationsModule } from './dictations/dictations.module';
import { PendingModule } from './pending/pending.module';
import { HealthController } from './health/health.controller';
import { loadEnv } from './config/env';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: (raw) => loadEnv(raw as NodeJS.ProcessEnv) }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    IdempotencyModule,
    DispatchModule,
    DictationsModule,
    PendingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 2: Update main.ts**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { auth } from './auth/auth.ts';
import { toNodeHandler } from 'better-auth/node';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: ['http://localhost:8081', 'http://localhost:8082'],
    credentials: true,
  });
  app.use('/auth/{*splat}', toNodeHandler(auth)); // Better Auth handles its own routes
  await app.listen(process.env.PORT ?? 3003);
}
bootstrap();
```

- [ ] **Step 3: Smoke test — boot and hit /health**

Run terminal A: `npm -w apps/api-say run dev`
Run terminal B: `curl http://localhost:3003/health`
Expected: `{"status":"ok"}`. Then Ctrl+C terminal A.

- [ ] **Step 4: Commit**

```bash
git add apps/api-say/src/app.module.ts apps/api-say/src/main.ts
git commit -m "feat(api-say): wire modules in AppModule; configure CORS + Better Auth route handler"
```

---

## Phase 11 — Eval harness

### Task 11.1: 50-case eval set + run-eval script + CI integration

**Files:**

- Create: `apps/api-say/__tests__/eval/intent-classification/cases.jsonl` (50 lines — sample below; expand to 50)
- Create: `apps/api-say/__tests__/eval/intent-classification/run-eval.ts`
- Create: `apps/api-say/__tests__/eval/intent-classification/baseline.json`
- Modify: `apps/api-say/package.json` (add scripts)

- [ ] **Step 1: Create initial 50 cases**

`apps/api-say/__tests__/eval/intent-classification/cases.jsonl` (sample — write 50 covering each intent + edge cases + drive mode):

```jsonl
{"transcript":"remind me to email Jamie about Q3 by Thursday","userTz":"Pacific/Auckland","captureMode":"tap","expectedIntent":"DO","minConfidence":0.85}
{"transcript":"make a note that the door code is 4471","userTz":"Pacific/Auckland","captureMode":"tap","expectedIntent":"NOTE","minConfidence":0.85}
{"transcript":"pick up oat milk and lightbulbs","userTz":"Pacific/Auckland","captureMode":"tap","expectedIntent":"BUY","minConfidence":0.75}
{"transcript":"draft an email to Sarah saying I will be late","userTz":"Pacific/Auckland","captureMode":"tap","expectedIntent":"SEND","minConfidence":0.85}
{"transcript":"want to try making sourdough this weekend","userTz":"Pacific/Auckland","captureMode":"tap","expectedIntent":"EAT","minConfidence":0.75}
{"transcript":"go to that ramen place on Cuba street next Friday","userTz":"Pacific/Auckland","captureMode":"tap","expectedIntent":"EAT","minConfidence":0.75}
{"transcript":"add to shopping bin liners","userTz":"Pacific/Auckland","captureMode":"tap","expectedIntent":"BUY","minConfidence":0.75}
{"transcript":"don't forget to call mum tomorrow at 5pm","userTz":"Pacific/Auckland","captureMode":"tap","expectedIntent":"DO","minConfidence":0.85}
{"transcript":"umm","userTz":"Pacific/Auckland","captureMode":"tap","expectedIntent":"NOTE","minConfidence":0.0}
{"transcript":"reply to the team about the launch date","userTz":"Pacific/Auckland","captureMode":"tap","expectedIntent":"SEND","minConfidence":0.75}
```

(Expand to 50 covering: each intent × 6+; ambiguous cases; gibberish; drive-mode flavour; multi-language vocab in transcript; punctuation absence; date parsing edge cases like "in two hours", "Friday", "the 23rd".)

- [ ] **Step 2: Implement run-eval CLI**

`apps/api-say/__tests__/eval/intent-classification/run-eval.ts`:

```typescript
import { readFileSync, writeFileSync, existsSync } from 'fs';
import * as path from 'path';
import { DateTime } from 'luxon';
import { createAiClient } from '@things/ai';
import { intentResult } from '@things/types';
import { INTENT_CLASSIFY_PROMPT } from '../../../src/ai/prompts/intent-classify-prompt';

interface Case {
  transcript: string;
  userTz: string;
  captureMode: 'tap' | 'drive';
  expectedIntent: 'DO' | 'NOTE' | 'SEND' | 'BUY' | 'EAT';
  minConfidence: number;
}

interface BaselineMetrics {
  intentAccuracy: number;
  payloadFieldAccuracy: number;
  brier: number;
  perIntent: Record<string, { correct: number; total: number }>;
}

async function main() {
  const here = path.dirname(__filename);
  const cases: Case[] = readFileSync(path.join(here, 'cases.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const ai = createAiClient({
    openaiApiKey: process.env.OPENAI_API_KEY!,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  });

  let correct = 0;
  let payloadFieldOk = 0;
  let brierSum = 0;
  const perIntent: Record<string, { correct: number; total: number }> = {
    DO: { correct: 0, total: 0 },
    NOTE: { correct: 0, total: 0 },
    SEND: { correct: 0, total: 0 },
    BUY: { correct: 0, total: 0 },
    EAT: { correct: 0, total: 0 },
  };

  for (const c of cases) {
    const now = DateTime.now().setZone(c.userTz).toISO();
    const r = await ai.chatStructured({
      schema: intentResult,
      systemPrompt: INTENT_CLASSIFY_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Current user timezone: ${c.userTz}\nCurrent user local time: ${now}\ncaptureMode: ${c.captureMode}\n\nTranscript: """${c.transcript}"""`,
        },
      ],
      cacheSystem: true,
    });
    const correctIntent = r.value.intent === c.expectedIntent;
    if (correctIntent) correct++;
    if (correctIntent && r.value.confidence >= c.minConfidence) payloadFieldOk++;
    perIntent[c.expectedIntent].total++;
    if (correctIntent) perIntent[c.expectedIntent].correct++;
    const truth = correctIntent ? 1 : 0;
    brierSum += (r.value.confidence - truth) ** 2;
  }

  const metrics: BaselineMetrics = {
    intentAccuracy: correct / cases.length,
    payloadFieldAccuracy: payloadFieldOk / cases.length,
    brier: brierSum / cases.length,
    perIntent,
  };

  console.log('Intent accuracy:        ', (metrics.intentAccuracy * 100).toFixed(1), '%');
  console.log('Payload field accuracy: ', (metrics.payloadFieldAccuracy * 100).toFixed(1), '%');
  console.log('Brier:                  ', metrics.brier.toFixed(3));
  console.log('Per-intent:             ', JSON.stringify(metrics.perIntent));

  const baselineFile = path.join(here, 'baseline.json');
  if (existsSync(baselineFile)) {
    const b: BaselineMetrics = JSON.parse(readFileSync(baselineFile, 'utf8'));
    const drop = (b.intentAccuracy - metrics.intentAccuracy) * 100;
    if (drop > 3) {
      console.error(
        `FAIL: intent accuracy dropped ${drop.toFixed(1)}pp from baseline (${(b.intentAccuracy * 100).toFixed(1)}% → ${(metrics.intentAccuracy * 100).toFixed(1)}%)`,
      );
      process.exit(1);
    }
  } else {
    writeFileSync(baselineFile, JSON.stringify(metrics, null, 2));
    console.log('Wrote initial baseline.json');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Add npm script to `apps/api-say/package.json`**

```json
"scripts": {
  "eval:intent": "ts-node __tests__/eval/intent-classification/run-eval.ts"
}
```

- [ ] **Step 4: First run writes baseline**

Run: `npm -w apps/api-say run eval:intent`
Expected: prints metrics; writes `baseline.json`.

- [ ] **Step 5: Commit**

```bash
git add apps/api-say/__tests__/eval apps/api-say/package.json
git commit -m "feat(api-say): intent-classification eval harness with 50-case baseline + CI gate"
```

---

## Phase 12 — Cross-app contract test

### Task 12.1: `say-to-do.e2e.spec.ts`

**Files:**

- Create: `apps/api-say/__tests__/e2e/cross-app/say-to-do.e2e.spec.ts`

- [ ] **Step 1: Write the e2e test**

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule as SayModule } from '../../../src/app.module';
import { AppModule as DoModule } from '../../../../api-do/src/app.module';
import { PrismaService as SayPrisma } from '../../../src/prisma/prisma.service';
import { PrismaService as DoPrisma } from '../../../../api-do/src/prisma/prisma.service';
import { AiClient } from '@things/ai';
import { signServiceToken } from '@things/auth';

describe('Cross-app: Say → Do (e2e contract)', () => {
  let sayApp: INestApplication;
  let doApp: INestApplication;
  let sayPrisma: SayPrisma;
  let doPrisma: DoPrisma;
  const userId = 'u-x';

  const stubAi: jest.Mocked<AiClient> = {
    transcribe: jest
      .fn()
      .mockResolvedValue({
        text: 'remind me to call mum',
        language: 'en',
        segments: [],
        usage: { elapsedMs: 100, costUsd: 0 },
      }),
    chatStructured: jest
      .fn()
      .mockResolvedValue({
        value: { intent: 'DO', payload: { title: 'Call mum', dueAt: null }, confidence: 0.94 },
        usage: { elapsedMs: 100, costUsd: 0 },
      }),
  } as never;

  beforeAll(async () => {
    const sayMod = await Test.createTestingModule({ imports: [SayModule] })
      .overrideProvider(AiClient)
      .useValue(stubAi)
      .compile();
    sayApp = sayMod.createNestApplication();
    await sayApp.init();
    sayPrisma = sayMod.get(SayPrisma);

    const doMod = await Test.createTestingModule({ imports: [DoModule] }).compile();
    doApp = doMod.createNestApplication();
    await doApp.listen(3098); // api-say's DoSdk uses DO_API_URL
    process.env.DO_API_URL = 'http://localhost:3098';
    doPrisma = doMod.get(DoPrisma);

    await sayPrisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: 'x@x', emailVerified: true, timezone: 'UTC' },
    });
    await doPrisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: 'x@x', emailVerified: true, timezone: 'UTC' },
    });
  });
  afterAll(async () => {
    await sayApp.close();
    await doApp.close();
  });

  it('dispatches DO intent → Task lands in api-do with correct source field', async () => {
    const r1 = await request(sayApp.getHttpServer())
      .post('/dictations')
      .set('Idempotency-Key', 'x-1')
      .set('Cookie', 'better-auth.session=mocked')
      .field('captureMode', 'tap')
      .attach('audio', Buffer.from('fake'), 'a.webm')
      .expect(201);

    const r2 = await request(sayApp.getHttpServer())
      .post(`/dictations/${r1.body.dictation.id}/dispatch`)
      .set('Idempotency-Key', 'x-2')
      .set('Cookie', 'better-auth.session=mocked')
      .send({})
      .expect(201);

    const tasks = await doPrisma.task.findMany({ where: { userId } });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe('Call mum');
    expect(tasks[0]?.source).toEqual({ app: 'say-things', dictationId: r1.body.dictation.id });

    // Undo
    await request(sayApp.getHttpServer())
      .delete(`/dictations/${r1.body.dictation.id}/dispatch`)
      .set('Idempotency-Key', 'x-3')
      .set('Cookie', 'better-auth.session=mocked')
      .expect(200);
    expect(await doPrisma.task.findMany({ where: { userId } })).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run, debug, confirm pass**

Run: `npm -w apps/api-say run test:e2e -- say-to-do.e2e.spec.ts`
Expected: PASS after fixing any wiring issues (Better Auth session mock, DO_API_URL env, etc.).

- [ ] **Step 3: Commit**

```bash
git add apps/api-say/__tests__/e2e
git commit -m "test(api-say): cross-app e2e — Say dispatch lands Task in api-do with source provenance + undo"
```

---

## Self-review

Run through the spec sections and verify each is covered by a task:

| Spec section                           | Tasks                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| §1 Context                             | (informational; no tasks needed)                                                     |
| §2 D1 dictation-only                   | Implicit — no long-form code anywhere in plan                                        |
| §2 D2 intent set + pending trays       | Phase 1, 3 (enum), 7 (handlers), 9 (pending API)                                     |
| §2 D3 hybrid routing                   | Phase 6 (prompt), 7 (handlers), 8 (controller)                                       |
| §2 D4 hybrid STT                       | (Frontend-only — Plan B)                                                             |
| §2 D5 one-shot proposal, no optimistic | Phase 8 (`state: 'proposed'` on create; dispatch is separate endpoint)               |
| §2 D6 full P4 first                    | Stated as Hard Prerequisite #1                                                       |
| §2 D7 user timezone                    | Phase 0 (Task 0.1, 0.2), Phase 4 (auth.ts additionalFields), Phase 8 (passed to LLM) |
| §2 D8 Stripe-style idempotency         | Phase 5 (interceptor with conflict + race + cleanup)                                 |
| §2 D9 reclassify                       | Phase 8 (`reclassify()` method + endpoint)                                           |
| §2 D10 drive mode                      | (Frontend-only — Plan B)                                                             |
| §2 D11 eval harness                    | Phase 11                                                                             |
| §2 D12 api-do source field             | Phase 0 (Task 0.3, 0.4, 0.5)                                                         |
| §2 D13 ephemeral audio                 | Phase 8 (`try/finally fs.unlink`)                                                    |
| §2 D14 pending tray query              | Phase 9 (filtered query in PendingService)                                           |
| §2 D15 drive auto-cancel <0.6          | (Frontend-only — Plan B)                                                             |
| §3 Architecture                        | All phases together                                                                  |
| §4 Data model                          | Phase 3                                                                              |
| §5 Pipeline                            | Phase 8                                                                              |
| §6 Classification                      | Phase 6, 8                                                                           |
| §7 Dispatch                            | Phase 7, 8                                                                           |
| §8 Drive mode                          | (Plan B)                                                                             |
| §9 Screens                             | (Plan B)                                                                             |
| §10 Testing — eval harness             | Phase 11                                                                             |
| §10 Testing — cross-app contract       | Phase 12                                                                             |
| §11 Prereqs                            | Stated at top                                                                        |
| §12 Risks                              | Acknowledged in spec; nothing to implement in this plan                              |

All in-scope spec items covered.

---

## Follow-up plans

After this plan ships, the next plans are:

1. **P4 — `@things/ai` package** (must precede this plan's execution — write its brainstorm + spec + plan first)
2. **Say Things — Frontend (web-say)** — all screens, hooks, drive mode, settings. Mirrors web-do plan structure but with the additional drive-mode complexity. Created after this plan is implemented and api-say is running.
