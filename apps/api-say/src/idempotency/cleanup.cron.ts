import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IdempotencyCleanupCron {
  private readonly log = new Logger(IdempotencyCleanupCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduled(): Promise<void> {
    const n = await this.run();
    this.log.log(`Cleaned ${n} expired idempotency keys`);
  }

  async run(): Promise<number> {
    const r = await this.prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return r.count;
  }
}
