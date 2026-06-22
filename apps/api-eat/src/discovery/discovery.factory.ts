import { ServiceUnavailableException } from '@nestjs/common';
import { RecipeProvider, RestaurantProvider, type DiscoveryResult } from './discovery.provider';
import { MealDbRecipeProvider } from './mealdb-recipe.provider';
import { YelpRestaurantProvider } from './yelp-restaurant.provider';

/**
 * Choose discovery providers from the environment. Recipes always use the
 * keyless TheMealDB. Restaurants use Yelp when YELP_API_KEY is set; otherwise
 * a no-op that returns a clear 503 on use, so the app boots without the key
 * and recipe search keeps working.
 *
 * Kept out of discovery.module.ts so it stays unit-testable without the
 * auth/better-auth import chain.
 */
export function createRecipeProvider(
  env: Record<string, string | undefined> = process.env,
): RecipeProvider {
  return new MealDbRecipeProvider({ base: env['MEALDB_API_BASE'], key: env['MEALDB_API_KEY'] });
}

class UnconfiguredRestaurantProvider extends RestaurantProvider {
  async search(): Promise<DiscoveryResult[]> {
    throw new ServiceUnavailableException('Restaurant search is not configured (set YELP_API_KEY)');
  }
}

export function createRestaurantProvider(
  env: Record<string, string | undefined> = process.env,
): RestaurantProvider {
  const apiKey = env['YELP_API_KEY'];
  if (!apiKey) return new UnconfiguredRestaurantProvider();
  return new YelpRestaurantProvider({
    apiKey,
    base: env['YELP_API_BASE'],
    defaultLocation: env['EAT_DEFAULT_LOCATION'],
  });
}
