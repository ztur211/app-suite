import { Module } from '@nestjs/common';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyCleanupCron } from './cleanup.cron';

@Module({
  providers: [IdempotencyInterceptor, IdempotencyCleanupCron],
  exports: [IdempotencyInterceptor],
})
export class IdempotencyModule {}
