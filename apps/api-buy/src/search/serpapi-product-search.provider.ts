import axios from 'axios';
import {
  ProductSearchProvider,
  type ProductResult,
  type ProductSearchOpts,
} from './product-search.provider';

/**
 * SerpApi adapter. Defaults to the google_shopping engine, which aggregates
 * listings from many merchants (Walmart, Target, Best Buy, Home Depot, …) —
 * the practical way to cover stores that have no usable official API. The
 * engine is configurable (walmart, amazon, home_depot, ebay, …); the response
 * key varies by engine, so we read shopping_results / organic_results /
 * products defensively. Free tier ~250 searches/month.
 * Docs: https://serpapi.com/google-shopping-api
 */
interface SerpResult {
  position?: number;
  product_id?: string;
  title?: string;
  extracted_price?: number;
  thumbnail?: string;
  product_link?: string;
  link?: string;
  source?: string;
  seller?: string;
}
interface SerpResponse {
  shopping_results?: SerpResult[];
  organic_results?: SerpResult[];
  products?: SerpResult[];
}

const DEFAULT_BASE = 'https://serpapi.com';

export class SerpApiProductSearchProvider extends ProductSearchProvider {
  private readonly base: string;
  private readonly engine: string;

  constructor(private readonly opts: { apiKey: string; base?: string; engine?: string }) {
    super();
    this.base = opts.base ?? DEFAULT_BASE;
    this.engine = opts.engine ?? 'google_shopping';
  }

  async search(query: string, opts: ProductSearchOpts = {}): Promise<ProductResult[]> {
    const limit = opts.limit ?? 10;
    const { data } = await axios.get<SerpResponse>(`${this.base}/search`, {
      params: { engine: this.engine, q: query, api_key: this.opts.apiKey, num: limit },
      timeout: 15_000,
    });

    const results = data.shopping_results ?? data.organic_results ?? data.products ?? [];
    return results.slice(0, limit).map((r) => ({
      id: String(r.product_id ?? r.position ?? r.title ?? ''),
      title: r.title ?? '',
      imageUrl: r.thumbnail ?? null,
      price: r.extracted_price != null ? { amount: r.extracted_price, currency: 'USD' } : null,
      url: r.product_link ?? r.link ?? null,
      seller: r.source ?? r.seller ?? null,
      source: 'serpapi',
    }));
  }
}
