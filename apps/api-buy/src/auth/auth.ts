import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '../../prisma/generated/client';

// Shared client against the same DB used for session validation (things_auth.db
// in dev). Better Auth uses this to verify HMAC-signed session tokens issued
// by api-auth.
export const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  emailAndPassword: { enabled: true },
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  secret: process.env['BETTER_AUTH_SECRET']!,
  baseURL: process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3004',
  basePath: '/auth',
  trustedOrigins: [
    process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3004',
    'http://localhost:8081',
  ],
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
