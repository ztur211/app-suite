import { createProductSearchProvider } from '../product-search.factory';
import { EbayProductSearchProvider } from '../ebay-product-search.provider';
import { BestBuyProductSearchProvider } from '../bestbuy-product-search.provider';
import { OpenFoodFactsProductSearchProvider } from '../openfoodfacts-product-search.provider';
import { SerpApiProductSearchProvider } from '../serpapi-product-search.provider';
import { MultiProductSearchProvider } from '../multi-product-search.provider';

describe('createProductSearchProvider', () => {
  it('falls back to keyless Open Food Facts when nothing is configured', () => {
    expect(createProductSearchProvider({})).toBeInstanceOf(OpenFoodFactsProductSearchProvider);
  });

  it('uses the single configured provider directly (no merge wrapper)', () => {
    expect(createProductSearchProvider({ BESTBUY_API_KEY: 'k' })).toBeInstanceOf(
      BestBuyProductSearchProvider,
    );
  });

  it('eBay and AliExpress each require BOTH halves of their credentials', () => {
    expect(createProductSearchProvider({ EBAY_CLIENT_ID: 'a' })).toBeInstanceOf(
      OpenFoodFactsProductSearchProvider,
    );
    expect(createProductSearchProvider({ ALIEXPRESS_APP_KEY: 'a' })).toBeInstanceOf(
      OpenFoodFactsProductSearchProvider,
    );
    expect(
      createProductSearchProvider({ EBAY_CLIENT_ID: 'a', EBAY_CLIENT_SECRET: 'b' }),
    ).toBeInstanceOf(EbayProductSearchProvider);
  });

  it('merges when multiple stores are configured', () => {
    const provider = createProductSearchProvider({ BESTBUY_API_KEY: 'k', ETSY_API_KEY: 'e' });
    expect(provider).toBeInstanceOf(MultiProductSearchProvider);
  });

  it('includes Kroger (needs both halves) and SerpApi when configured', () => {
    expect(createProductSearchProvider({ KROGER_CLIENT_ID: 'c' })).toBeInstanceOf(
      OpenFoodFactsProductSearchProvider,
    );
    expect(createProductSearchProvider({ SERPAPI_KEY: 's' })).toBeInstanceOf(
      SerpApiProductSearchProvider,
    );
    expect(
      createProductSearchProvider({
        KROGER_CLIENT_ID: 'c',
        KROGER_CLIENT_SECRET: 's',
        SERPAPI_KEY: 'k',
      }),
    ).toBeInstanceOf(MultiProductSearchProvider);
  });
});
