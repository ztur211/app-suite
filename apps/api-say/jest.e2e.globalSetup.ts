/**
 * E2E globalSetup for api-say:
 *
 *   1. Provisions things_auth + things_do + things_say via @things/testing's
 *      testcontainer helper, including the read-only auth_reader role.
 *   2. Pushes each app's domain schema into its own DB (api-do → things_do,
 *      api-say → things_say) plus the auth-schema mirror into things_auth via
 *      auth_owner, then grants auth_reader SELECT on the auth tables.
 *   3. Sets the cross-app env vars (AUTH_DATABASE_URL, BETTER_AUTH_SECRET,
 *      SERVICE_TOKEN_SECRET). DATABASE_URL is left for the test file to set
 *      per-app right before each app's PrismaClient is constructed.
 *   4. Stashes the SuitePostgres handle + the auth_owner URL on globals so
 *      the spec can seed users and query the per-app DBs directly.
 *
 * Container cleanup is handled by testcontainers' Ryuk sidecar.
 */
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { setupSuitePostgres, type SuitePostgres } from '@things/testing';

declare global {
  var __THINGS_E2E_PG__: SuitePostgres | undefined;
  var __THINGS_AUTH_OWNER_URL__: string | undefined;
}

export default async function globalSetup(): Promise<void> {
  const suite = await setupSuitePostgres({ apps: ['auth', 'do', 'say'], authReader: true });

  // api-do domain schema → things_do (owned by do_owner).
  execSync('npx prisma db push --skip-generate --schema=prisma/schema.prisma', {
    cwd: path.resolve(__dirname, '../api-do'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: suite.urls.do },
  });

  // api-say domain schema → things_say (owned by say_owner).
  execSync('npx prisma db push --skip-generate --schema=prisma/schema.prisma', {
    cwd: path.resolve(__dirname),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: suite.urls.say },
  });

  // Auth-mirror schema → things_auth (pushed via auth_owner, writable).
  // After this, auth_reader still needs SELECT — granted in the next step.
  execSync('npx prisma db push --skip-generate --schema=prisma/auth-schema.prisma', {
    cwd: path.resolve(__dirname),
    stdio: 'inherit',
    env: { ...process.env, AUTH_DATABASE_URL: suite.urls.auth },
  });

  await suite.grantAuthReaderOnAuthTables();

  process.env['AUTH_DATABASE_URL'] = suite.authReaderUrl;
  process.env['BETTER_AUTH_SECRET'] ??= 'test-e2e-better-auth-secret-min-32-chars-aaaa';
  process.env['SERVICE_TOKEN_SECRET'] ??= 'test-e2e-service-token-secret-min-32-chars';

  globalThis.__THINGS_E2E_PG__ = suite;
  globalThis.__THINGS_AUTH_OWNER_URL__ = suite.urls.auth;
}
