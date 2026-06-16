# Things suite — infrastructure (P5)

Single-VPS production stack: Caddy (auto-TLS reverse proxy) in front of six
NestJS APIs, backed by one Postgres instance (six databases) and Redis.
Foundation spec §6.

> **Web apps run on Vercel.** The five Expo web apps are deployed to Vercel
> (static `expo export -p web` on its CDN), **not** the VPS — see
> [`VERCEL.md`](./VERCEL.md) and
> `docs/superpowers/specs/2026-06-15-vercel-web-deploy-design.md`. The `web-*`
> Docker services / `web.Dockerfile` / Caddy `<app>.<domain>` routes below are
> kept for the **local full-stack** bring-up only. Because web ↔ API is then
> cross-site, auth is **Bearer-token** based (the APIs need the Vercel origins in
> `WEB_ORIGINS`).

```
infra/
  docker-compose.dev.yml     local dev: postgres + redis + mailhog
  docker-compose.prod.yml    caddy + 6 api + postgres + redis (+ 5 web for local full-stack)
  docker-compose.local.yml   local single-machine overlay: local images + internal CA
  Caddyfile                  reverse-proxy routing + TLS for every subdomain
  .env.example               production env/secrets template (copy to infra/.env)
  docker/
    api.Dockerfile           shared multi-stage build for any api-* app (ARG APP)
    web.Dockerfile           shared multi-stage build for any web-* app (ARG APP)
    api-entrypoint.sh        migrate deploy → node dist/main
    web-nginx.conf           static file serving + SPA fallback + /healthz
  postgres/
    init.sql                 dev role/DB topology (hardcoded passwords)
    init-prod.sh             prod role/DB topology (passwords from env)
  backup/
    backup.sh                nightly pg_dump + GFS retention + rclone sync
    restore.sh               restore one DB from a dump
    README.md                retention policy + restore drill
```

Service-to-service calls use internal docker DNS (`http://api-do:3002`); only
Caddy is published (80/443). Images would be built + pushed to GHCR by
`.github/workflows/deploy.yml`, but that workflow is `workflow_dispatch`-only now
(deploy is local — see below), so local builds use `scripts/build-local.sh`.

> **Current reality:** the live deploy is the **local single-machine** path below
> (`scripts/bring-up-local.sh`); the cloud VPS sections are kept for a future remote host.

## First-time VPS bring-up

1. Provision a VPS (Hetzner CX22 recommended), install Docker + compose plugin.
2. Point DNS: `auth`, `api.<app>`, and `<app>` subdomains → the VPS IP. (For a
   single wildcard cert instead, build Caddy with a DNS plugin — see the note
   atop `Caddyfile`.)
3. Clone to `/opt/things`, then:
   ```sh
   cp infra/.env.example infra/.env && chmod 600 infra/.env   # fill in secrets
   docker login ghcr.io                                        # to pull images
   scripts/deploy.sh                                           # pull + up the stack
   ```
4. Add the backup cron (see `backup/README.md`) and run the restore drill once.

## Local single-machine deploy (no cloud)

Run the whole stack on one Linux box, reachable in a browser on that machine.

**Fastest path — one command:** `scripts/bring-up-local.sh` does everything
below (generates `infra/.env` with local defaults + fresh secrets, adds the
`/etc/hosts` entries via sudo, builds any missing images, starts the stack, and
trusts Caddy's local CA), then drops you into a `things` tmux session with live
logs + a health watch. Re-run it any time; `scripts/bring-up-local.sh --down`
tears it back down (DB volumes kept). The numbered steps below are the manual
equivalent.

1. `/etc/hosts`:
   `127.0.0.1  auth.things.test api.do.things.test api.say.things.test api.buy.things.test api.eat.things.test api.send.things.test do.things.test say.things.test buy.things.test eat.things.test send.things.test`
2. `cp infra/.env.example infra/.env && chmod 600 infra/.env`; set `THINGS_DOMAIN=things.test`,
   `AUTH_COOKIE_DOMAIN=.things.test`, `CADDY_EXTRA_GLOBAL=local_certs`, and generate the
   passwords/secrets (`openssl rand -hex 32` — hex, not base64: these values land in
   `postgresql://…` URLs where base64's `+`/`/` would corrupt them). `OPENAI_/ANTHROPIC_KEY` are optional.
3. `scripts/build-local.sh`
4. `docker compose -f infra/docker-compose.prod.yml -f infra/docker-compose.local.yml --env-file infra/.env up -d`
5. Trust Caddy's local CA: `docker compose ... cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-local-ca.crt`,
   then add it to your browser/system trust store. Open `https://do.things.test`.

## Deploys

Deploy is **local single-machine** today (above); the cloud VPS path is dormant.
`.github/workflows/deploy.yml` (build → GHCR → SSH → `compose up` → smoke) is
**`workflow_dispatch`-only** — it does not run on push, since its SSH step targets
a VPS that doesn't currently exist. Trigger it manually once a remote target is
back. Manual / rollback on a VPS:

```sh
scripts/deploy.sh                  # whole stack, latest
scripts/deploy.sh api-do           # one service
TAG=<git-sha> scripts/deploy.sh    # pin a previous image (rollback)
```

## Known follow-ups (not blocking deploy)

- **Wildcard TLS via DNS-01** once the registrar/DNS provider is chosen
  (spec §12) — needs an xcaddy build with the provider plugin.
- **Redis usage**: provisioned for the Socket.io adapter / caching; not yet
  consumed by app code.
- **APIs-only VPS + Caddy web routes**: on a real APIs-only VPS, the `<app>.<domain>`
  site blocks in `Caddyfile` would make Caddy attempt ACME certs for the web
  subdomains — which now resolve to Vercel, so the challenge fails. Before that
  deploy, remove those five web blocks from the prod `Caddyfile` (or split them
  into a local-only Caddyfile) so the VPS only serves `auth.` + `api.*.`. The
  `deploy.yml` SSH step already brings up API services only.
