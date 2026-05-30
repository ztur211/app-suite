import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '../../prisma/generated/client';

export const prisma = new PrismaClient();

// Expo dev servers bind 8081 upward; trust the first five for side-by-side apps.
const devWebOrigins = Array.from({ length: 5 }, (_, i) => `http://localhost:${8081 + i}`);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  secret: process.env['BETTER_AUTH_SECRET']!,
  baseURL: process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3001',
  // Mount at /auth (not the default /api/auth) — matches the NestJS controller
  basePath: '/auth',
  trustedOrigins: [process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3001', ...devWebOrigins],
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
