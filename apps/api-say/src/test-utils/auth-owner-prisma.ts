/**
 * Test-only helper. api-say's runtime authPrisma client is read-only (it
 * connects via the auth_reader role). Integration tests that need to seed
 * a User in things_auth use this helper to construct a write-enabled
 * AuthPrismaClient pointed at the auth_owner URL stashed by
 * jest.integration.globalSetup.ts.
 *
 * Lives outside __tests__/ so it isn't picked up by the spec regex.
 */
import { PrismaClient as AuthPrismaClient } from '../../prisma/generated/auth-client';

declare global {
  var __THINGS_AUTH_OWNER_URL__: string | undefined;
}

export function createAuthOwnerPrisma(): AuthPrismaClient {
  const url = globalThis.__THINGS_AUTH_OWNER_URL__;
  if (!url) {
    throw new Error(
      'createAuthOwnerPrisma: __THINGS_AUTH_OWNER_URL__ not set. ' +
        'Did jest.integration.globalSetup.ts run?',
    );
  }
  return new AuthPrismaClient({ datasources: { db: { url } } });
}
