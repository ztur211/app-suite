# Things Suite — Claude Code Instructions

## Read this first, every session, before writing a single line of code.

---

## What is the Things suite

Five productivity apps that share a brand, a design system, an identity, and an AI layer:

- **Do Things** — todo + calendar
- **Say Things** — voice transcription with intent-aware reshaping
- **Buy Things** — AI shopping finder
- **Eat Things** — restaurants + recipes unified
- **Send Things** — Email + Slack + Discord + Telegram unified inbox

Naming rule: single-syllable verb + "Things."

The foundation spec is at `../project-ideas/docs/superpowers/specs/2026-05-20-things-suite-foundation-design.md` (outside this repo). Read it before making architectural decisions.

---

## Repository Layout

```
things/
  apps/
    api-auth/                   NestJS — login/signup/reset/verify pages (auth.things.app)
    api-do/                     NestJS — Do Things API (port 3002)
    api-say/                    NestJS — Say Things API (port 3003)
    api-buy/                    NestJS (port 3004)
    api-eat/                    NestJS (port 3005)
    api-send/                   NestJS (port 3006)
    web-do/                     Expo + RN Web — Do Things (web/iOS/Android)
    web-say/                    Expo + RN Web — Say Things
    web-buy/                    Expo + RN Web
    web-eat/                    Expo + RN Web
    web-send/                   Expo + RN Web
  packages/
    design-system/              @things/design-system   tokens + primitives + theme
    ai/                         @things/ai              provider-agnostic AI client + router
    auth/                       @things/auth            Better Auth shared config + session helpers
    db/                         @things/db              Prisma helpers
    types/                      @things/types           shared DTOs + enums
    config/                     @things/config          env schema + ConfigService factory
    testing/                    @things/testing         Jest setup + factories + testcontainers
    do-sdk/                     @things/do-sdk          typed HTTP client for api-do
    say-sdk/                    @things/say-sdk
    buy-sdk/                    @things/buy-sdk
    eat-sdk/                    @things/eat-sdk
    send-sdk/                   @things/send-sdk
  infra/                        Docker Compose, Caddyfile, deploy scripts        (P5)
  docs/                         Specs, plans, ADRs
  .github/workflows/            CI: pull-request.yml, deploy.yml                  (deploy P5)
```

---

## Tech Stack — Do Not Substitute

| Concern      | Choice                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| Monorepo     | npm workspaces                                                                                            |
| Language     | TypeScript 5.6+, strict                                                                                   |
| Backend      | NestJS 11, Prisma 5, Postgres                                                                             |
| Web + mobile | Expo 55, Expo Router 55, React Native 0.85, React 19, React Native Web 0.21                               |
| Styling      | NativeWind 4 (Tailwind for RN)                                                                            |
| State        | Zustand                                                                                                   |
| Forms        | react-hook-form + Zod                                                                                     |
| Auth         | Better Auth                                                                                               |
| Realtime     | Socket.io + Redis adapter                                                                                 |
| AI           | `@anthropic-ai/sdk` + `openai` + `@google/generative-ai` — but only inside `packages/ai/src/providers/`   |
| Tests        | Jest 29 split into unit/integration/e2e configs per workspace; Playwright (web E2E); Maestro (mobile E2E) |
| Logging      | Pino                                                                                                      |
| Deploy       | Single VPS + Docker Compose + Caddy (P5)                                                                  |

---

## TDD Discipline — Non-Negotiable

1. **Every feature starts with a failing test.** No exceptions.
2. **Run the failing test before implementing.** Confirm it fails for the right reason.
3. **Implement the minimum to pass.**
4. **Run the test. Confirm it passes.**
5. **Commit.**

CI runs `lint`, `test:unit`, `test:integration` on every PR. `test:e2e` runs on PRs to `main`.

---

## Hard Rules

1. **No raw color/spacing/easing literals in app code.** Use tokens from `@things/design-system`.
2. **No direct provider SDK imports** (`@anthropic-ai/sdk`, `openai`, `@google/generative-ai`) outside `packages/ai/src/providers/`.
3. **No cross-app DB writes.** Each app owns its DB; cross-app integration uses the target app's SDK package.
4. **Service-to-service calls always use signed JWTs** via `@things/auth/service-jwt`.
5. **Mirror nodescope's stack choices.** If you need to substitute a tool, surface it explicitly in a PR description.

---

## Known notes from P1

- The first 4 commits in history include two pairs of `scratch-test.ts` add/remove from Husky pre-commit verification. These are intentional verification artifacts, not bugs.
- `lint` script at root is `eslint . && npm run lint --workspaces --if-present`. The first part lints root files; the second delegates to workspaces.
- ESLint ignores use scoped `apps/**/*.config.*` and `packages/**/*.config.*` patterns (not unscoped `**/*.config.*`, which would catch `eslint.config.mjs` itself).
- All web-\* apps use `@testing-library/react-native@^13.3.3` (not 12.x — incompatible with RN 0.85) and include `@react-native/jest-preset@0.85.3` in devDeps.
- All packages and apps include `ts-node` in devDeps so Jest can load TypeScript config files.

---

## Where to find things

- Foundation spec: `../project-ideas/docs/superpowers/specs/2026-05-20-things-suite-foundation-design.md`
- P1 implementation plan: `../project-ideas/docs/superpowers/plans/2026-05-20-things-suite-p1-monorepo-bootstrap.md`
- Per-app brainstorms (one per app): `../project-ideas/docs/superpowers/specs/YYYY-MM-DD-<app>-design.md` (forthcoming)
