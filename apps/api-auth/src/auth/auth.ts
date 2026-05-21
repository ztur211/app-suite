import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  emailAndPassword: { enabled: true },
  secret: process.env['BETTER_AUTH_SECRET']!,
  baseURL: process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3001',
  // Mount at /auth (not the default /api/auth) — matches the NestJS controller
  basePath: '/auth',
  trustedOrigins: [
    process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3001',
    'http://localhost:8081',
  ],
});

export type Auth = typeof auth;
