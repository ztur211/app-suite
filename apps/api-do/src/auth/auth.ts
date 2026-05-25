import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '../../prisma/generated/client';

// This Prisma client connects to things_auth.db (the shared user DB),
// which also contains the Task table. One DB, one client.
export const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  emailAndPassword: { enabled: true },
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  secret: process.env['BETTER_AUTH_SECRET']!,
  basePath: '/auth',
  trustedOrigins: ['http://localhost:3002', 'http://localhost:8081'],
});

export type Auth = typeof auth;
