import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient as AuthPrismaClient } from '../../prisma/generated/auth-client';

// Auth client — connects to things_auth (read-only via the auth_reader role).
// Used by Better Auth to validate session cookies. api-buy never writes
// session/user data; sign-up flows live in api-auth.
export const authPrisma = new AuthPrismaClient();

// Expo dev servers bind 8081 upward; trust the first five for side-by-side apps.
const devWebOrigins = Array.from({ length: 5 }, (_, i) => `http://localhost:${8081 + i}`);

export const auth = betterAuth({
  database: prismaAdapter(authPrisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  secret: process.env['BETTER_AUTH_SECRET']!,
  baseURL: process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3004',
  basePath: '/auth',
  trustedOrigins: [process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3004', ...devWebOrigins],
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
