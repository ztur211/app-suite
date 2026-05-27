/**
 * Integration-test globalSetup for api-do:
 *
 *   1. Provisions things_do + things_auth via @things/testing's testcontainer
 *      helper, including the read-only auth_reader role for cross-app session
 *      lookup.
 *   2. Pushes api-do's domain schema (Task) into things_do.
 *   3. Pushes the auth-schema mirror into things_auth using auth_owner's URL
 *      (writable), then grants auth_reader SELECT on the just-created tables.
 *   4. Exposes the connection URLs via process.env so the singletons in
 *      src/auth/auth.ts (`prisma` for things_do, `authPrisma` for things_auth)
 *      pick up the right targets.
 *   5. Stashes a writable-auth URL on a global so the integration test can
 *      construct a temporary write-enabled Better Auth instance for sign-up
 *      (api-do's own instance is read-only by design).
 *
 * Container cleanup is handled by testcontainers' Ryuk sidecar.
 */
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { setupSuitePostgres, type SuitePostgres } from '@things/testing';

declare global {
  var __THINGS_DO_PG__: SuitePostgres | undefined;
  var __THINGS_AUTH_OWNER_URL__: string | undefined;
}

export default async function globalSetup(): Promise<void> {
  const suite = await setupSuitePostgres({ apps: ['auth', 'do'], authReader: true });

  // Domain schema → things_do, owned by do_owner.
  execSync('npx prisma db push --skip-generate --schema=prisma/schema.prisma', {
    cwd: path.resolve(__dirname),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: suite.urls.do },
  });

  // Auth-mirror schema → things_auth, pushed via auth_owner (writable).
  // After this, auth_reader still needs SELECT — granted in the next step.
  execSync('npx prisma db push --skip-generate --schema=prisma/auth-schema.prisma', {
    cwd: path.resolve(__dirname),
    stdio: 'inherit',
    env: { ...process.env, AUTH_DATABASE_URL: suite.urls.auth },
  });

  await suite.grantAuthReaderOnAuthTables();

  process.env['DATABASE_URL'] = suite.urls.do;
  process.env['AUTH_DATABASE_URL'] = suite.authReaderUrl;
  process.env['BETTER_AUTH_SECRET'] ??= 'test-better-auth-secret-min-32-chars-aaaa';
  process.env['BETTER_AUTH_URL'] ??= 'http://localhost:3002';

  globalThis.__THINGS_DO_PG__ = suite;
  globalThis.__THINGS_AUTH_OWNER_URL__ = suite.urls.auth;
}
