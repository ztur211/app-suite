import { Injectable } from '@nestjs/common';
import { RecipeProvider, RestaurantProvider, type DiscoveryResult } from './discovery.provider';

export type DiscoveryKind = 'recipe' | 'restaurant';

export interface DiscoveryResponse {
  kind: DiscoveryKind;
  results: DiscoveryResult[];
}

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly recipes: RecipeProvider,
    private readonly restaurants: RestaurantProvider,
  ) {}

  /**
   * Discover recipes or restaurants. Defaults to recipes, which work without
   * external credentials; restaurants require a configured Yelp key.
   */
  async search(
    query: string,
    kind: DiscoveryKind = 'recipe',
    opts: { limit?: number; location?: string } = {},
  ): Promise<DiscoveryResponse> {
    const q = (query ?? '').trim();
    if (!q) return { kind, results: [] };

    const results =
      kind === 'recipe'
        ? await this.recipes.search(q, { limit: opts.limit })
        : await this.restaurants.search(q, { limit: opts.limit, location: opts.location });

    return { kind, results };
  }
}
