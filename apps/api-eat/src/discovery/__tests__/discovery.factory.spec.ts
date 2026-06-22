import { createRecipeProvider, createRestaurantProvider } from '../discovery.factory';
import { MealDbRecipeProvider } from '../mealdb-recipe.provider';
import { YelpRestaurantProvider } from '../yelp-restaurant.provider';

describe('discovery factory', () => {
  it('recipe provider is always TheMealDB (keyless)', () => {
    expect(createRecipeProvider({})).toBeInstanceOf(MealDbRecipeProvider);
  });

  it('restaurant provider is Yelp when YELP_API_KEY is set', () => {
    expect(createRestaurantProvider({ YELP_API_KEY: 'yk' })).toBeInstanceOf(YelpRestaurantProvider);
  });

  it('restaurant provider without a key throws a clear 503 on search', async () => {
    const provider = createRestaurantProvider({});
    await expect(provider.search('sushi')).rejects.toThrow('not configured');
  });
});
