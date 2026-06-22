import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { MessageDispatchController } from './message-dispatch.controller';
import { TelegramAdapter } from './telegram.adapter';
import { createTelegramAdapter } from './telegram.factory';

@Module({
  imports: [AuthModule],
  controllers: [TelegramController, MessageDispatchController],
  providers: [
    TelegramService,
    { provide: TelegramAdapter, useFactory: () => createTelegramAdapter() },
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
