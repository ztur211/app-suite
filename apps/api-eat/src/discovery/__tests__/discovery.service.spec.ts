import { DiscoveryService } from '../discovery.service';
import { RecipeProvider, RestaurantProvider } from '../discovery.provider';

describe('DiscoveryService (unit)', () => {
  const recipes = { search: jest.fn() };
  const restaurants = { search: jest.fn() };
  const service = new DiscoveryService(
    recipes as unknown as RecipeProvider,
    restaurants as unknown as RestaurantProvider,
  );

  beforeEach(() => jest.clearAllMocks());

  it('routes kind=recipe to the recipe provider', async () => {
    recipes.search.mockResolvedValueOnce([{ id: 'r1' }]);

    const out = await service.search('pasta', 'recipe', { limit: 5 });

    expect(recipes.search).toHaveBeenCalledWith('pasta', { limit: 5 });
    expect(restaurants.search).not.toHaveBeenCalled();
    expect(out).toEqual({ kind: 'recipe', results: [{ id: 'r1' }] });
  });

  it('routes kind=restaurant to the restaurant provider with location', async () => {
    restaurants.search.mockResolvedValueOnce([{ id: 'b1' }]);

    const out = await service.search('sushi', 'restaurant', { location: 'NYC' });

    expect(restaurants.search).toHaveBeenCalledWith('sushi', { limit: undefined, location: 'NYC' });
    expect(out).toEqual({ kind: 'restaurant', results: [{ id: 'b1' }] });
  });

  it('defaults kind to recipe (works without external keys)', async () => {
    recipes.search.mockResolvedValueOnce([]);
    const out = await service.search('pizza');
    expect(recipes.search).toHaveBeenCalled();
    expect(out.kind).toBe('recipe');
  });

  it('short-circuits an empty query without hitting a provider', async () => {
    const out = await service.search('   ', 'recipe');
    expect(out).toEqual({ kind: 'recipe', results: [] });
    expect(recipes.search).not.toHaveBeenCalled();
  });
});
