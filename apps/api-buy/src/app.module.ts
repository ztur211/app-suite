import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ItemsModule } from './items/items.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [PrismaModule, AuthModule, ItemsModule, SyncModule],
  controllers: [HealthController],
})
export class AppModule {}
