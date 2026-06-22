import { ProductSearchProvider } from './product-search.provider';
import { OpenFoodFactsProductSearchProvider } from './openfoodfacts-product-search.provider';
import { EbayProductSearchProvider } from './ebay-product-search.provider';
import { BestBuyProductSearchProvider } from './bestbuy-product-search.provider';
import { EtsyProductSearchProvider } from './etsy-product-search.provider';
import { AliexpressProductSearchProvider } from './aliexpress-product-search.provider';
import { MultiProductSearchProvider } from './multi-product-search.provider';

/**
 * Compose the active product-search provider from the environment. Every store
 * whose credentials are present is included and their results are merged
 * (MultiProductSearchProvider). With nothing configured it falls back to the
 * keyless Open Food Facts, so search always works in dev/CI without secrets.
 *
 * Kept out of search.module.ts so it stays unit-testable without dragging in
 * the auth/better-auth import chain.
 */
export function createProductSearchProvider(
  env: Record<string, string | undefined> = process.env,
): ProductSearchProvider {
  const providers: ProductSearchProvider[] = [];

  if (env['EBAY_CLIENT_ID'] && env['EBAY_CLIENT_SECRET']) {
    providers.push(
      new EbayProductSearchProvider({
        clientId: env['EBAY_CLIENT_ID'],
        clientSecret: env['EBAY_CLIENT_SECRET'],
        base: env['EBAY_API_BASE'],
        scope: env['EBAY_OAUTH_SCOPE'],
      }),
    );
  }
  if (env['BESTBUY_API_KEY']) {
    providers.push(
      new BestBuyProductSearchProvider({
        apiKey: env['BESTBUY_API_KEY'],
        base: env['BESTBUY_API_BASE'],
      }),
    );
  }
  if (env['ETSY_API_KEY']) {
    providers.push(
      new EtsyProductSearchProvider({ apiKey: env['ETSY_API_KEY'], base: env['ETSY_API_BASE'] }),
    );
  }
  if (env['ALIEXPRESS_APP_KEY'] && env['ALIEXPRESS_APP_SECRET']) {
    providers.push(
      new AliexpressProductSearchProvider({
        appKey: env['ALIEXPRESS_APP_KEY'],
        appSecret: env['ALIEXPRESS_APP_SECRET'],
        base: env['ALIEXPRESS_API_BASE'],
        trackingId: env['ALIEXPRESS_TRACKING_ID'],
      }),
    );
  }

  if (providers.length === 0) return new OpenFoodFactsProductSearchProvider(env['OFF_API_BASE']);
  if (providers.length === 1) return providers[0];
  return new MultiProductSearchProvider(providers);
}
