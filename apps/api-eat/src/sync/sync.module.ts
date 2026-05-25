import { Module } from '@nestjs/common';
import { SaySdk } from '@things/say-sdk';
import { AuthModule } from '../auth/auth.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [AuthModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    {
      provide: SaySdk,
      useFactory: () =>
        new SaySdk({
          baseUrl: process.env['SAY_API_URL'] ?? 'http://localhost:3003',
          callerService: 'api-eat',
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          serviceTokenSecret: process.env['SERVICE_TOKEN_SECRET']!,
        }),
    },
  ],
  exports: [SyncService],
})
export class SyncModule {}
