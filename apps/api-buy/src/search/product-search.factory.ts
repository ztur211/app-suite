import { ProductSearchProvider } from './product-search.provider';
import { OpenFoodFactsProductSearchProvider } from './openfoodfacts-product-search.provider';
import { EbayProductSearchProvider } from './ebay-product-search.provider';

/**
 * Choose the active product-search provider from the environment. eBay (real
 * pricing + catalogue) when credentials are present; otherwise the keyless
 * Open Food Facts fallback, so search always works in dev/CI without secrets.
 *
 * Kept out of search.module.ts so it can be unit-tested without dragging in
 * the auth/better-auth import chain.
 */
export function createProductSearchProvider(
  env: Record<string, string | undefined> = process.env,
): ProductSearchProvider {
  const clientId = env['EBAY_CLIENT_ID'];
  const clientSecret = env['EBAY_CLIENT_SECRET'];
  if (clientId && clientSecret) {
    return new EbayProductSearchProvider({
      clientId,
      clientSecret,
      base: env['EBAY_API_BASE'],
      scope: env['EBAY_OAUTH_SCOPE'],
    });
  }
  return new OpenFoodFactsProductSearchProvider(env['OFF_API_BASE']);
}
