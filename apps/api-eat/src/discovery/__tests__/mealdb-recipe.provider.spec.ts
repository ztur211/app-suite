jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import axios from 'axios';
import { MealDbRecipeProvider } from '../mealdb-recipe.provider';

const mockGet = axios.get as jest.Mock;

describe('MealDbRecipeProvider (unit)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queries the keyed search.php endpoint with the term', async () => {
    mockGet.mockResolvedValueOnce({ data: { meals: [] } });
    const provider = new MealDbRecipeProvider({ base: 'https://meal.test', key: '1' });

    await provider.search('pasta', { limit: 5 });

    const [url, config] = mockGet.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(url).toBe('https://meal.test/api/json/v1/1/search.php');
    expect(config.params).toMatchObject({ s: 'pasta' });
  });

  it('maps meals to DiscoveryResult with kind=recipe', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        meals: [
          {
            idMeal: '52772',
            strMeal: 'Teriyaki Chicken',
            strMealThumb: 'http://img/t.jpg',
            strCategory: 'Chicken',
            strArea: 'Japanese',
            strSource: 'http://recipe',
          },
        ],
      },
    });
    const provider = new MealDbRecipeProvider({ base: 'https://meal.test' });

    const results = await provider.search('chicken');

    expect(results).toEqual([
      {
        id: '52772',
        name: 'Teriyaki Chicken',
        imageUrl: 'http://img/t.jpg',
        kind: 'recipe',
        detail: 'Chicken · Japanese',
        url: 'http://recipe',
        source: 'themealdb',
      },
    ]);
  });

  it('returns [] when TheMealDB returns meals: null', async () => {
    mockGet.mockResolvedValueOnce({ data: { meals: null } });
    const provider = new MealDbRecipeProvider();
    expect(await provider.search('zzz')).toEqual([]);
  });
});
