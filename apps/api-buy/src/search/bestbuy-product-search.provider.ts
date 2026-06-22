import axios from 'axios';
import {
  ProductSearchProvider,
  type ProductResult,
  type ProductSearchOpts,
} from './product-search.provider';

/**
 * Best Buy Products API. Simple API-key auth (key in the query string), free
 * to register at developer.bestbuy.com. Electronics-focused.
 * Docs: https://bestbuyapis.github.io/api-documentation/
 */
interface BestBuyProduct {
  sku?: number | string;
  name?: string;
  salePrice?: number;
  regularPrice?: number;
  image?: string;
  url?: string;
  manufacturer?: string;
}
interface BestBuyResponse {
  products?: BestBuyProduct[];
}

const DEFAULT_BASE = 'https://api.bestbuy.com';

export class BestBuyProductSearchProvider extends ProductSearchProvider {
  private readonly base: string;

  constructor(private readonly opts: { apiKey: string; base?: string }) {
    super();
    this.base = opts.base ?? DEFAULT_BASE;
  }

  async search(query: string, opts: ProductSearchOpts = {}): Promise<ProductResult[]> {
    const limit = opts.limit ?? 10;
    // Best Buy's search DSL uses one `search=` clause per term (AND-ed).
    const terms = query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(encodeURIComponent)
      .join('&search=');
    const url = `${this.base}/v1/products(search=${terms})`;
    const { data } = await axios.get<BestBuyResponse>(url, {
      params: {
        apiKey: this.opts.apiKey,
        format: 'json',
        pageSize: limit,
        show: 'sku,name,salePrice,image,url,manufacturer',
      },
      timeout: 10_000,
    });

    return (data.products ?? []).map((p) => ({
      id: String(p.sku ?? p.name ?? ''),
      title: p.name ?? '',
      imageUrl: p.image ?? null,
      price: p.salePrice != null ? { amount: p.salePrice, currency: 'USD' } : null,
      url: p.url ?? null,
      seller: p.manufacturer ?? null,
      source: 'bestbuy',
    }));
  }
}
