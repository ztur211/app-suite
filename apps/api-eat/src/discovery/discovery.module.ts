import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { RecipeProvider, RestaurantProvider } from './discovery.provider';
import { createRecipeProvider, createRestaurantProvider } from './discovery.factory';

@Module({
  imports: [AuthModule],
  controllers: [DiscoveryController],
  providers: [
    DiscoveryService,
    { provide: RecipeProvider, useFactory: () => createRecipeProvider() },
    { provide: RestaurantProvider, useFactory: () => createRestaurantProvider() },
  ],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
