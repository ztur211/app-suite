#!/bin/sh
# Production Postgres bootstrap — runs once, on first container start, via
# /docker-entrypoint-initdb.d. Mirrors infra/postgres/init.sql (dev) and
# packages/testing's setupSuitePostgres(), but takes role passwords from the
# environment instead of hardcoding them (foundation spec §3.5).
#
# Creates one database per app, each owned by a dedicated login role, plus a
# read-only auth_reader role that can SELECT from things_auth for cross-app
# session validation. ALTER DEFAULT PRIVILEGES means any table api-auth's
# `migrate deploy` later creates is auto-granted to auth_reader.
set -eu

: "${AUTH_OWNER_PASSWORD:?}"
: "${DO_OWNER_PASSWORD:?}"
: "${SAY_OWNER_PASSWORD:?}"
: "${BUY_OWNER_PASSWORD:?}"
: "${EAT_OWNER_PASSWORD:?}"
: "${SEND_OWNER_PASSWORD:?}"
: "${AUTH_READER_PASSWORD:?}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
	CREATE ROLE auth_owner WITH LOGIN PASSWORD '${AUTH_OWNER_PASSWORD}';
	CREATE DATABASE things_auth OWNER auth_owner;

	CREATE ROLE do_owner   WITH LOGIN PASSWORD '${DO_OWNER_PASSWORD}';
	CREATE DATABASE things_do   OWNER do_owner;

	CREATE ROLE say_owner  WITH LOGIN PASSWORD '${SAY_OWNER_PASSWORD}';
	CREATE DATABASE things_say  OWNER say_owner;

	CREATE ROLE buy_owner  WITH LOGIN PASSWORD '${BUY_OWNER_PASSWORD}';
	CREATE DATABASE things_buy  OWNER buy_owner;

	CREATE ROLE eat_owner  WITH LOGIN PASSWORD '${EAT_OWNER_PASSWORD}';
	CREATE DATABASE things_eat  OWNER eat_owner;

	CREATE ROLE send_owner WITH LOGIN PASSWORD '${SEND_OWNER_PASSWORD}';
	CREATE DATABASE things_send OWNER send_owner;

	CREATE ROLE auth_reader WITH LOGIN PASSWORD '${AUTH_READER_PASSWORD}';
	GRANT CONNECT ON DATABASE things_auth TO auth_reader;
EOSQL

# Schema-level grants must run inside things_auth.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname things_auth <<-EOSQL
	GRANT USAGE ON SCHEMA public TO auth_reader;
	ALTER DEFAULT PRIVILEGES FOR ROLE auth_owner IN SCHEMA public
	  GRANT SELECT ON TABLES TO auth_reader;
EOSQL

echo "[init-prod] per-app databases, owner roles, and auth_reader provisioned."
