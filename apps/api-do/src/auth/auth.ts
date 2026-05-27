import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '../../prisma/generated/client';
import { PrismaClient as AuthPrismaClient } from '../../prisma/generated/auth-client';

// Domain client — connects to things_do (writable via the do_owner role).
// Used by TasksService for Task CRUD.
export const prisma = new PrismaClient();

// Auth client — connects to things_auth (read-only via the auth_reader role).
// Used by Better Auth to validate session cookies. api-do never writes
// session/user data; sign-up flows live in api-auth.
export const authPrisma = new AuthPrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(authPrisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  secret: process.env['BETTER_AUTH_SECRET']!,
  basePath: '/auth',
  trustedOrigins: ['http://localhost:3002', 'http://localhost:8081'],
});

export type Auth = typeof auth;
