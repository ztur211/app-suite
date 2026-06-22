import axios from 'axios';
import {
  RestaurantProvider,
  type DiscoveryResult,
  type RestaurantSearchOpts,
} from './discovery.provider';

/**
 * Restaurant search via the Yelp Fusion API. Simple API-key auth (no OAuth).
 * Activated by discovery.factory.ts when YELP_API_KEY is set. Yelp requires a
 * location, so we fall back to a configured default when the request omits one.
 * Docs: https://docs.developer.yelp.com/reference/v3_business_search
 */
interface YelpBusiness {
  id?: string;
  name?: string;
  image_url?: string;
  rating?: number;
  price?: string;
  categories?: { title?: string }[];
  location?: { display_address?: string[] };
  url?: string;
}
interface YelpSearchResponse {
  businesses?: YelpBusiness[];
}

const DEFAULT_BASE = 'https://api.yelp.com';
const FALLBACK_LOCATION = 'United States';

export class YelpRestaurantProvider extends RestaurantProvider {
  private readonly base: string;

  constructor(private readonly opts: { apiKey: string; base?: string; defaultLocation?: string }) {
    super();
    this.base = opts.base ?? DEFAULT_BASE;
  }

  async search(query: string, opts: RestaurantSearchOpts = {}): Promise<DiscoveryResult[]> {
    const limit = opts.limit ?? 10;
    const location = opts.location ?? this.opts.defaultLocation ?? FALLBACK_LOCATION;
    const { data } = await axios.get<YelpSearchResponse>(`${this.base}/v3/businesses/search`, {
      params: { term: query, location, limit },
      headers: { Authorization: `Bearer ${this.opts.apiKey}` },
      timeout: 10_000,
    });

    return (data.businesses ?? []).map((b) => ({
      id: b.id ?? b.name ?? '',
      name: b.name ?? '',
      imageUrl: b.image_url ?? null,
      kind: 'restaurant' as const,
      detail:
        [
          b.rating != null ? `★ ${b.rating}` : null,
          b.price ?? null,
          b.categories?.[0]?.title ?? null,
          b.location?.display_address?.join(', ') ?? null,
        ]
          .filter(Boolean)
          .join(' · ') || null,
      url: b.url ?? null,
      source: 'yelp',
    }));
  }
}
