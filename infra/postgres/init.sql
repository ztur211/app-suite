-- Provisions the per-app DB+role topology documented in foundation spec §3.5
-- and matched by packages/testing/src/postgres.ts's setupSuitePostgres().
--
-- One database per app, each owned by a dedicated role. A shared read-only
-- auth_reader role gets CONNECT on things_auth plus default SELECT on any
-- tables auth_owner creates (so future migrations don't need a manual GRANT).
--
-- Runs once on first container boot via /docker-entrypoint-initdb.d.

CREATE ROLE auth_owner WITH LOGIN PASSWORD 'auth_owner';
CREATE DATABASE things_auth OWNER auth_owner;

CREATE ROLE do_owner   WITH LOGIN PASSWORD 'do_owner';
CREATE DATABASE things_do   OWNER do_owner;

CREATE ROLE say_owner  WITH LOGIN PASSWORD 'say_owner';
CREATE DATABASE things_say  OWNER say_owner;

CREATE ROLE buy_owner  WITH LOGIN PASSWORD 'buy_owner';
CREATE DATABASE things_buy  OWNER buy_owner;

CREATE ROLE eat_owner  WITH LOGIN PASSWORD 'eat_owner';
CREATE DATABASE things_eat  OWNER eat_owner;

CREATE ROLE send_owner WITH LOGIN PASSWORD 'send_owner';
CREATE DATABASE things_send OWNER send_owner;

CREATE ROLE auth_reader WITH LOGIN PASSWORD 'auth_reader';
GRANT CONNECT ON DATABASE things_auth TO auth_reader;

-- Grant USAGE on public schema + default SELECT on any future table created by
-- auth_owner. The schema-level grant must run inside things_auth, so reconnect.
\connect things_auth
GRANT USAGE ON SCHEMA public TO auth_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE auth_owner IN SCHEMA public
  GRANT SELECT ON TABLES TO auth_reader;
