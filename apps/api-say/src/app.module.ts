import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { DictationsModule } from './dictations/dictations.module';
import { PendingModule } from './pending/pending.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    IdempotencyModule,
    DispatchModule,
    DictationsModule,
    PendingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
