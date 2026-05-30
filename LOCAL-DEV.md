# Running the Things suite locally

This is the ordered path to a working local install you can click through in a
browser. It brings up Postgres, runs migrations, starts the APIs, and serves a
web app. Sign-up/login runs against `api-auth`; every other app validates the
session cookie locally against the shared `things_auth` database.

## Prerequisites

- Node ≥ 20, npm ≥ 10
- Docker (for Postgres) — Redis and MailHog from the dev compose are **not**
  required for the basic click-through.
- `npm install` at the repo root (installs all workspaces).

## 1. Start Postgres

```bash
npm run dev:db
# = docker compose -f infra/docker-compose.dev.yml up -d postgres
```

On the **first** boot of a fresh volume, `infra/postgres/init.sql` creates the
per-app databases (`things_auth`, `things_do`, `things_say`, `things_buy`,
`things_eat`, `things_send`) and their owner roles plus the read-only
`auth_reader`. If you ever change `init.sql`, tear the volume down first:

```bash
docker compose -f infra/docker-compose.dev.yml down -v
```

## 2. Environment files

Each API reads its own `apps/api-*/.env` at boot (loaded via `dotenv`). The
files are gitignored. `api-auth`, `api-do`, and `api-say` already have one;
create the other three from their examples:

```bash
cp apps/api-buy/.env.example  apps/api-buy/.env
cp apps/api-eat/.env.example  apps/api-eat/.env
cp apps/api-send/.env.example apps/api-send/.env
```

Then set, in **all** of them, the two shared secrets to the **exact same**
values used by `apps/api-auth/.env` — sessions only validate when the secret
matches the one that minted the cookie:

- `BETTER_AUTH_SECRET`
- `SERVICE_TOKEN_SECRET`

The dev values already in `apps/api-auth/.env` are fine to copy verbatim.

## 3. Run migrations (auth first)

```bash
npm run db:migrate:all
```

This runs `prisma migrate deploy` for `api-auth` first (creates `User`,
`Session`, `Account`, `Verification` in `things_auth`), then each domain app's
own database. The order matters: the domain apps read the auth tables through
`auth_reader`.

## 4. Start the APIs

All six at once (prefixed, color-coded output; Ctrl-C stops all):

```bash
npm run dev:api
```

…or just the ones you need:

```bash
npm run dev -w apps/api-auth   # :3001 — required for login
npm run dev -w apps/api-do     # :3002
```

## 5. Start a web app

```bash
npm run dev -w apps/web-do     # opens http://localhost:8081
```

Each Expo web app wants port **8081**; a second one will offer **8082**, and so
on. The APIs trust web origins on `localhost:8081`–`8085`, so you can run up to
five side by side.

## 6. Sign up and click through

1. Open the web app (e.g. http://localhost:8081).
2. Toggle to **Sign up**, enter an email and an 8+ character password.
   You're signed in automatically and the session cookie is set.
3. Create tasks / items / meals / messages by hand — there is **no seed data**;
   every account starts empty.

## Ports

| Service  | Port | Notes                                        |
| -------- | ---- | -------------------------------------------- |
| api-auth | 3001 | login/signup/session — required by every app |
| api-do   | 3002 |                                              |
| api-say  | 3003 |                                              |
| api-buy  | 3004 |                                              |
| api-eat  | 3005 |                                              |
| api-send | 3006 |                                              |
| web-\*   | 8081 | Expo dev server; bumps to 8082+ if taken     |
| Postgres | 5432 |                                              |

## Known gaps when testing

- **Say Things capture** (`web-say`): creating a dictation runs intent
  classification + reshaping through `@things/ai`, which needs a real
  `ANTHROPIC_API_KEY` (and network egress) in `apps/api-say/.env`. Without it,
  login and the (empty) library list work, but creating a dictation returns an
  error. Voice modes (`tap`/`drive`) additionally need `OPENAI_API_KEY` for
  Whisper. Login and browsing work offline.
- **No seed data** — accounts start empty everywhere.
