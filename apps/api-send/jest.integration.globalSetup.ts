/**
 * Integration-test globalSetup for api-send:
 *
 *   1. Provisions things_send + things_auth via @things/testing's testcontainer
 *      helper, including the read-only auth_reader role for cross-app session
 *      lookup.
 *   2. Pushes api-send's domain schema into things_send.
 *   3. Pushes the auth-schema mirror into things_auth using auth_owner's URL
 *      (writable), then grants auth_reader SELECT on the just-created tables.
 *   4. Exposes the connection URLs via process.env so the singletons in
 *      src/auth/auth.ts (`authPrisma` for things_auth) and the domain
 *      PrismaClient pick up the right targets.
 *   5. Stashes the auth_owner URL on a global so integration tests can
 *      construct a temporary write-enabled Better Auth client for user seed.
 *
 * Container cleanup is handled by testcontainers' Ryuk sidecar.
 */
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { setupSuitePostgres, type SuitePostgres } from '@things/testing';

declare global {
  var __THINGS_SEND_PG__: SuitePostgres | undefined;
  var __THINGS_AUTH_OWNER_URL__: string | undefined;
}

export default async function globalSetup(): Promise<void> {
  const suite = await setupSuitePostgres({ apps: ['auth', 'send'], authReader: true });

  execSync('npx prisma db push --skip-generate --schema=prisma/schema.prisma', {
    cwd: path.resolve(__dirname),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: suite.urls.send },
  });

  execSync('npx prisma db push --skip-generate --schema=prisma/auth-schema.prisma', {
    cwd: path.resolve(__dirname),
    stdio: 'inherit',
    env: { ...process.env, AUTH_DATABASE_URL: suite.urls.auth },
  });

  await suite.grantAuthReaderOnAuthTables();

  process.env['DATABASE_URL'] = suite.urls.send;
  process.env['AUTH_DATABASE_URL'] = suite.authReaderUrl;
  process.env['BETTER_AUTH_SECRET'] ??= 'test-better-auth-secret-min-32-chars-aaaa';
  process.env['BETTER_AUTH_URL'] ??= 'http://localhost:3006';

  globalThis.__THINGS_SEND_PG__ = suite;
  globalThis.__THINGS_AUTH_OWNER_URL__ = suite.urls.auth;
}
