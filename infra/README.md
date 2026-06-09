# Things suite — infrastructure (P5)

Single-VPS production stack: Caddy (auto-TLS reverse proxy) in front of six
NestJS APIs + five Expo static web builds, backed by one Postgres instance
(six databases) and Redis. Foundation spec §6.

```
infra/
  docker-compose.dev.yml     local dev: postgres + redis + mailhog
  docker-compose.prod.yml    production: caddy + 6 api + 5 web + postgres + redis
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

Build images are produced by `.github/workflows/deploy.yml` on merge to `main`
and pushed to GHCR. Service-to-service calls use internal docker DNS
(`http://api-do:3002`); only Caddy is published (80/443).

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

1. `/etc/hosts`:
   `127.0.0.1  auth.things.test api.do.things.test api.say.things.test api.buy.things.test api.eat.things.test api.send.things.test do.things.test say.things.test buy.things.test eat.things.test send.things.test`
2. `cp infra/.env.example infra/.env && chmod 600 infra/.env`; set `THINGS_DOMAIN=things.test`,
   `AUTH_COOKIE_DOMAIN=.things.test`, `CADDY_EXTRA_GLOBAL=local_certs`, and generate the
   passwords/secrets (`openssl rand -base64 36`). `OPENAI_/ANTHROPIC_KEY` are optional.
3. `scripts/build-local.sh`
4. `docker compose -f infra/docker-compose.prod.yml -f infra/docker-compose.local.yml --env-file infra/.env up -d`
5. Trust Caddy's local CA: `docker compose ... cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-local-ca.crt`,
   then add it to your browser/system trust store. Open `https://do.things.test`.

## Deploys

Automatic on merge to `main` (build → GHCR → SSH → `compose up` → smoke). Manual
/ rollback on the VPS:

```sh
scripts/deploy.sh                  # whole stack, latest
scripts/deploy.sh api-do           # one service
TAG=<git-sha> scripts/deploy.sh    # pin a previous image (rollback)
```

## Known follow-ups (not blocking deploy)

- **Wildcard TLS via DNS-01** once the registrar/DNS provider is chosen
  (spec §12) — needs an xcaddy build with the provider plugin.
- **Cross-subdomain session cookies**: Better Auth must set the cookie on the
  parent `.things.app` domain (spec §3.3) and trust the prod web origins. The
  per-app `auth.ts` currently hardcodes `localhost:8081` as a trusted origin;
  prod origins + `crossSubDomainCookies` need wiring in app code.
- **Redis usage**: provisioned for the Socket.io adapter / caching; not yet
  consumed by app code.
