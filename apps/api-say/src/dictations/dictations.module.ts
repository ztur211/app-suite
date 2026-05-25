import { Module } from '@nestjs/common';
import { AiClient, createAiClient } from '@things/ai';
import { DictationsController } from './dictations.controller';
import { DictationsService } from './dictations.service';
import { DispatchModule } from '../dispatch/dispatch.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { makePrismaUsageLogger } from '../ai/prisma-usage-logger';

@Module({
  imports: [DispatchModule, IdempotencyModule, AuthModule],
  controllers: [DictationsController],
  providers: [
    DictationsService,
    {
      provide: AiClient,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) =>
        createAiClient({
          openaiApiKey: process.env['OPENAI_API_KEY'] ?? '',
          anthropicApiKey: process.env['ANTHROPIC_API_KEY'] ?? '',
          usageLogger: makePrismaUsageLogger(prisma),
        }),
    },
    {
      provide: 'TMP_AUDIO_DIR',
      useValue: process.env['TMP_AUDIO_DIR'] ?? './tmp',
    },
  ],
  exports: [DictationsService],
})
export class DictationsModule {}
