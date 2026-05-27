/**
 * Integration-test globalSetup for api-say:
 *
 *   1. Provisions things_say + things_auth via @things/testing's testcontainer
 *      helper, including the read-only auth_reader role.
 *   2. Pushes api-say's domain schema (Dictation, IdempotencyKey, AiCall)
 *      into things_say.
 *   3. Pushes the auth-schema mirror into things_auth using auth_owner's URL,
 *      then grants auth_reader SELECT on the just-created tables.
 *   4. Sets DATABASE_URL/AUTH_DATABASE_URL/BETTER_AUTH_SECRET so the
 *      singletons in src/auth/auth.ts pick up the right targets.
 *   5. Stashes the auth_owner URL on a global so test files can construct
 *      writable Better Auth / AuthPrismaClient instances for User upsert/
 *      delete (api-say's runtime authPrisma is read-only).
 *
 * Container cleanup is handled by testcontainers' Ryuk sidecar.
 */
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { setupSuitePostgres, type SuitePostgres } from '@things/testing';

declare global {
  var __THINGS_SAY_PG__: SuitePostgres | undefined;
  var __THINGS_AUTH_OWNER_URL__: string | undefined;
}

export default async function globalSetup(): Promise<void> {
  const suite = await setupSuitePostgres({ apps: ['auth', 'say'], authReader: true });

  execSync('npx prisma db push --skip-generate --schema=prisma/schema.prisma', {
    cwd: path.resolve(__dirname),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: suite.urls.say },
  });

  execSync('npx prisma db push --skip-generate --schema=prisma/auth-schema.prisma', {
    cwd: path.resolve(__dirname),
    stdio: 'inherit',
    env: { ...process.env, AUTH_DATABASE_URL: suite.urls.auth },
  });

  await suite.grantAuthReaderOnAuthTables();

  process.env['DATABASE_URL'] = suite.urls.say;
  process.env['AUTH_DATABASE_URL'] = suite.authReaderUrl;
  process.env['BETTER_AUTH_SECRET'] ??= 'test-better-auth-secret-min-32-chars-aaaa';
  process.env['BETTER_AUTH_URL'] ??= 'http://localhost:3003';

  globalThis.__THINGS_SAY_PG__ = suite;
  globalThis.__THINGS_AUTH_OWNER_URL__ = suite.urls.auth;
}
