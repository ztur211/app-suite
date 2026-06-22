import { createProductSearchProvider } from '../product-search.factory';
import { EbayProductSearchProvider } from '../ebay-product-search.provider';
import { OpenFoodFactsProductSearchProvider } from '../openfoodfacts-product-search.provider';

describe('createProductSearchProvider', () => {
  it('uses eBay when both client id and secret are configured', () => {
    const provider = createProductSearchProvider({ EBAY_CLIENT_ID: 'a', EBAY_CLIENT_SECRET: 'b' });
    expect(provider).toBeInstanceOf(EbayProductSearchProvider);
  });

  it('falls back to Open Food Facts when no eBay creds are set', () => {
    expect(createProductSearchProvider({})).toBeInstanceOf(OpenFoodFactsProductSearchProvider);
  });

  it('requires BOTH id and secret for eBay (id alone falls back)', () => {
    expect(createProductSearchProvider({ EBAY_CLIENT_ID: 'a' })).toBeInstanceOf(
      OpenFoodFactsProductSearchProvider,
    );
  });
});
