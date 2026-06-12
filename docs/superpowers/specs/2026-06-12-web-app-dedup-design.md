# Web-app duplication extraction → `@things/web-kit` — design

> **Status:** 📝 designed (2026-06-12). Not yet implemented.
> **Sub-skill for implementation:** `superpowers:writing-plans` → `superpowers:test-driven-development`.
> **Context:** Increment 3 of the audit-driven cross-app duplication refactor. Increments 1 (`@things/nest-kit` auth guards, PR #8) and 2 (`@things/config` env, PR #9) are merged. This is the "biggest win" flagged in the increment-2 wrap-up.

## Goal

Kill the byte-for-byte duplication across the 5 Expo web apps (`web-do`, `web-say`, `web-buy`, `web-eat`, `web-send`) by extracting the shared auth/identity scaffolding into shared `@things/*` packages — mirroring on the Expo side what `@things/nest-kit` did on the NestJS side.

Three things are duplicated today:

1. **`User` type** `{ id: string; email: string; name: string | null }` — declared independently in every app's `lib/types.ts`, and inlined again (4×) inside each `authApi` return type.
2. **Auth client + store** — the `request<T>` fetch helper, the `authApi` object (signUp / signIn / signOut / getSession), and the `useAuth` Zustand store are **byte-identical** across all 5 apps. (`auth.store.ts` md5 `02722d95…`, 37 lines, identical; the `request`+`authApi` block is identical, after which each app's `lib/api.ts` diverges with its own domain API.)
3. **Login screen** — `app/(auth)/login.tsx` is 111 lines, identical across all 5 apps **except one line**: the `<Heading level={1}>` app title.

## Non-goals

- **Shared build config** (`babel.config.js` / `metro.config.js` / `jest.config.ts` / `tsconfig.json`). Identical today, but sharing them is fiddlier under Expo/Metro (resolver roots, preset merging) for lower payoff. Deferred to an optional later increment.
- **Moving domain types or domain APIs.** `Task`, `Dictation`, `Proposal`, etc. and the per-app domain API objects (`tasksApi`, `dictationsApi`, …) stay app-local. (They arguably belong in the per-app SDK packages, but that is a separate concern.)
- **PrismaLifecycle mixin** — remains skipped (assessed marginal in increment 2).
- **No behavior change.** This is a pure structural extraction; the rendered apps behave identically before and after.

## Decisions (with rejected alternatives)

- **New `@things/web-kit` package**, symmetric to `@things/nest-kit`. Rejected folding the store + network client into `@things/design-system`: that package is purely _presentational_ today (tokens, theme, primitives — no network, no Zustand), and adding fetch calls + app state would muddy its purpose. Rejected `@things/auth`: it must stay framework-free for its SDK consumers and cannot pull React/Zustand.
- **`User` lives in `@things/types`**, not `web-kit`. It is a plain data type already co-located with the other shared DTOs; `web-kit` and the apps both import it from there.
- **Login screen lives in `web-kit`, not `design-system`.** It is a composite, store-wired screen, not a reusable presentational primitive. `design-system` stays presentational.
- **Three small TDD'd PRs, layered** (types → logic → screen) so each lands independently green — matching the "one small PR per increment" cadence of PRs #8/#9. Rejected one big PR (larger diff to verify at once) and core-only (leaves `User` + screen dup in place).
- **`web-kit` reads `EXPO_PUBLIC_AUTH_URL` itself** (same `?? 'http://localhost:3001'` default the apps use today). Safe because Metro inlines `EXPO_PUBLIC_*` per-app at build and every app uses the identical var name — so one shared read resolves correctly in each app's bundle.
- **Naming (provisional, reversible at review):** the exported fetch helper is **`apiRequest`** (clearer than a bare `request` at a package call-site), and the login screen prop is **`appName`** (the product title string, e.g. `"Do Things"`).

---

## The package: `@things/web-kit`

`packages/web-kit/`, `package.json` modeled on `@things/design-system`:

- `"name": "@things/web-kit"`, `private: true`, `main: dist/index.js`, `types: dist/index.d.ts`, `files: ["dist"]`.
- Scripts identical to design-system: `build` (`tsc -p tsconfig.json`), `clean`, `lint`, `test` → `test:unit`, split `test:unit`/`test:integration`/`test:e2e` jest configs, `typecheck`.
- **Dependencies grow across PRs** (see below). Final state:
  - `dependencies`: `@things/types`, `@things/design-system`, `react-hook-form`, `@hookform/resolvers`, `zod`.
  - `peerDependencies`: `react` (`>=18`), `react-native` (`>=0.72`), `zustand`.
  - `devDependencies`: mirror design-system's RN test stack — `@react-native/jest-preset@0.85.3`, `@testing-library/react-native@^13.3.3`, `jest`, `jest-expo`, `ts-jest`, `ts-node`, `react`/`react-native`/`react-test-renderer` pinned to the workspace versions, `@types/*`, `typescript`.
- **Build order:** inserted into root `build:packages` immediately **after** `@things/design-system` (it depends on `types` + `design-system`; `types` already builds first).

### Public API (final)

```ts
// @things/web-kit
export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T>;
export const authApi: {
  signUp(email: string, password: string): Promise<{ user: User }>;
  signIn(email: string, password: string): Promise<{ user: User }>;
  signOut(): Promise<void>;
  getSession(): Promise<{ user: User } | null>;
};
export const useAuth: UseBoundStore<...>;        // Zustand store: { user, loading, init, signUp, signIn, signOut }
export function LoginScreen(props: { appName: string }): JSX.Element;
export type { User } from '@things/types';        // convenience re-export
```

---

## PR 1 — `User` → `@things/types`

**`@things/types`:** add `src/identity.ts` exporting `interface User { id: string; email: string; name: string | null }`; re-export from `src/index.ts`.

**Each of the 5 apps:**

- Add `@things/types: "*"` to `dependencies`.
- `lib/types.ts`: delete the local `User`; `export type { User } from '@things/types'` (keeps existing import paths working) and keep the app's own domain types.
- `lib/api.ts` + `store/auth.store.ts`: the inline `{ id; email; name: string | null }` shapes in `authApi` return types collapse to `User` (imported from `@things/types`).

**TDD:**

- New: a shape/type test in `@things/types` asserting `User`'s fields (guards against drift).
- Green: all 5 apps' existing unit suites unchanged.

**Done when:** `User` is declared exactly once; typecheck + lint + unit green across the workspace.

---

## PR 2 — web-kit core: `apiRequest` + `authApi` + `useAuth`

**Create `@things/web-kit`** (package scaffolding above; at this PR only `@things/types` dep + `zustand` peer are needed — no React, the store/client are React-free at module load).

- `src/request.ts` → `apiRequest<T>` (the existing `request` helper verbatim: `credentials: 'include'`, JSON content-type, header merge, `throw new Error(\`${status} ${statusText}: ${body}\`)` on non-ok).
- `src/auth-api.ts` → `authApi`, reading `const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL ?? 'http://localhost:3001'`.
- `src/auth-store.ts` → `useAuth` (the existing 37-line store verbatim, importing `authApi` from `./auth-api` and `User` from `@things/types`).
- `src/index.ts` → barrel.

**Each of the 5 apps:**

- Add `@things/web-kit: "*"` to `dependencies`.
- **Delete** `store/auth.store.ts`.
- `lib/api.ts`: remove the local `request` + `authApi`; keep the app's service-URL constant(s) and domain API, rewritten to `import { apiRequest } from '@things/web-kit'`. (web-say keeps its local `newIdempotencyKey` helper.)
- Repoint all `useAuth` imports (e.g. in `login.tsx`, layout guards) from `../../store/auth.store` to `@things/web-kit`.

**TDD (new tests in web-kit, fetch mocked):**

- `apiRequest`: resolves JSON on ok; throws `"<status> <statusText>: <body>"` on non-ok; merges caller headers over defaults; sends `credentials: 'include'`.
- `authApi`: each method hits the right URL/method/body (`signUp` includes `name: email.split('@')[0]`; `getSession` GET; `signOut` POST).
- `useAuth`: `init` sets `{ user, loading:false }` from session and `{ user:null, loading:false }` when `getSession` throws; `signIn`/`signUp` set `user`; `signOut` clears it.

**Done when:** `auth.store.ts` and the `request`/`authApi` block exist only in `web-kit`; every app's domain API still compiles against `apiRequest`; web-kit unit suite + all 5 app suites green.

---

## PR 3 — shared `LoginScreen`

**`@things/web-kit`:** add `src/LoginScreen.tsx` — the existing 111-line screen, with line 44 changed from `<Heading level={1}>Do Things</Heading>` to `<Heading level={1}>{appName}</Heading>` and a `{ appName }: { appName: string }` prop. It imports `useAuth` from `./auth-store` (same package) and primitives from `@things/design-system`. Add to barrel.

- web-kit gains `dependencies`: `@things/design-system`, `react-hook-form`, `@hookform/resolvers`, `zod`; `peerDependencies`: `react`, `react-native`. **No `expo-router`** — the screen performs no navigation; post-auth redirects are handled by the apps' existing layout guards watching `useAuth().user`.

**Each of the 5 apps:** `app/(auth)/login.tsx` collapses to:

```tsx
import { LoginScreen } from '@things/web-kit';
export default function Login() {
  return <LoginScreen appName="Do Things" />; // per-app title
}
```

**TDD (new test in web-kit, `@testing-library/react-native`):**

- Renders the provided `appName` as the `level={1}` heading.
- Toggles sign-in ⇄ sign-up via the footer pressable (button label changes).
- Submitting valid credentials invokes the store's `signIn`/`signUp` (mocked).
- A thrown auth error surfaces in `testID="login-submit-error"`.

**Done when:** every app's `login.tsx` is the ~4-line wrapper; only the title differs (now via prop); web-kit screen test + all 5 app suites green.

---

## Risks / watch-items

- **`EXPO_PUBLIC_AUTH_URL` inlining** — verified safe (shared var name, per-app inline). If any app ever needs a different auth origin, `authApi` would need parameterizing; not the case today.
- **RN single-copy deps** — `react`/`react-native`/`zustand` are `peerDependencies` (not bundled) to avoid duplicate-copy hazards; the apps already provide them.
- **Jest/RN preset parity** — web-kit must carry the same `@react-native/jest-preset@0.85.3` + `@testing-library/react-native@^13.3.3` pinning the apps use (RN 0.85 compat note in CLAUDE.md), or the `LoginScreen` test won't run.
- **Import-path churn** — repointing `useAuth` imports touches `login.tsx` and any layout guard; a repo-wide grep for `store/auth.store` confirms the full set before each app is migrated.

---

## Implementation notes (discovered during planning, 2026-06-12)

These refine the per-PR TDD sections above; they were found by reading the actual test files and jest configs.

- **Module resolution is split.** App jest configs resolve `@things/*` to **source** via `moduleNameMapper` (e.g. web-do maps `^@things/design-system$` → `../../packages/design-system/src/index.ts`) and allow-list `@things` in `transformIgnorePatterns`. So each migrated app's `jest.config.ts` must gain a `^@things/web-kit$` → `../../packages/web-kit/src/index.ts` mapper (PR 2). `typecheck` (tsc), by contrast, resolves `@things/*` from built `dist/*.d.ts`, so `build:packages` must build `web-kit` (inserted after `design-system`) before any app/pkg `typecheck`.
- **`User` is type-only, so PR 1 is typecheck-driven.** Every `User` usage is `import type` / a type annotation, which Babel erases — a jest runtime test cannot fail when `User` is missing. PR 1's red/green is therefore `npm run typecheck` (+ existing app suites stay green unchanged). The `identity.test.ts` is a compile-checked usage that documents the shape; it is not a behavioral test.
- **Duplicated _tests_ consolidate too, not just source.** The apps already test the moving code: `auth.store.test.ts` (web-do, web-buy), the `authApi` half of `api.test.ts` (web-do, web-buy, web-eat, web-send), and `login.test.tsx` (those four). PR 2/PR 3 move this coverage into `web-kit` (once) and **delete** the per-app copies; each app's `api.test.ts` keeps only its domain-API tests (`tasksApi`/`itemsApi`/…). web-say has only `smoke.test.tsx` (no auth/login tests) — nothing to delete there.
- **Component-test mocks retarget.** Tests that `jest.mock('../store/auth.store', …)` (e.g. `today.test.tsx`, `login.test.tsx`) must switch to `jest.mock('@things/web-kit', …)` once the component imports `useAuth` from the package (PR 2/PR 3). Mocks of `../lib/api` for a _domain_ API (`tasksApi`, `itemsApi`) stay as-is.
- **`npm install` after manifest edits.** Adding `@things/types`/`@things/web-kit` to an app's `dependencies` requires a root `npm install` to create the workspace symlink before typecheck/build resolves it.
- **Per-PR plans.** Each PR is planned and executed as its own bite-sized plan under `docs/superpowers/plans/` (matching the "three small PRs" decision); this spec is the shared high-level reference for all three.
