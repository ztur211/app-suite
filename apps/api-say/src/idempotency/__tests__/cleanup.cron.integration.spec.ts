import { IdempotencyCleanupCron } from '../cleanup.cron';
import { PrismaService } from '../../prisma/prisma.service';
import { createAuthOwnerPrisma } from '../../test-utils/auth-owner-prisma';

describe('IdempotencyCleanupCron (integration)', () => {
  let prisma: PrismaService;
  let cron: IdempotencyCleanupCron;
  const userId = 'u-cron';

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const writeAuth = createAuthOwnerPrisma();
    try {
      await writeAuth.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email: `cron-${Date.now()}@things-test.local`,
          emailVerified: true,
          timezone: 'UTC',
        },
        update: {},
      });
    } finally {
      await writeAuth.$disconnect();
    }
    cron = new IdempotencyCleanupCron(prisma);
  });

  afterAll(async () => {
    await prisma.idempotencyKey.deleteMany({ where: { userId } });
    const writeAuth = createAuthOwnerPrisma();
    try {
      await writeAuth.user.deleteMany({ where: { id: userId } });
    } finally {
      await writeAuth.$disconnect();
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.idempotencyKey.deleteMany({ where: { userId } });
  });

  it('deletes only expired keys', async () => {
    await prisma.idempotencyKey.createMany({
      data: [
        {
          key: 'old',
          userId,
          endpoint: 'POST /dictations',
          requestBodyHash: 'h',
          statusCode: 200,
          responseBody: '{}',
          expiresAt: new Date(Date.now() - 1000),
        },
        {
          key: 'new',
          userId,
          endpoint: 'POST /dictations',
          requestBodyHash: 'h',
          statusCode: 200,
          responseBody: '{}',
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    });
    const deleted = await cron.run();
    expect(deleted).toBe(1);
    expect(await prisma.idempotencyKey.findUnique({ where: { key: 'old' } })).toBeNull();
    expect(await prisma.idempotencyKey.findUnique({ where: { key: 'new' } })).not.toBeNull();
  });
});
