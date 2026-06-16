import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins';
import { trustedWebOrigins, authCookieDomain } from '@things/auth';
import { PrismaClient as AuthPrismaClient } from '../../prisma/generated/auth-client';

// Auth client — connects to things_auth (read-only via the auth_reader role).
// Used by Better Auth to validate session cookies. api-buy never writes
// session/user data; sign-up flows live in api-auth.
export const authPrisma = new AuthPrismaClient();

const cookieDomain = authCookieDomain();

export const auth = betterAuth({
  database: prismaAdapter(authPrisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  // Bearer tokens: web apps hosted cross-site (Vercel) can't use the session
  // cookie, so they capture the token from the set-auth-token response header
  // and send it as Authorization: Bearer. The session guard already forwards it.
  plugins: [bearer()],
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  secret: process.env['BETTER_AUTH_SECRET']!,
  baseURL: process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3004',
  basePath: '/auth',
  trustedOrigins: [
    process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3004',
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
