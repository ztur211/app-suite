import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MealsModule } from './meals/meals.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [PrismaModule, AuthModule, MealsModule, SyncModule],
  controllers: [HealthController],
})
export class AppModule {}
