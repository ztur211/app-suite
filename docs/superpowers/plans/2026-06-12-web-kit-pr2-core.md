# Web-kit Extraction — PR 2: web-kit core (`apiRequest` + `authApi` + `useAuth`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `@things/web-kit` package holding the shared `apiRequest` fetch helper, `authApi`, and `useAuth` Zustand store, then migrate all 5 Expo web apps to consume them — deleting 5 byte-identical `store/auth.store.ts`, the duplicated `request`+`authApi` blocks in each `lib/api.ts`, and the duplicated auth/store tests.

**Architecture:** Two phases. **Phase A** builds `@things/web-kit` in isolation (TDD, fetch mocked) — symmetric to `@things/nest-kit`. **Phase B** migrates each app atomically: repoint `useAuth` imports to the package, rewrite `lib/api.ts` to its domain API on top of `apiRequest`, delete the local store, and consolidate the duplicated tests into web-kit (delete `auth.store.test.ts`, drop the `authApi` block from `api.test.ts`, retarget component-test mocks). No behavior change.

**Tech Stack:** TypeScript 5.6 strict, npm workspaces, Zustand 5, Jest 29 (jest-expo). `@things/web-kit` builds with `tsc`; apps resolve it via a jest `moduleNameMapper` to source (like `@things/design-system`) and via built `dist` for `tsc`.

**Spec:** `docs/superpowers/specs/2026-06-12-web-app-dedup-design.md` — PR 2 section + "Implementation notes".

---

## Preconditions & gotchas

- Branch `refactor/web-kit-core` (off `main` after PR #10 merged). `@things/types` already ships `User`.
- **Module resolution is split** (from the spec notes): each app's `jest.config.ts` needs a `^@things/web-kit$` → source mapper (Task 6); `tsc`/`build:packages` resolves web-kit from built `dist` (web-kit is inserted into `build:packages` after `@things/design-system` in Task 1).
- **Uniform repoint:** every `useAuth` import (production + test) and every `jest.mock('…/store/auth.store', …)` references a path matching `(../)+store/auth.store`. One sed per app rewrites them all to `@things/web-kit`.
- **`apiRequest` uses `global.fetch`** — the existing domain-API tests (`tasksApi`/`itemsApi`/… in `api.test.ts`) keep passing because they already mock `global.fetch`; they just import the domain API, which now calls `apiRequest`.
- **Component-test mock retarget is safe (verified):** the store-list tests (`items`/`meals`/`messages.test.tsx`) all also `jest.mock('../lib/api', …)`, and `login.test.tsx` uses only `useAuth` — none need the real `apiRequest`/`authApi` from web-kit, so rewriting the mock target to `@things/web-kit` with the same `() => ({ useAuth: jest.fn() })` factory is correct.
- web-kit's PR-2 tests are pure logic (no RN render) → no `react-native-reanimated` mock needed yet (that arrives with `LoginScreen` in PR 3). `src/jest.setup.ts` is a no-op this PR.

## File Structure

| File                                                                                       | Change       | Responsibility                                              |
| ------------------------------------------------------------------------------------------ | ------------ | ----------------------------------------------------------- |
| `packages/web-kit/package.json`                                                            | **create**   | Manifest (deps: `@things/types`; peers: `react`, `zustand`) |
| `packages/web-kit/tsconfig.json`                                                           | **create**   | tsc build config (mirrors design-system)                    |
| `packages/web-kit/jest.unit.config.ts` `/jest.integration.config.ts` `/jest.e2e.config.ts` | **create**   | Split jest configs (mirror design-system)                   |
| `packages/web-kit/src/jest.setup.ts`                                                       | **create**   | No-op setup this PR                                         |
| `packages/web-kit/src/request.ts`                                                          | **create**   | `apiRequest<T>` fetch helper                                |
| `packages/web-kit/src/auth-api.ts`                                                         | **create**   | `authApi` (reads `EXPO_PUBLIC_AUTH_URL`)                    |
| `packages/web-kit/src/auth-store.ts`                                                       | **create**   | `useAuth` Zustand store                                     |
| `packages/web-kit/src/index.ts`                                                            | **create**   | Barrel: `apiRequest`, `authApi`, `useAuth`, `User`          |
| `packages/web-kit/src/__tests__/*.test.ts`                                                 | **create**   | smoke + request + auth-api + auth-store tests               |
| `package.json` (root)                                                                      | modify       | Insert web-kit into `build:packages`                        |
| `apps/web-*/package.json`                                                                  | modify       | Add `@things/web-kit` dep                                   |
| `apps/web-*/jest.config.ts`                                                                | modify       | Add `^@things/web-kit$` source mapper                       |
| `apps/web-*/lib/api.ts`                                                                    | modify       | Domain API only, on `apiRequest`                            |
| `apps/web-*/store/auth.store.ts`                                                           | **delete**   | Moved to web-kit                                            |
| `apps/web-*/app/**` , component tests                                                      | modify (sed) | Repoint `useAuth` import to `@things/web-kit`               |
| `apps/web-{do,buy}/__tests__/auth.store.test.ts`                                           | **delete**   | Consolidated into web-kit                                   |
| `apps/web-{do,buy,eat,send}/__tests__/api.test.ts`                                         | modify       | Drop `authApi` import + describe block                      |

---

# Phase A — Create `@things/web-kit`

## Task 1: Scaffold the package

**Files:** create `packages/web-kit/{package.json,tsconfig.json,jest.unit.config.ts,jest.integration.config.ts,jest.e2e.config.ts,src/jest.setup.ts,src/index.ts,src/__tests__/smoke.test.ts}`; modify root `package.json`.

- [ ] **Step 1: Create `packages/web-kit/package.json`**

```json
{
  "name": "@things/web-kit",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "clean": "rimraf dist .tsbuildinfo",
    "lint": "eslint src --max-warnings 0",
    "test": "npm run test:unit",
    "test:unit": "jest --config jest.unit.config.ts",
    "test:integration": "jest --config jest.integration.config.ts --passWithNoTests",
    "test:e2e": "jest --config jest.e2e.config.ts --passWithNoTests",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@things/types": "*"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "zustand": ">=5.0.0"
  },
  "devDependencies": {
    "@react-native/jest-preset": "0.85.3",
    "@types/jest": "^29.5.13",
    "@types/react": "~19.1.1",
    "jest": "^29.7.0",
    "jest-expo": "~55.0.0",
    "react": "19.2.6",
    "react-native": "0.85.3",
    "react-test-renderer": "19.2.6",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.2",
    "zustand": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/web-kit/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "tsBuildInfoFile": ".tsbuildinfo"
  },
  "include": ["src/**/*"],
  "exclude": [
    "src/**/__tests__/**",
    "src/**/*.test.ts",
    "src/**/*.test.tsx",
    "src/**/*.spec.ts",
    "src/**/*.spec.tsx",
    "src/jest.setup.ts",
    "dist",
    "node_modules"
  ]
}
```

- [ ] **Step 3: Create the three jest configs**

`packages/web-kit/jest.unit.config.ts`:

```ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  rootDir: 'src',
  testRegex: '.*\\.(test|spec)\\.(ts|tsx)$',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.expo/',
    '\\.integration\\.spec\\.(ts|tsx)$',
    '\\.e2e\\.spec\\.(ts|tsx)$',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-native-svg|react-native-safe-area-context|react-native-screens|nativewind|react-native-reanimated)',
  ],
  collectCoverageFrom: ['**/*.{ts,tsx}', '!**/__tests__/**', '!**/*.d.ts'],
  coverageDirectory: '../coverage/unit',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};

export default config;
```

`packages/web-kit/jest.integration.config.ts`:

```ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.integration\\.(test|spec)\\.ts$',
  testPathIgnorePatterns: ['/node_modules/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};

export default config;
```

`packages/web-kit/jest.e2e.config.ts`:

```ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.e2e\\.(test|spec)\\.ts$',
  testPathIgnorePatterns: ['/node_modules/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};

export default config;
```

- [ ] **Step 4: Create `packages/web-kit/src/jest.setup.ts` (no-op this PR)**

```ts
// No global mocks needed for web-kit's logic-only unit tests.
// react-native-reanimated mock is added in PR 3 when LoginScreen arrives.
export {};
```

- [ ] **Step 5: Create the barrel `packages/web-kit/src/index.ts` (placeholder)**

```ts
export const PACKAGE_NAME = '@things/web-kit' as const;
```

- [ ] **Step 6: Create `packages/web-kit/src/__tests__/smoke.test.ts`**

```ts
import { PACKAGE_NAME } from '../index';

describe('@things/web-kit', () => {
  it('exports PACKAGE_NAME identifying the package', () => {
    expect(PACKAGE_NAME).toBe('@things/web-kit');
  });
});
```

- [ ] **Step 7: Insert web-kit into root `build:packages`**

In root `package.json`, change the `build:packages` script to add `-w @things/web-kit` immediately after `-w @things/design-system`:

```
"build:packages": "npm run build -w @things/types -w @things/auth -w @things/nest-kit -w @things/ai -w @things/config -w @things/db -w @things/design-system -w @things/web-kit -w @things/buy-sdk -w @things/eat-sdk -w @things/send-sdk -w @things/testing -w @things/do-sdk -w @things/say-sdk",
```

- [ ] **Step 8: Install, build, test, typecheck**

Run:

```bash
npm install
npm run build -w @things/web-kit
npm run test:unit -w @things/web-kit
npm run typecheck -w @things/web-kit
```

Expected: install links the workspace; build emits `dist/index.js`; smoke test PASS; typecheck PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/web-kit package.json package-lock.json
git commit -m "feat(web-kit): scaffold @things/web-kit package

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `apiRequest` fetch helper

**Files:** create `packages/web-kit/src/request.ts`, `packages/web-kit/src/__tests__/request.test.ts`.

- [ ] **Step 1: Write the failing test** — `packages/web-kit/src/__tests__/request.test.ts`:

```ts
import { apiRequest } from '../request';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

beforeEach(() => mockFetch.mockReset());

describe('apiRequest', () => {
  it('resolves parsed JSON and sends credentials + JSON content-type', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ ok: true }));
    const result = await apiRequest<{ ok: boolean }>('http://x/y');
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://x/y');
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(result).toEqual({ ok: true });
  });

  it('merges caller headers over the defaults', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}));
    await apiRequest('http://x/y', { headers: { 'Idempotency-Key': 'abc' } });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('abc');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('throws "<status> <statusText>: <body>" on a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'bad' }, 401));
    await expect(apiRequest('http://x/y')).rejects.toThrow('401 Error: {"error":"bad"}');
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm run test:unit -w @things/web-kit -- request.test`
Expected: FAIL — `Cannot find module '../request'`.

- [ ] **Step 3: Implement `packages/web-kit/src/request.ts`**

```ts
/** Thin fetch wrapper: JSON in/out, cookies included, throws on non-2xx. */
export async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npm run test:unit -w @things/web-kit -- request.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web-kit/src/request.ts packages/web-kit/src/__tests__/request.test.ts
git commit -m "feat(web-kit): apiRequest fetch helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `authApi`

**Files:** create `packages/web-kit/src/auth-api.ts`, `packages/web-kit/src/__tests__/auth-api.test.ts`.

- [ ] **Step 1: Write the failing test** — `packages/web-kit/src/__tests__/auth-api.test.ts`:

```ts
import { authApi } from '../auth-api';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

beforeEach(() => mockFetch.mockReset());

describe('authApi', () => {
  it('signUp POSTs email, password, derived name to /auth/sign-up/email', async () => {
    const user = { id: '1', email: 'a@b.com', name: 'a' };
    mockFetch.mockResolvedValueOnce(makeResponse({ user }));
    const result = await authApi.signUp('a@b.com', 'pass1234');
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/auth/sign-up/email');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'a@b.com',
      password: 'pass1234',
      name: 'a',
    });
    expect(result).toEqual({ user });
  });

  it('signIn POSTs to /auth/sign-in/email', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ user: { id: '2', email: 'b@c.com', name: 'b' } }),
    );
    await authApi.signIn('b@c.com', 'secret12');
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/auth/sign-in/email');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'b@c.com', password: 'secret12' });
  });

  it('signOut POSTs to /auth/sign-out', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(null));
    await authApi.signOut();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/auth/sign-out');
    expect(init.method).toBe('POST');
  });

  it('getSession GETs /auth/get-session', async () => {
    const session = { user: { id: '3', email: 'c@d.com', name: null } };
    mockFetch.mockResolvedValueOnce(makeResponse(session));
    const result = await authApi.getSession();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/auth/get-session');
    expect(init.method).toBeUndefined();
    expect(result).toEqual(session);
  });

  it('throws on a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'bad' }, 401));
    await expect(authApi.signIn('x@y.com', 'wrong123')).rejects.toThrow('401');
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module '../auth-api'`)

Run: `npm run test:unit -w @things/web-kit -- auth-api.test`

- [ ] **Step 3: Implement `packages/web-kit/src/auth-api.ts`**

```ts
import type { User } from '@things/types';
import { apiRequest } from './request';

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL ?? 'http://localhost:3001';

export const authApi = {
  signUp: (email: string, password: string) =>
    apiRequest<{ user: User }>(`${AUTH_URL}/auth/sign-up/email`, {
      method: 'POST',
      body: JSON.stringify({ email, password, name: email.split('@')[0] }),
    }),
  signIn: (email: string, password: string) =>
    apiRequest<{ user: User }>(`${AUTH_URL}/auth/sign-in/email`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  signOut: () => apiRequest<void>(`${AUTH_URL}/auth/sign-out`, { method: 'POST' }),
  getSession: () => apiRequest<{ user: User } | null>(`${AUTH_URL}/auth/get-session`),
};
```

- [ ] **Step 4: Run it — expect PASS** (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web-kit/src/auth-api.ts packages/web-kit/src/__tests__/auth-api.test.ts
git commit -m "feat(web-kit): authApi (signUp/signIn/signOut/getSession)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `useAuth` store

**Files:** create `packages/web-kit/src/auth-store.ts`, `packages/web-kit/src/__tests__/auth-store.test.ts`.

- [ ] **Step 1: Write the failing test** — `packages/web-kit/src/__tests__/auth-store.test.ts`:

```ts
import { useAuth } from '../auth-store';
import { authApi } from '../auth-api';

jest.mock('../auth-api', () => ({
  authApi: {
    getSession: jest.fn(),
    signUp: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

beforeEach(() => {
  useAuth.setState({ user: null, loading: true });
  jest.clearAllMocks();
});

describe('useAuth store', () => {
  it('starts with user: null and loading: true', () => {
    const state = useAuth.getState();
    expect(state.user).toBeNull();
    expect(state.loading).toBe(true);
  });

  it('init() sets user from the session and loading: false', async () => {
    const session = { user: { id: '1', email: 'a@b.com', name: 'a' } };
    mockAuthApi.getSession.mockResolvedValueOnce(session);
    await useAuth.getState().init();
    expect(useAuth.getState().user).toEqual(session.user);
    expect(useAuth.getState().loading).toBe(false);
  });

  it('init() sets user: null when there is no session', async () => {
    mockAuthApi.getSession.mockResolvedValueOnce(null);
    await useAuth.getState().init();
    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().loading).toBe(false);
  });

  it('init() sets user: null and loading: false on error', async () => {
    mockAuthApi.getSession.mockRejectedValueOnce(new Error('network fail'));
    await useAuth.getState().init();
    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().loading).toBe(false);
  });

  it('signUp() calls authApi.signUp and sets user', async () => {
    const user = { id: '2', email: 'new@test.com', name: 'new' };
    mockAuthApi.signUp.mockResolvedValueOnce({ user });
    await useAuth.getState().signUp('new@test.com', 'pass1234');
    expect(mockAuthApi.signUp).toHaveBeenCalledWith('new@test.com', 'pass1234');
    expect(useAuth.getState().user).toEqual(user);
  });

  it('signIn() calls authApi.signIn and sets user', async () => {
    const user = { id: '3', email: 'ex@test.com', name: null };
    mockAuthApi.signIn.mockResolvedValueOnce({ user });
    await useAuth.getState().signIn('ex@test.com', 'secret12');
    expect(mockAuthApi.signIn).toHaveBeenCalledWith('ex@test.com', 'secret12');
    expect(useAuth.getState().user).toEqual(user);
  });

  it('signOut() calls authApi.signOut and clears user', async () => {
    useAuth.setState({ user: { id: '4', email: 'x@y.com', name: null }, loading: false });
    mockAuthApi.signOut.mockResolvedValueOnce(undefined);
    await useAuth.getState().signOut();
    expect(mockAuthApi.signOut).toHaveBeenCalled();
    expect(useAuth.getState().user).toBeNull();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module '../auth-store'`)

Run: `npm run test:unit -w @things/web-kit -- auth-store.test`

- [ ] **Step 3: Implement `packages/web-kit/src/auth-store.ts`**

```ts
import { create } from 'zustand';
import type { User } from '@things/types';
import { authApi } from './auth-api';

interface AuthState {
  user: User | null;
  loading: boolean;
  init: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  init: async () => {
    try {
      const session = await authApi.getSession();
      set({ user: session?.user ?? null, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  signUp: async (email, password) => {
    const { user } = await authApi.signUp(email, password);
    set({ user });
  },
  signIn: async (email, password) => {
    const { user } = await authApi.signIn(email, password);
    set({ user });
  },
  signOut: async () => {
    await authApi.signOut();
    set({ user: null });
  },
}));
```

- [ ] **Step 4: Run it — expect PASS** (7 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web-kit/src/auth-store.ts packages/web-kit/src/__tests__/auth-store.test.ts
git commit -m "feat(web-kit): useAuth Zustand store

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Finalize the barrel + full package gate

**Files:** modify `packages/web-kit/src/index.ts`.

- [ ] **Step 1: Export the public API** — `packages/web-kit/src/index.ts`:

```ts
export const PACKAGE_NAME = '@things/web-kit' as const;

export { apiRequest } from './request';
export { authApi } from './auth-api';
export { useAuth } from './auth-store';
export type { User } from '@things/types';
```

- [ ] **Step 2: Build + typecheck + full unit suite**

Run:

```bash
npm run build -w @things/web-kit
npm run typecheck -w @things/web-kit
npm run lint -w @things/web-kit
npm run test:unit -w @things/web-kit
```

Expected: all PASS — 4 suites (smoke, request, auth-api, auth-store), 16 tests.

- [ ] **Step 3: Commit**

```bash
git add packages/web-kit/src/index.ts
git commit -m "feat(web-kit): export apiRequest, authApi, useAuth, User

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase B — Migrate the 5 apps

## Task 6: Add the `@things/web-kit` dependency + jest mapper to all 5 apps

**Files:** modify `apps/web-{do,say,buy,eat,send}/package.json` and `.../jest.config.ts`.

- [ ] **Step 1: Add the dependency** — in each app's `package.json`, add `"@things/web-kit": "*"` to `dependencies` immediately after `"@things/types": "*"`:

```json
    "@things/types": "*",
    "@things/web-kit": "*",
```

- [ ] **Step 2: Add the jest source mapper** — in each app's `jest.config.ts`, extend `moduleNameMapper` so it maps both design-system and web-kit:

```ts
  moduleNameMapper: {
    '^@things/design-system$': path.resolve(__dirname, '../../packages/design-system/src/index.ts'),
    '^@things/web-kit$': path.resolve(__dirname, '../../packages/web-kit/src/index.ts'),
  },
```

- [ ] **Step 3: Install + sanity check**

Run:

```bash
npm install
node -e "require.resolve('@things/web-kit', { paths: ['apps/web-do'] }) && console.log('ok')"
```

Expected: `npm install` clean; prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add apps/web-do/package.json apps/web-say/package.json apps/web-buy/package.json apps/web-eat/package.json apps/web-send/package.json apps/web-*/jest.config.ts package-lock.json
git commit -m "chore(web): depend on @things/web-kit + jest mapper (5 apps)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Migrate `web-do`

**Files:** rewrite `apps/web-do/lib/api.ts`; delete `apps/web-do/store/auth.store.ts`; delete `apps/web-do/__tests__/auth.store.test.ts`; modify `apps/web-do/__tests__/api.test.ts`; sed-repoint `apps/web-do/app/**` + component tests.

- [ ] **Step 1: Rewrite `apps/web-do/lib/api.ts`** (domain only, on `apiRequest`):

```ts
import { apiRequest } from '@things/web-kit';
import type { Task } from './types';

const DO_URL = process.env.EXPO_PUBLIC_DO_URL ?? 'http://localhost:3002';

export interface TaskUpdate {
  title?: string;
  /** ISO 8601 string to set, null to clear, undefined to leave unchanged. */
  dueAt?: string | null;
  completed?: boolean;
}

export const tasksApi = {
  list: () => apiRequest<Task[]>(`${DO_URL}/tasks`),
  create: (title: string, dueAt?: string) =>
    apiRequest<Task>(`${DO_URL}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title, dueAt }),
    }),
  update: (id: string, partial: TaskUpdate) =>
    apiRequest<Task>(`${DO_URL}/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(partial),
    }),
  remove: (id: string) =>
    apiRequest<{ ok: boolean }>(`${DO_URL}/tasks/${id}`, { method: 'DELETE' }),
};
```

- [ ] **Step 2: Repoint `useAuth` imports (production + component tests)**

Run:

```bash
grep -rlE "(\.\./)+store/auth\.store" apps/web-do --include=*.ts --include=*.tsx \
  | xargs sed -i -E "s#(\.\./)+store/auth\.store#@things/web-kit#g"
```

This rewrites every `from '…/store/auth.store'` and `jest.mock('…/store/auth.store'` to `@things/web-kit`.

- [ ] **Step 3: Delete the local store + its duplicated test**

```bash
git rm apps/web-do/store/auth.store.ts apps/web-do/__tests__/auth.store.test.ts
```

- [ ] **Step 4: Trim `apps/web-do/__tests__/api.test.ts`** — change line 1 to drop `authApi`, and delete the entire `describe('authApi', () => { … });` block (the first describe, ~lines 20–79). Line 1 becomes:

```ts
import { tasksApi } from '../lib/api';
```

Leave the `mockFetch`/`makeResponse`/`beforeEach` scaffold and the `describe('tasksApi', …)` block intact.

- [ ] **Step 5: Verify web-do**

Run:

```bash
grep -rn "store/auth.store" apps/web-do || echo "no stale store refs"
npm run typecheck -w @things/web-do
npm run test:unit -w @things/web-do
```

Expected: no stale refs; typecheck PASS; tests PASS (the `authApi` describe is gone, store/login/today specs now mock `@things/web-kit`).

- [ ] **Step 6: Commit**

```bash
git add apps/web-do
git commit -m "refactor(web-do): use @things/web-kit for auth store + client

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Migrate `web-say`

**Files:** rewrite `apps/web-say/lib/api.ts`; delete `apps/web-say/store/auth.store.ts`; sed-repoint `apps/web-say/app/**`. (web-say has no auth/api/component tests — only `smoke.test.tsx`.)

- [ ] **Step 1: Rewrite `apps/web-say/lib/api.ts`** (keeps `newIdempotencyKey` + the multipart `create`, which uses raw `fetch`):

```ts
import { apiRequest } from '@things/web-kit';
import type { Dictation, Proposal } from './types';

const SAY_URL = process.env.EXPO_PUBLIC_SAY_URL ?? 'http://localhost:3003';

/** Idempotency-Key for mutating /dictations calls; also becomes the new dictation's id on create. */
function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const dictationsApi = {
  list: () => apiRequest<Dictation[]>(`${SAY_URL}/dictations`),

  /**
   * Create a typed dictation. captureMode 'type' skips Whisper transcription;
   * api-say still classifies intent + reshapes the payload via @things/ai, so
   * this requires ANTHROPIC_API_KEY on the server (surfaces as an error here if
   * it is missing). Sent as multipart/form-data to match the FileInterceptor.
   */
  async create(previewTranscript: string): Promise<{ dictation: Dictation; proposal: Proposal }> {
    const form = new FormData();
    form.append('captureMode', 'type');
    form.append('previewTranscript', previewTranscript);
    const res = await fetch(`${SAY_URL}/dictations`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    return res.json() as Promise<{ dictation: Dictation; proposal: Proposal }>;
  },

  dispatch: (id: string) =>
    apiRequest<{ dictation: Dictation; renderedEmail?: string }>(
      `${SAY_URL}/dictations/${id}/dispatch`,
      { method: 'POST', headers: { 'Idempotency-Key': newIdempotencyKey() } },
    ),
  undoDispatch: (id: string) =>
    apiRequest<Dictation>(`${SAY_URL}/dictations/${id}/dispatch`, {
      method: 'DELETE',
      headers: { 'Idempotency-Key': newIdempotencyKey() },
    }),
  remove: (id: string) =>
    apiRequest<{ ok: boolean }>(`${SAY_URL}/dictations/${id}`, { method: 'DELETE' }),
};
```

- [ ] **Step 2: Repoint + delete store**

```bash
grep -rlE "(\.\./)+store/auth\.store" apps/web-say --include=*.ts --include=*.tsx \
  | xargs sed -i -E "s#(\.\./)+store/auth\.store#@things/web-kit#g"
git rm apps/web-say/store/auth.store.ts
```

- [ ] **Step 3: Verify**

```bash
grep -rn "store/auth.store" apps/web-say || echo "clean"
npm run typecheck -w @things/web-say
npm run test:unit -w @things/web-say
```

Expected: clean; PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web-say
git commit -m "refactor(web-say): use @things/web-kit for auth store + client

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Migrate `web-buy`

**Files:** rewrite `apps/web-buy/lib/api.ts`; delete `apps/web-buy/store/auth.store.ts` + `apps/web-buy/__tests__/auth.store.test.ts`; modify `apps/web-buy/__tests__/api.test.ts`; sed-repoint.

- [ ] **Step 1: Rewrite `apps/web-buy/lib/api.ts`**:

```ts
import { apiRequest } from '@things/web-kit';
import type { ShoppingItem } from './types';

const BUY_URL = process.env.EXPO_PUBLIC_BUY_URL ?? 'http://localhost:3004';

export interface ItemUpdate {
  title?: string;
  quantity?: number | null;
  notes?: string | null;
  status?: 'active' | 'bought';
}

export interface ItemCreate {
  title: string;
  quantity?: number | null;
  notes?: string | null;
}

export const itemsApi = {
  list: () => apiRequest<ShoppingItem[]>(`${BUY_URL}/items`),
  create: (data: ItemCreate) =>
    apiRequest<ShoppingItem>(`${BUY_URL}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, partial: ItemUpdate) =>
    apiRequest<ShoppingItem>(`${BUY_URL}/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(partial),
    }),
  remove: (id: string) =>
    apiRequest<{ ok: boolean }>(`${BUY_URL}/items/${id}`, { method: 'DELETE' }),
  sync: () =>
    apiRequest<{ created: number; consumed: number }>(`${BUY_URL}/sync`, { method: 'POST' }),
};
```

- [ ] **Step 2: Repoint + delete store + duplicated test**

```bash
grep -rlE "(\.\./)+store/auth\.store" apps/web-buy --include=*.ts --include=*.tsx \
  | xargs sed -i -E "s#(\.\./)+store/auth\.store#@things/web-kit#g"
git rm apps/web-buy/store/auth.store.ts apps/web-buy/__tests__/auth.store.test.ts
```

- [ ] **Step 3: Trim `apps/web-buy/__tests__/api.test.ts`** — line 1 → `import { itemsApi } from '../lib/api';`; delete the `describe('authApi', () => { … });` block (~lines 20–48). Keep the scaffold + `describe('itemsApi', …)`.

- [ ] **Step 4: Verify**

```bash
grep -rn "store/auth.store" apps/web-buy || echo "clean"
npm run typecheck -w @things/web-buy
npm run test:unit -w @things/web-buy
```

Expected: clean; PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web-buy
git commit -m "refactor(web-buy): use @things/web-kit for auth store + client

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Migrate `web-eat`

**Files:** rewrite `apps/web-eat/lib/api.ts`; delete `apps/web-eat/store/auth.store.ts`; modify `apps/web-eat/__tests__/api.test.ts`; sed-repoint. (No `auth.store.test.ts` in web-eat.)

- [ ] **Step 1: Rewrite `apps/web-eat/lib/api.ts`**:

```ts
import { apiRequest } from '@things/web-kit';
import type { MealItem, MealKind, MealStatus } from './types';

const EAT_URL = process.env.EXPO_PUBLIC_EAT_URL ?? 'http://localhost:3005';

export interface MealCreate {
  name: string;
  kind: MealKind;
  notes?: string | null;
}

export interface MealUpdate {
  name?: string;
  kind?: MealKind;
  notes?: string | null;
  status?: MealStatus;
}

export const mealsApi = {
  list: () => apiRequest<MealItem[]>(`${EAT_URL}/meals`),
  create: (data: MealCreate) =>
    apiRequest<MealItem>(`${EAT_URL}/meals`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, partial: MealUpdate) =>
    apiRequest<MealItem>(`${EAT_URL}/meals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(partial),
    }),
  remove: (id: string) =>
    apiRequest<{ ok: boolean }>(`${EAT_URL}/meals/${id}`, { method: 'DELETE' }),
  sync: () =>
    apiRequest<{ created: number; consumed: number }>(`${EAT_URL}/sync`, { method: 'POST' }),
};
```

- [ ] **Step 2: Repoint + delete store**

```bash
grep -rlE "(\.\./)+store/auth\.store" apps/web-eat --include=*.ts --include=*.tsx \
  | xargs sed -i -E "s#(\.\./)+store/auth\.store#@things/web-kit#g"
git rm apps/web-eat/store/auth.store.ts
```

- [ ] **Step 3: Trim `apps/web-eat/__tests__/api.test.ts`** — line 1 → `import { mealsApi } from '../lib/api';`; delete the `describe('authApi', () => { … });` block (~lines 20–34). Keep the scaffold + `describe('mealsApi', …)`.

- [ ] **Step 4: Verify**

```bash
grep -rn "store/auth.store" apps/web-eat || echo "clean"
npm run typecheck -w @things/web-eat
npm run test:unit -w @things/web-eat
```

- [ ] **Step 5: Commit**

```bash
git add apps/web-eat
git commit -m "refactor(web-eat): use @things/web-kit for auth store + client

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Migrate `web-send`

**Files:** rewrite `apps/web-send/lib/api.ts`; delete `apps/web-send/store/auth.store.ts`; modify `apps/web-send/__tests__/api.test.ts`; sed-repoint. (No `auth.store.test.ts` in web-send.)

- [ ] **Step 1: Rewrite `apps/web-send/lib/api.ts`**:

```ts
import { apiRequest } from '@things/web-kit';
import type { Message, MessageChannel, MessageStatus } from './types';

const SEND_URL = process.env.EXPO_PUBLIC_SEND_URL ?? 'http://localhost:3006';

export interface MessageCreate {
  channel: MessageChannel;
  body: string;
  subject?: string | null;
  recipient?: string | null;
}

export interface MessageUpdate {
  channel?: MessageChannel;
  body?: string;
  subject?: string | null;
  recipient?: string | null;
  status?: MessageStatus;
}

export const messagesApi = {
  list: () => apiRequest<Message[]>(`${SEND_URL}/messages`),
  create: (data: MessageCreate) =>
    apiRequest<Message>(`${SEND_URL}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, partial: MessageUpdate) =>
    apiRequest<Message>(`${SEND_URL}/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(partial),
    }),
  remove: (id: string) =>
    apiRequest<{ ok: boolean }>(`${SEND_URL}/messages/${id}`, { method: 'DELETE' }),
};
```

- [ ] **Step 2: Repoint + delete store**

```bash
grep -rlE "(\.\./)+store/auth\.store" apps/web-send --include=*.ts --include=*.tsx \
  | xargs sed -i -E "s#(\.\./)+store/auth\.store#@things/web-kit#g"
git rm apps/web-send/store/auth.store.ts
```

- [ ] **Step 3: Trim `apps/web-send/__tests__/api.test.ts`** — line 1 → `import { messagesApi } from '../lib/api';`; delete the `describe('authApi', () => { … });` block (~lines 20–34). Keep the scaffold + `describe('messagesApi', …)`.

- [ ] **Step 4: Verify**

```bash
grep -rn "store/auth.store" apps/web-send || echo "clean"
npm run typecheck -w @things/web-send
npm run test:unit -w @things/web-send
```

- [ ] **Step 5: Commit**

```bash
git add apps/web-send
git commit -m "refactor(web-send): use @things/web-kit for auth store + client

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Workspace-wide green gate + PR

**Files:** none (verification + integrate).

- [ ] **Step 1: Confirm full removal of the duplicated store**

```bash
grep -rn "store/auth.store" apps packages --include=*.ts --include=*.tsx | grep -v node_modules || echo "no store/auth.store references anywhere"
ls apps/web-*/store 2>/dev/null || echo "no store dirs remain"
```

Expected: no references; the `store/` dirs are gone (each held only `auth.store.ts`).

- [ ] **Step 2: Run the CI gate**

```bash
npm run build:packages
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration   # API integration needs Docker (testcontainers) → runs in CI; web/pkgs passWithNoTests
```

Expected: build/typecheck/lint/test:unit PASS across all workspaces (web-kit adds 4 suites/16 tests). `test:integration` for the API apps is environment-gated locally (no container runtime); it runs authoritatively in CI and is unaffected by this web-only change.

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin refactor/web-kit-core
gh pr create --base main --title "refactor(web): @things/web-kit core + migrate 5 apps (web-kit PR 2)" \
  --body "PR 2 of the web-app duplication extraction (spec: docs/superpowers/specs/2026-06-12-web-app-dedup-design.md). Adds @things/web-kit (apiRequest, authApi, useAuth) and migrates all 5 web apps onto it, deleting 5 duplicate stores + the duplicated request/authApi blocks and consolidating their tests. Behavior unchanged."
```

---

## Self-review (plan vs. spec PR 2)

- **Spec coverage:** package scaffold + `apiRequest`/`authApi`/`useAuth` (Tasks 1–5); each app deletes `store/auth.store.ts`, trims `lib/api.ts` to domain-only on `apiRequest`, repoints `useAuth` (Tasks 7–11); web-kit dep + jest mapper (Task 6); build-order insertion (Task 1 Step 7); test consolidation per the implementation-notes (delete `auth.store.test.ts`, trim `api.test.ts`, retarget component mocks) — covered.
- **Placeholder scan:** none — full code for every web-kit module/test and every rewritten `lib/api.ts`; exact sed for repoints; exact import-line edits for `api.test.ts`.
- **Naming/type consistency:** `apiRequest` (not `request`) used uniformly in web-kit and all 5 domain APIs; `authApi`/`useAuth` signatures match the originals; `User` sourced from `@things/types`; web-kit peers `react`+`zustand`, deps `@things/types`.
- **Ordering safety:** each app task is atomic (rewrite api + repoint + delete store + fix that app's tests) so the app is green at commit; the duplicated `auth.store.test.ts` is deleted in the same task that deletes the store it imports.
