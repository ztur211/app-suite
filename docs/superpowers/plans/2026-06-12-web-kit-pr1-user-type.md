# Web-kit Extraction — PR 1: `User` → `@things/types` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Declare the `User` identity type exactly once — in `@things/types` — and have all 5 Expo web apps consume it, removing the per-app duplicate interface and the inline `{ id; email; name }` shapes in each `authApi`.

**Architecture:** Pure type relocation, no behavior change. `@things/types` gains a `User` interface; each app re-exports it from its existing `lib/types.ts` (so downstream import paths like `../lib/types` keep working) and replaces the inline shapes in `lib/api.ts` with `User`. The app's own domain types (`Task`, `ShoppingItem`, …) stay put.

**Tech Stack:** TypeScript 5.6 (strict), npm workspaces, Jest 29 (jest-expo for apps). `@things/types` builds with `tsc` and is consumed via its built `dist/*.d.ts`.

**Spec:** `docs/superpowers/specs/2026-06-12-web-app-dedup-design.md` (PR 1 section + "Implementation notes").

---

## Preconditions & TDD note

- Work on branch `refactor/web-app-dedup` (already checked out; the spec + this plan are committed there).
- **Why this PR is typecheck-driven, not jest-red-first:** `User` is a pure type. Babel erases every `import type` / type annotation before Jest resolves modules, so a Jest test cannot be made to _fail_ when `User` is missing — it would trivially pass. The authoritative red/green gate for this PR is therefore `npm run typecheck`, backed by the apps' **existing** unit suites staying green (the refactor changes no runtime behavior). Task 1 ships a small documentation test for the shape; Tasks 3–7 are refactors guarded by each app's existing suite.

## File Structure

| File                                            | Change     | Responsibility                                        |
| ----------------------------------------------- | ---------- | ----------------------------------------------------- |
| `packages/types/src/identity.ts`                | **create** | The shared `User` identity interface                  |
| `packages/types/src/index.ts`                   | modify     | Re-export `./identity` from the package barrel        |
| `packages/types/src/__tests__/identity.test.ts` | **create** | Documentation/shape test for `User`                   |
| `apps/web-{do,say,buy,eat,send}/package.json`   | modify     | Add `@things/types` dependency                        |
| `apps/web-{do,say,buy,eat,send}/lib/types.ts`   | modify     | Delete local `User`; re-export from `@things/types`   |
| `apps/web-{do,say,buy,eat,send}/lib/api.ts`     | modify     | Replace inline `{ id; email; name }` (×3) with `User` |

---

## Task 1: Add `User` to `@things/types`

**Files:**

- Create: `packages/types/src/identity.ts`
- Modify: `packages/types/src/index.ts`
- Create: `packages/types/src/__tests__/identity.test.ts`

- [ ] **Step 1: Write the documentation/shape test**

Create `packages/types/src/__tests__/identity.test.ts`:

```ts
import type { User } from '../identity';

describe('@things/types User', () => {
  it('models an identity row: id, email, and a nullable display name', () => {
    const user: User = { id: 'usr_1', email: 'a@b.com', name: 'Ada' };
    const anonymous: User = { id: 'usr_2', email: 'c@d.com', name: null };

    expect(Object.keys(user).sort()).toEqual(['email', 'id', 'name']);
    expect(anonymous.name).toBeNull();
  });
});
```

- [ ] **Step 2: Create the `User` interface**

Create `packages/types/src/identity.ts`:

```ts
/** A signed-in user as surfaced by Better Auth's session/auth endpoints. */
export interface User {
  id: string;
  email: string;
  name: string | null;
}
```

- [ ] **Step 3: Re-export from the package barrel**

Edit `packages/types/src/index.ts` — add the `./identity` re-export. Final file:

```ts
export const PACKAGE_NAME = '@things/types' as const;

export * from './say-things';
export * from './identity';
```

- [ ] **Step 4: Build the package, then run unit tests + typecheck**

Run:

```bash
npm run build -w @things/types
npm run test:unit -w @things/types
npm run typecheck -w @things/types
```

Expected: build emits `packages/types/dist/identity.d.ts`; `test:unit` PASS (smoke + identity); `typecheck` PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/identity.ts packages/types/src/index.ts packages/types/src/__tests__/identity.test.ts
git commit -m "feat(types): add shared User identity interface

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add the `@things/types` dependency to all 5 apps

**Files:** Modify `apps/web-{do,say,buy,eat,send}/package.json`

- [ ] **Step 1: Add the dependency to each app**

In each app's `package.json`, add `"@things/types": "*"` to `dependencies`, immediately after the existing `"@things/design-system": "*"` line. Example for `apps/web-do/package.json`:

```json
    "@things/design-system": "*",
    "@things/types": "*",
```

Apply the identical addition to `web-say`, `web-buy`, `web-eat`, and `web-send`.

- [ ] **Step 2: Link the workspace dependency**

Run:

```bash
npm install
```

Expected: completes without error; `apps/web-do/node_modules/@things/types` (and the other four) now symlink to `packages/types`.

- [ ] **Step 3: Sanity-check resolution**

Run:

```bash
node -e "require.resolve('@things/types', { paths: ['apps/web-do'] }) && console.log('resolved')"
```

Expected: prints `resolved`.

- [ ] **Step 4: Commit**

```bash
git add apps/web-do/package.json apps/web-say/package.json apps/web-buy/package.json apps/web-eat/package.json apps/web-send/package.json package-lock.json
git commit -m "chore(web): add @things/types dependency to the 5 web apps

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Migrate `web-do` to the shared `User`

**Files:**

- Modify: `apps/web-do/lib/types.ts`
- Modify: `apps/web-do/lib/api.ts`
- Test: `apps/web-do/__tests__/` (existing suite — must stay green)

- [ ] **Step 1: Re-export `User` from `lib/types.ts`**

In `apps/web-do/lib/types.ts`, **delete** this block:

```ts
export interface User {
  id: string;
  email: string;
  name: string | null;
}
```

…and **add** this as the first line of the file:

```ts
export type { User } from '@things/types';
```

(Leave the `Task` interface untouched.)

- [ ] **Step 2: Use `User` in `lib/api.ts`**

In `apps/web-do/lib/api.ts`:

- Change the first import from `import type { Task } from './types';` to `import type { Task, User } from './types';`
- Replace all 3 occurrences of `{ id: string; email: string; name: string | null }` with `User`. The `authApi` block becomes:

```ts
export const authApi = {
  signUp: (email: string, password: string) =>
    request<{ user: User }>(`${AUTH_URL}/auth/sign-up/email`, {
      method: 'POST',
      body: JSON.stringify({ email, password, name: email.split('@')[0] }),
    }),
  signIn: (email: string, password: string) =>
    request<{ user: User }>(`${AUTH_URL}/auth/sign-in/email`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  signOut: () => request<void>(`${AUTH_URL}/auth/sign-out`, { method: 'POST' }),
  getSession: () => request<{ user: User } | null>(`${AUTH_URL}/auth/get-session`),
};
```

- [ ] **Step 2.5: Confirm `User` is no longer declared locally**

Run:

```bash
grep -rn "interface User" apps/web-do
```

Expected: no output (the only `User` now comes from `@things/types`).

- [ ] **Step 3: Run typecheck + the existing unit suite**

Run:

```bash
npm run typecheck -w @things/web-do
npm run test:unit -w @things/web-do
```

Expected: both PASS — no behavior changed; `User` now resolves through `@things/types`.

- [ ] **Step 4: Commit**

```bash
git add apps/web-do/lib/types.ts apps/web-do/lib/api.ts
git commit -m "refactor(web-do): consume User from @things/types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Migrate `web-say` to the shared `User`

**Files:** Modify `apps/web-say/lib/types.ts`, `apps/web-say/lib/api.ts`

- [ ] **Step 1: Re-export `User` from `lib/types.ts`**

In `apps/web-say/lib/types.ts`, delete the `export interface User { id: string; email: string; name: string | null }` block and add `export type { User } from '@things/types';` as the first line. Leave the `Dictation`/`Proposal` types untouched.

- [ ] **Step 2: Use `User` in `lib/api.ts`**

In `apps/web-say/lib/api.ts`: change `import type { Dictation, Proposal } from './types';` to `import type { Dictation, Proposal, User } from './types';`, then replace all 3 occurrences of `{ id: string; email: string; name: string | null }` with `User` (identical `authApi` block as Task 3 Step 2). Leave `newIdempotencyKey` and `dictationsApi` untouched.

- [ ] **Step 3: Verify**

Run:

```bash
grep -rn "interface User" apps/web-say   # expect: no output
npm run typecheck -w @things/web-say
npm run test:unit -w @things/web-say
```

Expected: grep empty; typecheck + tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web-say/lib/types.ts apps/web-say/lib/api.ts
git commit -m "refactor(web-say): consume User from @things/types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Migrate `web-buy` to the shared `User`

**Files:** Modify `apps/web-buy/lib/types.ts`, `apps/web-buy/lib/api.ts`

- [ ] **Step 1: Re-export `User` from `lib/types.ts`**

In `apps/web-buy/lib/types.ts`, delete the `export interface User { id: string; email: string; name: string | null }` block and add `export type { User } from '@things/types';` as the first line. Leave the `ShoppingItem` type untouched.

- [ ] **Step 2: Use `User` in `lib/api.ts`**

In `apps/web-buy/lib/api.ts`: change `import type { ShoppingItem } from './types';` to `import type { ShoppingItem, User } from './types';`, then replace all 3 occurrences of `{ id: string; email: string; name: string | null }` with `User`. Leave `ItemUpdate`/`ItemCreate`/`itemsApi` untouched.

- [ ] **Step 3: Verify**

Run:

```bash
grep -rn "interface User" apps/web-buy   # expect: no output
npm run typecheck -w @things/web-buy
npm run test:unit -w @things/web-buy
```

Expected: grep empty; typecheck + tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web-buy/lib/types.ts apps/web-buy/lib/api.ts
git commit -m "refactor(web-buy): consume User from @things/types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Migrate `web-eat` to the shared `User`

**Files:** Modify `apps/web-eat/lib/types.ts`, `apps/web-eat/lib/api.ts`

- [ ] **Step 1: Re-export `User` from `lib/types.ts`**

In `apps/web-eat/lib/types.ts`, delete the `export interface User { id: string; email: string; name: string | null }` block and add `export type { User } from '@things/types';` as the first line. Leave the `MealItem`/`MealKind`/`MealStatus` types untouched.

- [ ] **Step 2: Use `User` in `lib/api.ts`**

In `apps/web-eat/lib/api.ts`: change `import type { MealItem, MealKind, MealStatus } from './types';` to `import type { MealItem, MealKind, MealStatus, User } from './types';`, then replace all 3 occurrences of `{ id: string; email: string; name: string | null }` with `User`. Leave `MealCreate`/`MealUpdate`/`mealsApi` untouched.

- [ ] **Step 3: Verify**

Run:

```bash
grep -rn "interface User" apps/web-eat   # expect: no output
npm run typecheck -w @things/web-eat
npm run test:unit -w @things/web-eat
```

Expected: grep empty; typecheck + tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web-eat/lib/types.ts apps/web-eat/lib/api.ts
git commit -m "refactor(web-eat): consume User from @things/types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Migrate `web-send` to the shared `User`

**Files:** Modify `apps/web-send/lib/types.ts`, `apps/web-send/lib/api.ts`

- [ ] **Step 1: Re-export `User` from `lib/types.ts`**

In `apps/web-send/lib/types.ts`, delete the `export interface User { id: string; email: string; name: string | null }` block and add `export type { User } from '@things/types';` as the first line. Leave the `Message`/`MessageChannel`/`MessageStatus` types untouched.

- [ ] **Step 2: Use `User` in `lib/api.ts`**

In `apps/web-send/lib/api.ts`: change `import type { Message, MessageChannel, MessageStatus } from './types';` to `import type { Message, MessageChannel, MessageStatus, User } from './types';`, then replace all 3 occurrences of `{ id: string; email: string; name: string | null }` with `User`. Leave `MessageCreate`/`MessageUpdate`/`messagesApi` untouched.

- [ ] **Step 3: Verify**

Run:

```bash
grep -rn "interface User" apps/web-send   # expect: no output
npm run typecheck -w @things/web-send
npm run test:unit -w @things/web-send
```

Expected: grep empty; typecheck + tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web-send/lib/types.ts apps/web-send/lib/api.ts
git commit -m "refactor(web-send): consume User from @things/types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Workspace-wide green gate (matches CI)

**Files:** none (verification only)

- [ ] **Step 1: Confirm `User` is declared exactly once**

Run:

```bash
grep -rn "interface User" packages apps
```

Expected: exactly one hit — `packages/types/src/identity.ts`.

- [ ] **Step 2: Build packages, then run the CI gate across the workspace**

Run:

```bash
npm run build:packages
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
```

Expected: all PASS. (`build:packages` ensures every app resolves `@things/types` from built `dist`; `lint`/`test:*` delegate across all workspaces.)

- [ ] **Step 3: Push the branch and open the PR**

```bash
git push -u origin refactor/web-app-dedup
gh pr create --base main --title "refactor(web): extract User to @things/types (web-kit PR 1)" \
  --body "PR 1 of the web-app duplication extraction (spec: docs/superpowers/specs/2026-06-12-web-app-dedup-design.md). Centralizes the User identity type in @things/types and removes the 5 per-app duplicates + inline shapes. Type-only change; existing suites unchanged. Carries the increment's design spec + PR-1 plan."
```

Expected: PR opens against `main`; CI runs lint + test:unit + test:integration.

---

## Self-review (plan vs. spec PR 1)

- **Spec coverage:** Spec PR 1 asks for `src/identity.ts` + index re-export (Task 1), `@things/types` dep on each app (Task 2), local `User` deleted + re-exported (Tasks 3–7 Step 1), inline shapes → `User` (Tasks 3–7 Step 2), a shape test (Task 1 Step 1), and "all 5 suites green" (Tasks 3–7 Step 3 + Task 8). Covered.
- **Placeholder scan:** none — every edit shows exact before/after text and exact commands.
- **Type/name consistency:** `User` fields `{ id: string; email: string; name: string | null }` are identical in `identity.ts`, the test, and all replacements. The re-export uses `export type { User }` everywhere; the api import adds `User` to the existing `./types` import in every app.
- **Correction vs. spec:** the inline shape appears **3×** per `authApi` (signUp, signIn, getSession — `signOut` is `request<void>`), not "4×" as the spec's intro prose rounds it. The plan uses the verified count of 3.
