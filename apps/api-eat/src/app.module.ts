import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MealsModule } from './meals/meals.module';
import { SyncModule } from './sync/sync.module';
import { DiscoveryModule } from './discovery/discovery.module';

@Module({
  imports: [PrismaModule, AuthModule, MealsModule, SyncModule, DiscoveryModule],
  controllers: [HealthController],
})
export class AppModule {}
