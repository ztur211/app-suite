# api-do Task CRUD Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **P5 update (2026-05-27):** This plan originally specified a different dev backend, which P5 replaced with Postgres per the foundation spec. Schema/code snippets and tech-stack notes below have been updated to reflect the Postgres stack; the data-model and routing intent of the plan are unchanged. See `2026-05-27-postgres-migration.md` for the migration plan.

**Goal:** Add Task CRUD endpoints (GET/POST/PATCH/DELETE /tasks) to `apps/api-do` backed by Prisma + Postgres, with session auth validated against the shared `things_auth` database.

**Architecture:** api-do gets its own Prisma schema that includes Task (the domain model) plus mirrored Better Auth tables (User/Session/Account/Verification) so one Prisma client can serve both tasks and session reads. The mirrored tables let api-do read sessions without a cross-database query in dev; the `auth_reader` Postgres role on `things_auth` is the production read path. A NestJS `SessionGuard` calls `auth.api.getSession()` to extract `userId` from the cookie on every protected route.

**Tech Stack:** NestJS 11, Prisma 5, Postgres 16 (via docker-compose.dev.yml in dev; testcontainers in tests), Better Auth 1.x, TypeScript 5.6 strict, Jest 29 (unit + integration), supertest

---

## File Map

| Path                                                       | Action | Responsibility                                                             |
| ---------------------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| `apps/api-do/prisma/schema.prisma`                         | Create | Task model + mirrored Better Auth tables                                   |
| `apps/api-do/.env.example`                                 | Create | Document required env vars                                                 |
| `apps/api-do/.env`                                         | Create | Real dev values (gitignored)                                               |
| `apps/api-do/package.json`                                 | Modify | Add `@prisma/client`, `prisma`, `better-auth`, `cross-env`; add db scripts |
| `apps/api-do/src/auth/auth.ts`                             | Create | `betterAuth()` instance pointing at `things_auth`                          |
| `apps/api-do/src/auth/session.guard.ts`                    | Create | NestJS guard that validates cookie → attaches `req.userId`                 |
| `apps/api-do/src/auth/__tests__/session.guard.spec.ts`     | Create | Unit tests for SessionGuard                                                |
| `apps/api-do/src/tasks/tasks.service.ts`                   | Create | Prisma-backed list/create/setCompleted/remove                              |
| `apps/api-do/src/tasks/tasks.controller.ts`                | Create | GET/POST/PATCH/DELETE /tasks routes                                        |
| `apps/api-do/src/tasks/tasks.module.ts`                    | Create | NestJS module wiring PrismaClient + TasksService + TasksController         |
| `apps/api-do/src/tasks/__tests__/tasks.service.spec.ts`    | Create | Unit tests for TasksService (mocked PrismaClient)                          |
| `apps/api-do/src/tasks/__tests__/tasks.controller.spec.ts` | Create | Unit tests for TasksController (mocked TasksService)                       |
| `apps/api-do/src/tasks/tasks.integration.spec.ts`          | Create | Integration tests against real DB + real NestJS app                        |
| `apps/api-do/src/app.module.ts`                            | Modify | Import TasksModule                                                         |

---

### Task 1: Prisma schema + env files + package.json deps

**Files:**

- Create: `apps/api-do/prisma/schema.prisma`
- Create: `apps/api-do/.env.example`
- Create: `apps/api-do/.env`
- Modify: `apps/api-do/package.json`

- [ ] **Step 1: Create the Prisma directory and schema**

Create `apps/api-do/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---- Things Do domain ----

model Task {
  id        String    @id @default(cuid())
  userId    String
  title     String
  completed Boolean   @default(false)
  dueAt     DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([userId, completed])
  @@index([userId, createdAt])
}

// ---- Mirrored from things_auth for Better Auth session validation ----

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified Boolean   @default(false)
  name          String?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Account {
  id                    String    @id @default(cuid())
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accountId             String
  providerId            String
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@unique([providerId, accountId])
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([identifier, value])
}
```

- [ ] **Step 2: Create .env.example**

Create `apps/api-do/.env.example`:

```
DATABASE_URL="postgresql://do_owner:do_owner@localhost:5432/things_do?schema=public"
BETTER_AUTH_SECRET="<copy from apps/api-auth/.env — must match exactly>"
PORT=3002
```

- [ ] **Step 3: Create .env with real dev values**

Create `apps/api-do/.env`:

```
DATABASE_URL="postgresql://do_owner:do_owner@localhost:5432/things_do?schema=public"
BETTER_AUTH_SECRET="dev-things-auth-secret-min-32-chars-long-abc"
PORT=3002
```

- [ ] **Step 4: Update package.json**

Edit `apps/api-do/package.json` — add to `dependencies`:

```json
"@prisma/client": "^5.22.0",
"better-auth": "^1.6.11"
```

Add to `devDependencies`:

```json
"cross-env": "^7.0.3",
"prisma": "^5.22.0",
"supertest": "^7.0.0"
```

Add to `scripts`:

```json
"db:generate": "prisma generate",
"db:push": "prisma db push --skip-generate"
```

Update `test:integration` script to match api-auth's pattern:

```json
"test:integration": "cross-env NODE_OPTIONS=--experimental-vm-modules jest --config jest.integration.config.ts --passWithNoTests"
```

- [ ] **Step 5: Install deps and generate Prisma client**

Run from the monorepo root:

```powershell
npm install
```

Then run from `apps/api-do/`:

```powershell
npx prisma generate --schema=apps/api-do/prisma/schema.prisma
npx prisma db push --schema=apps/api-do/prisma/schema.prisma --skip-generate
```

Expected: `apps/api-auth/things_auth` is updated to include the `Task` table. The existing User/Session/Account/Verification tables already match — Prisma will see them as already-present.

- [ ] **Step 6: Commit**

```bash
git add apps/api-do/prisma/schema.prisma apps/api-do/.env.example apps/api-do/package.json package-lock.json
git commit -m "feat(api-do): add Prisma schema for Task model"
```

---

### Task 2: Better Auth instance for api-do

**Files:**

- Create: `apps/api-do/src/auth/auth.ts`

- [ ] **Step 1: Create the auth directory and auth.ts**

Create `apps/api-do/src/auth/auth.ts`:

```typescript
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

// This Prisma client connects to things_auth (the shared user DB),
// which also contains the Task table. One DB, one client.
export const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  secret: process.env['BETTER_AUTH_SECRET']!,
  basePath: '/auth',
  trustedOrigins: ['http://localhost:3002', 'http://localhost:8081'],
});

export type Auth = typeof auth;
```

- [ ] **Step 2: Commit**

```bash
git add apps/api-do/src/auth/auth.ts
git commit -m "feat(api-do): add Better Auth instance pointing at shared auth DB"
```

---

### Task 3: SessionGuard with unit tests

**Files:**

- Create: `apps/api-do/src/auth/session.guard.ts`
- Create: `apps/api-do/src/auth/__tests__/session.guard.spec.ts`

- [ ] **Step 1: Write the failing unit test**

Create `apps/api-do/src/auth/__tests__/session.guard.spec.ts`:

```typescript
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionGuard } from '../session.guard';

// Mock the auth module so no real DB is touched
jest.mock('../auth', () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

import { auth } from '../auth';

function makeContext(headers: Record<string, string> = {}): ExecutionContext {
  const req = {
    headers,
    userId: undefined as string | undefined,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

describe('SessionGuard (unit)', () => {
  let guard: SessionGuard;

  beforeEach(() => {
    guard = new SessionGuard();
    jest.clearAllMocks();
  });

  it('returns true and sets req.userId when session is valid', async () => {
    (auth.api.getSession as jest.Mock).mockResolvedValueOnce({
      user: { id: 'user-123' },
      session: { id: 'sess-abc' },
    });

    const ctx = makeContext({ cookie: 'better-auth.session_token=abc' });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    const req = ctx.switchToHttp().getRequest() as { userId: string };
    expect(req.userId).toBe('user-123');
  });

  it('throws UnauthorizedException when session is null', async () => {
    (auth.api.getSession as jest.Mock).mockResolvedValueOnce(null);

    const ctx = makeContext({ cookie: 'better-auth.session_token=invalid' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when no cookie header', async () => {
    (auth.api.getSession as jest.Mock).mockResolvedValueOnce(null);

    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
npx jest --config apps/api-do/jest.unit.config.ts apps/api-do/src/auth/__tests__/session.guard.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../session.guard'`

- [ ] **Step 3: Implement SessionGuard**

Create `apps/api-do/src/auth/session.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { auth } from './auth';

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const headers = new Headers();
    Object.entries(req.headers).forEach(([k, v]) => {
      if (typeof v === 'string') headers.set(k, v);
      else if (Array.isArray(v)) headers.set(k, v.join(', '));
    });

    const session = await auth.api.getSession({ headers });
    if (!session) throw new UnauthorizedException();

    (req as Request & { userId: string }).userId = session.user.id;
    return true;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```powershell
npx jest --config apps/api-do/jest.unit.config.ts apps/api-do/src/auth/__tests__/session.guard.spec.ts --no-coverage
```

Expected: PASS — 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/api-do/src/auth/session.guard.ts apps/api-do/src/auth/__tests__/session.guard.spec.ts
git commit -m "feat(api-do): add SessionGuard for cookie-based auth"
```

---

### Task 4: TasksService with unit tests

**Files:**

- Create: `apps/api-do/src/tasks/tasks.service.ts`
- Create: `apps/api-do/src/tasks/__tests__/tasks.service.spec.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `apps/api-do/src/tasks/__tests__/tasks.service.spec.ts`:

```typescript
import { NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TasksService } from '../tasks.service';

// Mock PrismaClient entirely
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    task: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

describe('TasksService (unit)', () => {
  let service: TasksService;
  let prisma: {
    task: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = new (PrismaClient as unknown as new () => typeof prisma)();
    service = new TasksService(prisma as unknown as PrismaClient);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('returns tasks for the given userId ordered by createdAt desc', async () => {
      const tasks = [{ id: '1', title: 'Task A', userId: 'u1', completed: false }];
      prisma.task.findMany.mockResolvedValueOnce(tasks);

      const result = await service.list('u1');

      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toBe(tasks);
    });
  });

  describe('create', () => {
    it('creates a task with title and no dueAt', async () => {
      const created = { id: 'new', title: 'Buy milk', userId: 'u1', completed: false, dueAt: null };
      prisma.task.create.mockResolvedValueOnce(created);

      const result = await service.create('u1', { title: 'Buy milk' });

      expect(prisma.task.create).toHaveBeenCalledWith({
        data: { userId: 'u1', title: 'Buy milk', dueAt: null },
      });
      expect(result).toBe(created);
    });

    it('creates a task with a dueAt date string', async () => {
      const dueAt = '2026-06-01T00:00:00.000Z';
      const created = {
        id: 'new2',
        title: 'Doctor',
        userId: 'u1',
        completed: false,
        dueAt: new Date(dueAt),
      };
      prisma.task.create.mockResolvedValueOnce(created);

      const result = await service.create('u1', { title: 'Doctor', dueAt });

      expect(prisma.task.create).toHaveBeenCalledWith({
        data: { userId: 'u1', title: 'Doctor', dueAt: new Date(dueAt) },
      });
      expect(result).toBe(created);
    });
  });

  describe('setCompleted', () => {
    it('updates completed status when task belongs to user', async () => {
      const existing = { id: 't1', userId: 'u1', title: 'Task', completed: false };
      const updated = { ...existing, completed: true };
      prisma.task.findUnique.mockResolvedValueOnce(existing);
      prisma.task.update.mockResolvedValueOnce(updated);

      const result = await service.setCompleted('u1', 't1', true);

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { completed: true },
      });
      expect(result).toBe(updated);
    });

    it('throws NotFoundException when task does not exist', async () => {
      prisma.task.findUnique.mockResolvedValueOnce(null);
      await expect(service.setCompleted('u1', 'missing', true)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when task belongs to a different user', async () => {
      prisma.task.findUnique.mockResolvedValueOnce({ id: 't1', userId: 'other-user' });
      await expect(service.setCompleted('u1', 't1', true)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the task and returns { ok: true }', async () => {
      prisma.task.findUnique.mockResolvedValueOnce({ id: 't1', userId: 'u1' });
      prisma.task.delete.mockResolvedValueOnce({});

      const result = await service.remove('u1', 't1');

      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
      expect(result).toEqual({ ok: true });
    });

    it('throws NotFoundException when task does not exist', async () => {
      prisma.task.findUnique.mockResolvedValueOnce(null);
      await expect(service.remove('u1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when task belongs to a different user', async () => {
      prisma.task.findUnique.mockResolvedValueOnce({ id: 't1', userId: 'other-user' });
      await expect(service.remove('u1', 't1')).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
npx jest --config apps/api-do/jest.unit.config.ts apps/api-do/src/tasks/__tests__/tasks.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../tasks.service'`

- [ ] **Step 3: Implement TasksService**

Create `apps/api-do/src/tasks/tasks.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(userId: string) {
    return this.prisma.task.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async create(userId: string, data: { title: string; dueAt?: string }) {
    return this.prisma.task.create({
      data: { userId, title: data.title, dueAt: data.dueAt ? new Date(data.dueAt) : null },
    });
  }

  async setCompleted(userId: string, id: string, completed: boolean) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException();
    return this.prisma.task.update({ where: { id }, data: { completed } });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException();
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```powershell
npx jest --config apps/api-do/jest.unit.config.ts apps/api-do/src/tasks/__tests__/tasks.service.spec.ts --no-coverage
```

Expected: PASS — 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/api-do/src/tasks/tasks.service.ts apps/api-do/src/tasks/__tests__/tasks.service.spec.ts
git commit -m "feat(api-do): add TasksService with Prisma CRUD operations"
```

---

### Task 5: TasksController with unit tests + module

**Files:**

- Create: `apps/api-do/src/tasks/tasks.controller.ts`
- Create: `apps/api-do/src/tasks/__tests__/tasks.controller.spec.ts`
- Create: `apps/api-do/src/tasks/tasks.module.ts`
- Modify: `apps/api-do/src/app.module.ts`

- [ ] **Step 1: Write the failing unit tests for TasksController**

Create `apps/api-do/src/tasks/__tests__/tasks.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from '../tasks.controller';
import { TasksService } from '../tasks.service';

const mockTasksService = {
  list: jest.fn(),
  create: jest.fn(),
  setCompleted: jest.fn(),
  remove: jest.fn(),
};

// Mock the SessionGuard so controller unit tests don't need DB
jest.mock('../../auth/session.guard', () => ({
  SessionGuard: class {
    canActivate() {
      return true;
    }
  },
}));

// Mock auth module too
jest.mock('../../auth/auth', () => ({
  auth: { api: { getSession: jest.fn() } },
}));

function makeRequest(userId: string) {
  return { userId } as { userId: string };
}

describe('TasksController (unit)', () => {
  let controller: TasksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: mockTasksService }],
    }).compile();

    controller = module.get<TasksController>(TasksController);
    jest.clearAllMocks();
  });

  it('GET /tasks calls service.list with userId', async () => {
    const tasks = [{ id: '1', title: 'Task' }];
    mockTasksService.list.mockResolvedValueOnce(tasks);

    const result = await controller.list(makeRequest('u1'));
    expect(mockTasksService.list).toHaveBeenCalledWith('u1');
    expect(result).toBe(tasks);
  });

  it('POST /tasks calls service.create with userId and body', async () => {
    const task = { id: 'new', title: 'New Task' };
    mockTasksService.create.mockResolvedValueOnce(task);

    const result = await controller.create(makeRequest('u1'), { title: 'New Task' });
    expect(mockTasksService.create).toHaveBeenCalledWith('u1', { title: 'New Task' });
    expect(result).toBe(task);
  });

  it('PATCH /tasks/:id calls service.setCompleted', async () => {
    const updated = { id: 't1', completed: true };
    mockTasksService.setCompleted.mockResolvedValueOnce(updated);

    const result = await controller.patch(makeRequest('u1'), 't1', { completed: true });
    expect(mockTasksService.setCompleted).toHaveBeenCalledWith('u1', 't1', true);
    expect(result).toBe(updated);
  });

  it('DELETE /tasks/:id calls service.remove', async () => {
    mockTasksService.remove.mockResolvedValueOnce({ ok: true });

    const result = await controller.remove(makeRequest('u1'), 't1');
    expect(mockTasksService.remove).toHaveBeenCalledWith('u1', 't1');
    expect(result).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
npx jest --config apps/api-do/jest.unit.config.ts apps/api-do/src/tasks/__tests__/tasks.controller.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../tasks.controller'`

- [ ] **Step 3: Implement TasksController**

Create `apps/api-do/src/tasks/tasks.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(SessionGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@Req() req: Request & { userId: string }) {
    return this.tasks.list(req.userId);
  }

  @Post()
  create(
    @Req() req: Request & { userId: string },
    @Body() body: { title: string; dueAt?: string },
  ) {
    return this.tasks.create(req.userId, body);
  }

  @Patch(':id')
  patch(
    @Req() req: Request & { userId: string },
    @Param('id') id: string,
    @Body() body: { completed: boolean },
  ) {
    return this.tasks.setCompleted(req.userId, id, body.completed);
  }

  @Delete(':id')
  remove(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.tasks.remove(req.userId, id);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```powershell
npx jest --config apps/api-do/jest.unit.config.ts apps/api-do/src/tasks/__tests__/tasks.controller.spec.ts --no-coverage
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Create TasksModule**

Create `apps/api-do/src/tasks/tasks.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => new PrismaClient(),
    },
    TasksService,
  ],
})
export class TasksModule {}
```

- [ ] **Step 6: Register TasksModule in AppModule**

Edit `apps/api-do/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [TasksModule],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api-do/src/tasks/tasks.controller.ts apps/api-do/src/tasks/__tests__/tasks.controller.spec.ts apps/api-do/src/tasks/tasks.module.ts apps/api-do/src/app.module.ts
git commit -m "feat(api-do): add TasksController, TasksModule, wire into AppModule"
```

---

### Task 6: Integration tests

**Files:**

- Create: `apps/api-do/src/tasks/tasks.integration.spec.ts`

- [ ] **Step 1: Write the integration test**

Create `apps/api-do/src/tasks/tasks.integration.spec.ts`:

```typescript
/**
 * Integration tests for the Tasks CRUD endpoints.
 *
 * Boots a real NestJS app against the real Postgres DB (things_auth).
 * Inserts a test User + Session directly via Prisma to avoid needing api-auth running.
 * Cleans up after itself.
 *
 * Requires:
 *   - apps/api-do/.env with DATABASE_URL pointing at things_auth
 *   - apps/api-auth/things_auth to exist (run prisma db push first)
 */
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { prisma } from '../auth/auth';

const TEST_USER_ID = `test-user-${Date.now()}`;
const TEST_EMAIL = `tasks-integration-${Date.now()}@things-test.local`;
// Fake session token for tests — format matches what Better Auth expects
const TEST_SESSION_TOKEN = `test-session-token-${Date.now()}`;

async function seedTestUserAndSession() {
  // Create the user
  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      email: TEST_EMAIL,
      emailVerified: true,
      name: 'Tasks Integration Test',
    },
  });

  // Create a session with a far-future expiry
  await prisma.session.create({
    data: {
      id: `sess-${Date.now()}`,
      userId: TEST_USER_ID,
      token: TEST_SESSION_TOKEN,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours from now
    },
  });
}

async function cleanupTestData() {
  // Delete tasks first (no FK constraint, but good practice)
  await prisma.task.deleteMany({ where: { userId: TEST_USER_ID } });
  // Cascade deletes sessions + accounts via User relation
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
}

describe('Tasks CRUD (integration)', () => {
  let app: INestApplication;
  let createdTaskId: string;

  beforeAll(async () => {
    await seedTestUserAndSession();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
    await prisma.$disconnect();
  });

  it('GET /tasks without cookie returns 401', async () => {
    await request(app.getHttpServer()).get('/tasks').expect(401);
  });

  it('POST /tasks creates a task and returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', `better-auth.session_token=${TEST_SESSION_TOKEN}`)
      .send({ title: 'Integration test task' })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('Integration test task');
    expect(res.body.completed).toBe(false);
    createdTaskId = res.body.id as string;
  });

  it('GET /tasks returns the created task', async () => {
    const res = await request(app.getHttpServer())
      .get('/tasks')
      .set('Cookie', `better-auth.session_token=${TEST_SESSION_TOKEN}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const found = (res.body as { id: string }[]).find((t) => t.id === createdTaskId);
    expect(found).toBeDefined();
  });

  it('PATCH /tasks/:id toggles completion to true', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tasks/${createdTaskId}`)
      .set('Cookie', `better-auth.session_token=${TEST_SESSION_TOKEN}`)
      .send({ completed: true })
      .expect(200);

    expect(res.body.completed).toBe(true);
  });

  it('DELETE /tasks/:id deletes the task', async () => {
    await request(app.getHttpServer())
      .delete(`/tasks/${createdTaskId}`)
      .set('Cookie', `better-auth.session_token=${TEST_SESSION_TOKEN}`)
      .expect(200);
  });

  it('GET /tasks returns empty array after deletion', async () => {
    const res = await request(app.getHttpServer())
      .get('/tasks')
      .set('Cookie', `better-auth.session_token=${TEST_SESSION_TOKEN}`)
      .expect(200);

    const found = (res.body as { id: string }[]).find((t) => t.id === createdTaskId);
    expect(found).toBeUndefined();
  });

  it('PATCH /tasks/:id for non-existent task returns 404', async () => {
    await request(app.getHttpServer())
      .patch('/tasks/non-existent-id')
      .set('Cookie', `better-auth.session_token=${TEST_SESSION_TOKEN}`)
      .send({ completed: true })
      .expect(404);
  });

  it('GET /health still returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', service: 'api-do' });
  });
});
```

- [ ] **Step 2: Run the integration test**

```powershell
cd apps/api-do
cross-env NODE_OPTIONS=--experimental-vm-modules npx jest --config jest.integration.config.ts --no-coverage
```

Expected: PASS — 8 tests passing (tests use a seeded session token, no real cookie needed from Better Auth).

- [ ] **Step 3: Commit**

```bash
git add apps/api-do/src/tasks/tasks.integration.spec.ts
git commit -m "feat(api-do): add Tasks CRUD endpoints with session auth"
```

---

### Task 7: Full verification sweep

**Files:** None new — just running checks.

- [ ] **Step 1: Run all unit tests**

From monorepo root:

```powershell
npm run test:unit
```

Expected: exit 0

- [ ] **Step 2: Run all integration tests**

```powershell
npm run test:integration
```

Expected: exit 0

- [ ] **Step 3: Lint**

```powershell
npm run lint
```

Expected: exit 0

- [ ] **Step 4: Typecheck**

```powershell
npm run typecheck
```

Expected: exit 0

- [ ] **Step 5: Build**

```powershell
npm run build
```

Expected: exit 0

- [ ] **Step 6: Boot smoke test**

Start api-auth (port 3001) and api-do (port 3002):

```powershell
$auth = Start-Process -FilePath "npm" -ArgumentList "run","dev","-w","apps/api-auth" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 15
$do = Start-Process -FilePath "npm" -ArgumentList "run","dev","-w","apps/api-do" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 15

try {
  $signupBody = @{ email = "do-smoke-$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"; password = "TestPass123!"; name = "Smoke Test" } | ConvertTo-Json
  $signup = Invoke-WebRequest -Uri http://localhost:3001/auth/sign-up/email -Method POST -ContentType 'application/json' -Body $signupBody -UseBasicParsing -SessionVariable s
  Write-Host "Signup: $($signup.StatusCode)"

  $taskBody = @{ title = "First smoke task!" } | ConvertTo-Json
  $task = Invoke-WebRequest -Uri http://localhost:3002/tasks -Method POST -ContentType 'application/json' -Body $taskBody -WebSession $s -UseBasicParsing
  Write-Host "Create task: $($task.StatusCode) $($task.Content)"

  $list = Invoke-WebRequest -Uri http://localhost:3002/tasks -WebSession $s -UseBasicParsing
  Write-Host "List tasks: $($list.Content)"
} catch {
  Write-Host "Smoke failed: $_"
} finally {
  Stop-Process -Id $auth.Id -Force -ErrorAction SilentlyContinue
  Stop-Process -Id $do.Id -Force -ErrorAction SilentlyContinue
  Get-Process | Where-Object { $_.ProcessName -eq 'node' } | Stop-Process -Force -ErrorAction SilentlyContinue
}
```

Expected: Signup 200, Create task 201, List shows the task with a real `id`.

- [ ] **Step 7: Final commit if anything was tweaked during verification**

```bash
git add -p  # stage only intentional changes
git commit -m "fix(api-do): address verification sweep findings"
```

---

## Self-Review

### Spec coverage check

| Spec requirement                               | Covered by                                                      |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `GET /tasks` — list user's tasks, newest first | Task 4 (service), Task 5 (controller), Task 6 (integration)     |
| `POST /tasks` — create `{title, dueAt?}`       | Task 4, Task 5, Task 6                                          |
| `PATCH /tasks/:id` — toggle `completed`        | Task 4, Task 5, Task 6                                          |
| `DELETE /tasks/:id`                            | Task 4, Task 5, Task 6                                          |
| `GET /health` — no auth required               | Existing health controller preserved; integration test verifies |
| Session required on CRUD routes                | Task 3 (SessionGuard), Task 6 (401 test)                        |
| Task must belong to user (setCompleted/remove) | Task 4 service tests cover NotFoundException on wrong user      |
| Prisma schema — Task model                     | Task 1                                                          |
| Prisma schema — Better Auth mirror tables      | Task 1                                                          |
| Single Postgres database shared with api-auth  | Task 1 (.env, db push against api-auth's file)                  |
| `BETTER_AUTH_SECRET` must match api-auth       | Task 1 (.env)                                                   |

### Placeholder scan

No "TBD", "TODO", "similar to Task N", or "implement later" found in the plan. All code blocks are complete.

### Type consistency

- `SessionGuard` exports the same class name used in `tasks.controller.ts` import.
- `TasksService` constructor takes `PrismaClient` — matches `tasks.module.ts` provider.
- `prisma` exported from `auth/auth.ts` — used directly in integration test for seeding.
- `auth.api.getSession({ headers })` — called in `session.guard.ts`; mocked with the same signature in unit tests.
- `req.userId` is `string` in all controller methods; guard attaches it as `string`.
