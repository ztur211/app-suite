import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MessagesModule } from './messages/messages.module';
import { TelegramModule } from './telegram/telegram.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [PrismaModule, AuthModule, MessagesModule, TelegramModule, SyncModule],
  controllers: [HealthController],
})
export class AppModule {}
