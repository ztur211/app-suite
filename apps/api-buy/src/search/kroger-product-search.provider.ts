import axios from 'axios';
import {
  ProductSearchProvider,
  type ProductResult,
  type ProductSearchOpts,
} from './product-search.provider';

/**
 * Kroger Products API. OAuth2 client-credentials (token cached in-memory), free
 * with registration. Grocery catalogue; pass a KROGER_LOCATION_ID for a real
 * store so prices/availability come back (Kroger needs filter.locationId to
 * price an item). Note: Kroger doesn't operate everywhere — without a nearby
 * banner the prices are not locally meaningful.
 * Docs: https://developer.kroger.com/reference/api/product-api-partner
 */
interface KrogerImageSize {
  size?: string;
  url?: string;
}
interface KrogerProduct {
  productId?: string;
  brand?: string;
  description?: string;
  images?: { perspective?: string; sizes?: KrogerImageSize[] }[];
  items?: { price?: { regular?: number; promo?: number } }[];
}
interface KrogerResponse {
  data?: KrogerProduct[];
}
interface KrogerTokenResponse {
  access_token: string;
  expires_in: number;
}

const DEFAULT_BASE = 'https://api.kroger.com';

export class KrogerProductSearchProvider extends ProductSearchProvider {
  private readonly base: string;
  private token: { value: string; expiresAtMs: number } | null = null;

  constructor(
    private readonly opts: {
      clientId: string;
      clientSecret: string;
      base?: string;
      locationId?: string;
    },
  ) {
    super();
    this.base = opts.base ?? DEFAULT_BASE;
  }

  async search(query: string, opts: ProductSearchOpts = {}): Promise<ProductResult[]> {
    const limit = Math.min(opts.limit ?? 10, 50);
    const token = await this.getToken();
    const params: Record<string, string | number> = {
      'filter.term': query,
      'filter.limit': limit,
    };
    if (this.opts.locationId) params['filter.locationId'] = this.opts.locationId;

    const { data } = await axios.get<KrogerResponse>(`${this.base}/v1/products`, {
      params,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10_000,
    });

    return (data.data ?? []).map((p) => {
      const sizes = p.images?.[0]?.sizes ?? [];
      const imageUrl = sizes.find((s) => s.size === 'medium')?.url ?? sizes[0]?.url ?? null;
      const price = p.items?.[0]?.price;
      const amount = price ? (price.promo && price.promo > 0 ? price.promo : price.regular) : null;
      return {
        id: String(p.productId ?? ''),
        title: p.description ?? '',
        imageUrl,
        price: amount != null ? { amount, currency: 'USD' } : null,
        url: null,
        seller: p.brand ?? null,
        source: 'kroger',
      };
    });
  }

  private async getToken(): Promise<string> {
    const nowMs = Date.now();
    if (this.token && this.token.expiresAtMs > nowMs + 60_000) return this.token.value;

    const basic = Buffer.from(`${this.opts.clientId}:${this.opts.clientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'product.compact',
    });
    const { data } = await axios.post<KrogerTokenResponse>(
      `${this.base}/v1/connect/oauth2/token`,
      body.toString(),
      {
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10_000,
      },
    );
    this.token = { value: data.access_token, expiresAtMs: nowMs + data.expires_in * 1000 };
    return this.token.value;
  }
}
