# Deploying the Things web apps to Vercel

The five Expo + RN-Web apps (`web-do`, `web-say`, `web-buy`, `web-eat`,
`web-send`) are hosted on **Vercel** (static `expo export -p web` output on
Vercel's CDN). The six NestJS APIs are **not** on Vercel — they run as Docker
containers on a VPS behind Caddy (see `infra/README.md`).

Design: `docs/superpowers/specs/2026-06-15-vercel-web-deploy-design.md`.

> Web ↔ API is **cross-site** (`*.vercel.app` ≠ `*.things.app`), so auth is
> **Bearer-token** based, not cookies. The API side must allow the Vercel
> origins — see [§3](#3-point-the-apis-at-vercel-web_origins).

---

## 1. One Vercel project per web app

Create five projects from the **same** Git repo. Each is configured by its
committed `apps/web-<app>/vercel.json`; the only per-project **dashboard**
settings are the Root Directory and the environment variables.

| Project name  | Root Directory  | Output (from vercel.json) |
| ------------- | --------------- | ------------------------- |
| `things-do`   | `apps/web-do`   | `dist`                    |
| `things-say`  | `apps/web-say`  | `dist`                    |
| `things-buy`  | `apps/web-buy`  | `dist`                    |
| `things-eat`  | `apps/web-eat`  | `dist`                    |
| `things-send` | `apps/web-send` | `dist`                    |

**Set the Root Directory** to the app subdir in _Project → Settings → General →
Root Directory_. Build Command, Output Directory, Install Command, SPA rewrite,
and asset-cache headers all come from the checked-in `vercel.json` — leave those
on "Override: off" so the file wins.

The build (`scripts/vercel-build.sh`) builds the shared `@things/*` packages in
dependency order, then `expo export -p web` for that app — the same order as
`infra/docker/web.Dockerfile`.

## 2. Per-project environment variables

`EXPO_PUBLIC_*` values are **inlined into the JS bundle at build time** (they
cannot change at runtime), so set them as Vercel **Environment Variables**
(Production + Preview) before the first deploy. `$D` = your real API domain
(e.g. `things.app`).

| Project       | Environment variables                                                               |
| ------------- | ----------------------------------------------------------------------------------- |
| `things-do`   | `EXPO_PUBLIC_AUTH_URL=https://auth.$D` · `EXPO_PUBLIC_DO_URL=https://api.do.$D`     |
| `things-say`  | `EXPO_PUBLIC_AUTH_URL=https://auth.$D` · `EXPO_PUBLIC_SAY_URL=https://api.say.$D`   |
| `things-buy`  | `EXPO_PUBLIC_AUTH_URL=https://auth.$D` · `EXPO_PUBLIC_BUY_URL=https://api.buy.$D`   |
| `things-eat`  | `EXPO_PUBLIC_AUTH_URL=https://auth.$D` · `EXPO_PUBLIC_EAT_URL=https://api.eat.$D`   |
| `things-send` | `EXPO_PUBLIC_AUTH_URL=https://auth.$D` · `EXPO_PUBLIC_SEND_URL=https://api.send.$D` |

After changing a build-time env var you must **redeploy** for it to take effect.

## 3. Point the APIs at Vercel (`WEB_ORIGINS`)

The APIs allow browser origins via `trustedWebOrigins()`
(`packages/auth/src/origins.ts`), which feeds both CORS and Better Auth
`trustedOrigins`. Add the deployed Vercel URLs to **`WEB_ORIGINS`** (comma-
separated) in `infra/.env` on the VPS, then restart the API stack:

```dotenv
WEB_ORIGINS=https://things-do.vercel.app,https://things-say.vercel.app,https://things-buy.vercel.app,https://things-eat.vercel.app,https://things-send.vercel.app
```

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env up -d
```

Use the **production** `*.vercel.app` hostnames (or your custom domains if you
add them). **Preview deploys** get per-deploy hostnames that aren't in this list,
so login won't work from a preview URL against the production API — that's
intentional (see the design's §B3). The static UI still loads on previews.

## 4. Linking the repo (one-time, manual)

This step needs your Vercel credentials and can't be done from the repo. Either:

**Dashboard:** New Project → import the Git repo → set Root Directory (table in
§1) → add env vars (§2) → Deploy. Repeat for all five.

**CLI:**

```bash
npm i -g vercel
cd apps/web-do && vercel link          # pick/create the "things-do" project
vercel env add EXPO_PUBLIC_AUTH_URL production    # repeat per var (§2)
vercel --prod                          # first production deploy
# repeat in apps/web-say, web-buy, web-eat, web-send
```

After linking, Vercel's Git integration auto-deploys: **Production** on push to
`main`, **Preview** per pull request. No GitHub Action is needed for the web
apps (the API workflow in `.github/workflows/deploy.yml` is separate).

## 5. Verifying a deploy

1. Open `https://things-do.vercel.app` — the app loads, deep links + cached
   assets work.
2. Sign up, then sign in. In DevTools → Network, the sign-in response carries a
   `set-auth-token` header and later API calls send `Authorization: Bearer …`.
3. Confirm it works in **Safari** as well as Chrome — that proves auth doesn't
   secretly depend on (now-blocked) third-party cookies.
