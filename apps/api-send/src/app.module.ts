import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MessagesModule } from './messages/messages.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [PrismaModule, AuthModule, MessagesModule, TelegramModule],
  controllers: [HealthController],
})
export class AppModule {}
