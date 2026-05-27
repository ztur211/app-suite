/**
 * Integration-test globalSetup: spin up a Postgres testcontainer, push the
 * Prisma schema into things_auth, expose the connection URL via process.env
 * so worker processes (and the singleton PrismaClient in src/auth/auth.ts)
 * pick it up. Container cleanup is handled by testcontainers' Ryuk sidecar.
 */
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { setupSuitePostgres, type SuitePostgres } from '@things/testing';

declare global {
  var __THINGS_AUTH_PG__: SuitePostgres | undefined;
}

export default async function globalSetup(): Promise<void> {
  const suite = await setupSuitePostgres({ apps: ['auth'], authReader: false });
  process.env['DATABASE_URL'] = suite.urls.auth;
  process.env['BETTER_AUTH_SECRET'] ??= 'test-better-auth-secret-min-32-chars-aaaa';
  process.env['BETTER_AUTH_URL'] ??= 'http://localhost:3001';

  // Push the schema into the fresh things_auth DB. db push is sufficient for
  // tests; production deploys will use `prisma migrate deploy` once migrations
  // land in P5.
  execSync('npx prisma db push --skip-generate', {
    cwd: path.resolve(__dirname),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: suite.urls.auth },
  });

  globalThis.__THINGS_AUTH_PG__ = suite;
}
