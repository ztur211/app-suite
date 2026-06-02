# Things

The **Things** suite — productivity apps that share a brand, design system, identity, and AI layer.

See `docs/superpowers/specs/2026-05-20-things-suite-foundation-design.md` for the architectural foundation.

## Quick start

```bash
npm install
npm run lint
npm run test:unit
npm run build
```

To bring the whole suite up locally and click through it in a browser, see
[`LOCAL-DEV.md`](./LOCAL-DEV.md).

## Workspaces

- `apps/api-auth` — auth service (Better Auth login/signup/reset pages)
- `apps/api-do`, `apps/api-say`, `apps/api-buy`, `apps/api-eat`, `apps/api-send` — per-app NestJS APIs
- `apps/web-do`, `apps/web-say`, `apps/web-buy`, `apps/web-eat`, `apps/web-send` — per-app Expo + RN Web clients (web/iOS/Android)
- `packages/design-system` — `@things/design-system` (tokens, primitives, theme)
- `packages/ai` — `@things/ai` (provider-agnostic AI client + router)
- `packages/auth` — `@things/auth` (Better Auth shared config + session helpers)
- `packages/db` — `@things/db` (Prisma helpers)
- `packages/types` — `@things/types` (shared DTOs and enums)
- `packages/config` — `@things/config` (env schema + ConfigService factory)
- `packages/testing` — `@things/testing` (Jest setup, factories, testcontainers)
- `packages/{do,say,buy,eat,send}-sdk` — typed HTTP clients for each app

## Running a single workspace

```bash
npm run dev -w apps/api-auth
npm run test:unit -w packages/design-system
```

## Conventions

- TDD: every feature starts with a failing test
- No raw color/spacing/easing literals in app code — use tokens from `@things/design-system`
- No direct provider SDK imports (`@anthropic-ai/sdk`, `openai`, `@google/generative-ai`) outside `packages/ai/src/providers/`
- See `CLAUDE.md` for AI-assistant instructions
