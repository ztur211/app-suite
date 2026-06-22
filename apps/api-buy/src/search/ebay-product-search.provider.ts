import axios from 'axios';
import {
  ProductSearchProvider,
  type ProductResult,
  type ProductSearchOpts,
} from './product-search.provider';

/**
 * Real product search via the eBay Browse API. Uses the app-level
 * client-credentials OAuth flow (no per-user consent): exchange clientId +
 * clientSecret for an application access token, cache it until it expires,
 * then call item_summary/search.
 *
 * Activated by search.module.ts when EBAY_CLIENT_ID + EBAY_CLIENT_SECRET are
 * set. Docs: https://developer.ebay.com/api-docs/buy/browse/overview.html
 */
export interface EbayProviderOpts {
  clientId: string;
  clientSecret: string;
  /** Override for tests / the eBay sandbox. Defaults to production. */
  base?: string;
  /** OAuth scope; defaults to the public Browse scope. */
  scope?: string;
}

interface EbayItemSummary {
  itemId?: string;
  title?: string;
  image?: { imageUrl?: string };
  price?: { value?: string; currency?: string };
  itemWebUrl?: string;
  seller?: { username?: string };
}
interface EbaySearchResponse {
  itemSummaries?: EbayItemSummary[];
}
interface EbayTokenResponse {
  access_token: string;
  expires_in: number;
}

const DEFAULT_BASE = 'https://api.ebay.com';
const DEFAULT_SCOPE = 'https://api.ebay.com/oauth/api_scope';

export class EbayProductSearchProvider extends ProductSearchProvider {
  private readonly base: string;
  private readonly scope: string;
  private token: { value: string; expiresAtMs: number } | null = null;

  constructor(private readonly opts: EbayProviderOpts) {
    super();
    this.base = opts.base ?? DEFAULT_BASE;
    this.scope = opts.scope ?? DEFAULT_SCOPE;
  }

  async search(query: string, opts: ProductSearchOpts = {}): Promise<ProductResult[]> {
    const limit = opts.limit ?? 10;
    const token = await this.getToken();
    const { data } = await axios.get<EbaySearchResponse>(
      `${this.base}/buy/browse/v1/item_summary/search`,
      {
        params: { q: query, limit },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10_000,
      },
    );

    return (data.itemSummaries ?? []).map((it) => ({
      id: it.itemId ?? it.itemWebUrl ?? it.title ?? '',
      title: it.title ?? '',
      imageUrl: it.image?.imageUrl ?? null,
      price:
        it.price?.value != null
          ? { amount: Number(it.price.value), currency: it.price.currency ?? 'USD' }
          : null,
      url: it.itemWebUrl ?? null,
      seller: it.seller?.username ?? null,
      source: 'ebay',
    }));
  }

  private async getToken(): Promise<string> {
    const nowMs = Date.now();
    // Re-use while >60s of life remains, to avoid mid-request expiry.
    if (this.token && this.token.expiresAtMs > nowMs + 60_000) return this.token.value;

    const basic = Buffer.from(`${this.opts.clientId}:${this.opts.clientSecret}`).toString('base64');
    const body = new URLSearchParams({ grant_type: 'client_credentials', scope: this.scope });
    const { data } = await axios.post<EbayTokenResponse>(
      `${this.base}/identity/v1/oauth2/token`,
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
