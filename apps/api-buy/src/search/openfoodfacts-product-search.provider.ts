import axios from 'axios';
import {
  ProductSearchProvider,
  type ProductResult,
  type ProductSearchOpts,
} from './product-search.provider';

/**
 * Keyless product search via the public Open Food Facts catalogue. No API key
 * or account is required, so this is the always-available default/fallback for
 * api-buy when no eBay credentials are configured. Grocery-oriented; has no
 * pricing, so `price` is always null.
 *
 * Docs: https://world.openfoodfacts.org/cgi/search.pl
 */
interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  image_url?: string;
}
interface OffSearchResponse {
  products?: OffProduct[];
}

const DEFAULT_BASE = 'https://world.openfoodfacts.org';

export class OpenFoodFactsProductSearchProvider extends ProductSearchProvider {
  private readonly base: string;

  constructor(base?: string) {
    super();
    this.base = base ?? DEFAULT_BASE;
  }

  async search(query: string, opts: ProductSearchOpts = {}): Promise<ProductResult[]> {
    const limit = opts.limit ?? 10;
    const { data } = await axios.get<OffSearchResponse>(`${this.base}/cgi/search.pl`, {
      params: {
        search_terms: query,
        json: 1,
        page_size: limit,
        fields: 'code,product_name,brands,image_url',
      },
      timeout: 10_000,
    });

    return (data.products ?? [])
      .filter((p): p is OffProduct & { product_name: string } => Boolean(p.product_name))
      .slice(0, limit)
      .map((p) => ({
        id: p.code ?? p.product_name,
        title: p.product_name,
        imageUrl: p.image_url ?? null,
        price: null,
        url: p.code ? `${this.base}/product/${p.code}` : null,
        seller: p.brands ?? null,
        source: 'openfoodfacts',
      }));
  }
}
