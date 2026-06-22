import { createHash } from 'node:crypto';
import axios from 'axios';
import {
  ProductSearchProvider,
  type ProductResult,
  type ProductSearchOpts,
} from './product-search.provider';

/**
 * AliExpress affiliate API (Taobao Open Platform gateway). Auth is a signed
 * request: every call carries app_key + a `sign` computed from the app secret.
 * Requires affiliate-program approval for the App Key/Secret.
 *
 * NOTE: the signing here follows the documented TOP MD5 scheme; verify against
 * a live key before relying on it (it can't be exercised end-to-end in CI).
 * Docs: https://openservice.aliexpress.com/doc/api.htm (aliexpress.affiliate.product.query)
 */
interface AeProduct {
  product_id?: number | string;
  product_title?: string;
  product_main_image_url?: string;
  target_sale_price?: string | number;
  target_sale_price_currency?: string;
  product_detail_url?: string;
  second_level_category_name?: string;
  first_level_category_name?: string;
}
interface AeResponse {
  aliexpress_affiliate_product_query_response?: {
    resp_result?: { result?: { products?: { product?: AeProduct[] } } };
  };
}

const DEFAULT_BASE = 'https://gw.api.taobao.com/router/rest';

/** TOP signature: MD5(secret + sorted(key+value concat) + secret), uppercase hex. */
export function signTop(params: Record<string, string>, secret: string): string {
  const base = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join('');
  return createHash('md5').update(`${secret}${base}${secret}`, 'utf8').digest('hex').toUpperCase();
}

/** TOP timestamp: "yyyy-MM-dd HH:mm:ss" in GMT+8. */
function topTimestamp(d: Date): string {
  return new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
}

export class AliexpressProductSearchProvider extends ProductSearchProvider {
  constructor(
    private readonly opts: {
      appKey: string;
      appSecret: string;
      base?: string;
      trackingId?: string;
      now?: () => Date;
    },
  ) {
    super();
  }

  async search(query: string, opts: ProductSearchOpts = {}): Promise<ProductResult[]> {
    const limit = opts.limit ?? 10;
    const now = (this.opts.now ?? (() => new Date()))();
    const params: Record<string, string> = {
      app_key: this.opts.appKey,
      method: 'aliexpress.affiliate.product.query',
      sign_method: 'md5',
      timestamp: topTimestamp(now),
      format: 'json',
      v: '2.0',
      keywords: query,
      page_no: '1',
      page_size: String(limit),
      target_currency: 'USD',
      target_language: 'EN',
      ...(this.opts.trackingId ? { tracking_id: this.opts.trackingId } : {}),
    };
    params.sign = signTop(params, this.opts.appSecret);

    const { data } = await axios.get<AeResponse>(this.opts.base ?? DEFAULT_BASE, {
      params,
      timeout: 10_000,
    });

    const products =
      data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ??
      [];
    return products.map((p) => ({
      id: String(p.product_id ?? ''),
      title: p.product_title ?? '',
      imageUrl: p.product_main_image_url ?? null,
      price:
        p.target_sale_price != null
          ? { amount: Number(p.target_sale_price), currency: p.target_sale_price_currency ?? 'USD' }
          : null,
      url: p.product_detail_url ?? null,
      seller: p.second_level_category_name ?? p.first_level_category_name ?? null,
      source: 'aliexpress',
    }));
  }
}
