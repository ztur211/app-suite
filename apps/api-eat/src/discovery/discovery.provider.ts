/**
 * Provider seam for external meal discovery. Two concrete provider families —
 * recipes (TheMealDB) and restaurants (Yelp) — normalize to one shape so the
 * service and frontend treat them uniformly. The abstract classes double as
 * Nest DI tokens, so tests can swap fakes via `.overrideProvider(...)`.
 */

/** A single normalized discovery hit (recipe or restaurant). */
export interface DiscoveryResult {
  /** Stable id from the source. */
  id: string;
  name: string;
  imageUrl: string | null;
  kind: 'recipe' | 'restaurant';
  /** Short descriptor: cuisine/area for recipes, rating·price·address for restaurants. */
  detail: string | null;
  url: string | null;
  source: string;
}

export interface RecipeSearchOpts {
  limit?: number;
}

export interface RestaurantSearchOpts {
  limit?: number;
  /** Free-text locality (city, address). Falls back to a configured default. */
  location?: string;
}

export abstract class RecipeProvider {
  abstract search(query: string, opts?: RecipeSearchOpts): Promise<DiscoveryResult[]>;
}

export abstract class RestaurantProvider {
  abstract search(query: string, opts?: RestaurantSearchOpts): Promise<DiscoveryResult[]>;
}
