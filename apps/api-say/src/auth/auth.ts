import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { trustedWebOrigins, authCookieDomain } from '@things/auth';
import { PrismaClient } from '../../prisma/generated/client';
import { PrismaClient as AuthPrismaClient } from '../../prisma/generated/auth-client';

// Domain client — connects to things_say (writable via the say_owner role).
// Used by DictationsService / IdempotencyInterceptor / PrismaUsageLogger /
// PendingService for Dictation, IdempotencyKey, and AiCall writes.
export const prisma = new PrismaClient();

// Auth client — connects to things_auth (read-only via the auth_reader role).
// Used by Better Auth to validate session cookies. api-say never writes
// session/user data; sign-up flows live in api-auth.
export const authPrisma = new AuthPrismaClient();

const cookieDomain = authCookieDomain();

export const auth = betterAuth({
  database: prismaAdapter(authPrisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  secret: process.env['BETTER_AUTH_SECRET']!,
  baseURL: process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3003',
  basePath: '/auth',
  trustedOrigins: [
    process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3003',
    ...trustedWebOrigins(),
  ],
  ...(cookieDomain
    ? { advanced: { crossSubDomainCookies: { enabled: true, domain: cookieDomain } } }
    : {}),
  user: {
    additionalFields: {
      timezone: {
        type: 'string',
        defaultValue: 'UTC',
        required: false,
      },
    },
  },
});

export type Auth = typeof auth;
