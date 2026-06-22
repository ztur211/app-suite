import axios from 'axios';
import {
  ProductSearchProvider,
  type ProductResult,
  type ProductSearchOpts,
} from './product-search.provider';

/**
 * Etsy Open API v3 active-listing search. Public listing search needs only the
 * app key (x-api-key header) — no OAuth. Handmade / vintage / craft goods.
 * Docs: https://developers.etsy.com/documentation/reference/#operation/findAllListingsActive
 */
interface EtsyImage {
  url_570xN?: string;
  url_fullxfull?: string;
}
interface EtsyListing {
  listing_id?: number | string;
  title?: string;
  url?: string;
  price?: { amount?: number; divisor?: number; currency_code?: string };
  images?: EtsyImage[];
}
interface EtsyResponse {
  count?: number;
  results?: EtsyListing[];
}

const DEFAULT_BASE = 'https://openapi.etsy.com';

export class EtsyProductSearchProvider extends ProductSearchProvider {
  private readonly base: string;

  constructor(private readonly opts: { apiKey: string; base?: string }) {
    super();
    this.base = opts.base ?? DEFAULT_BASE;
  }

  async search(query: string, opts: ProductSearchOpts = {}): Promise<ProductResult[]> {
    const limit = opts.limit ?? 10;
    const { data } = await axios.get<EtsyResponse>(`${this.base}/v3/application/listings/active`, {
      params: { keywords: query, limit, includes: 'Images' },
      headers: { 'x-api-key': this.opts.apiKey },
      timeout: 10_000,
    });

    return (data.results ?? []).map((l) => {
      const img = l.images?.[0];
      const amount =
        l.price?.amount != null && l.price.divisor ? l.price.amount / l.price.divisor : null;
      return {
        id: String(l.listing_id ?? ''),
        title: l.title ?? '',
        imageUrl: img?.url_570xN ?? img?.url_fullxfull ?? null,
        price: amount != null ? { amount, currency: l.price?.currency_code ?? 'USD' } : null,
        url: l.url ?? null,
        seller: null,
        source: 'etsy',
      };
    });
  }
}
