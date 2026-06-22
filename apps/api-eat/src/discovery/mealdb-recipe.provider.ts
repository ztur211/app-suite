import axios from 'axios';
import { RecipeProvider, type DiscoveryResult, type RecipeSearchOpts } from './discovery.provider';

/**
 * Keyless recipe search via TheMealDB. The public test key "1" needs no
 * account, so recipe discovery always works in dev/CI. A paid key can be
 * dropped in via MEALDB_API_KEY. Docs: https://www.themealdb.com/api.php
 */
interface MealDbMeal {
  idMeal?: string;
  strMeal?: string;
  strMealThumb?: string;
  strCategory?: string;
  strArea?: string;
  strSource?: string;
}
interface MealDbResponse {
  // TheMealDB returns `null` (not []) when nothing matches.
  meals?: MealDbMeal[] | null;
}

const DEFAULT_BASE = 'https://www.themealdb.com';
const DEFAULT_KEY = '1';

export class MealDbRecipeProvider extends RecipeProvider {
  private readonly base: string;
  private readonly key: string;

  constructor(opts: { base?: string; key?: string } = {}) {
    super();
    this.base = opts.base ?? DEFAULT_BASE;
    this.key = opts.key ?? DEFAULT_KEY;
  }

  async search(query: string, opts: RecipeSearchOpts = {}): Promise<DiscoveryResult[]> {
    const limit = opts.limit ?? 10;
    const { data } = await axios.get<MealDbResponse>(
      `${this.base}/api/json/v1/${this.key}/search.php`,
      { params: { s: query }, timeout: 10_000 },
    );

    return (data.meals ?? [])
      .filter((m): m is MealDbMeal & { strMeal: string } => Boolean(m.strMeal))
      .slice(0, limit)
      .map((m) => ({
        id: m.idMeal ?? m.strMeal,
        name: m.strMeal,
        imageUrl: m.strMealThumb ?? null,
        kind: 'recipe' as const,
        detail: [m.strCategory, m.strArea].filter(Boolean).join(' · ') || null,
        url: m.strSource || null,
        source: 'themealdb',
      }));
  }
}
