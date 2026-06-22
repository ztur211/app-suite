import { storeLabel } from '../lib/stores';

describe('storeLabel', () => {
  it('maps known providers to friendly store names', () => {
    expect(storeLabel({ source: 'bestbuy', seller: 'Apple' })).toBe('Best Buy');
    expect(storeLabel({ source: 'ebay', seller: 'a_seller' })).toBe('eBay');
    expect(storeLabel({ source: 'etsy', seller: null })).toBe('Etsy');
    expect(storeLabel({ source: 'kroger', seller: 'Kroger' })).toBe('Kroger');
    expect(storeLabel({ source: 'aliexpress', seller: null })).toBe('AliExpress');
    expect(storeLabel({ source: 'openfoodfacts', seller: 'Oatly' })).toBe('Open Food Facts');
  });

  it('uses the merchant (seller) for SerpApi aggregated results', () => {
    expect(storeLabel({ source: 'serpapi', seller: 'Walmart' })).toBe('Walmart');
    expect(storeLabel({ source: 'serpapi', seller: 'Target' })).toBe('Target');
    expect(storeLabel({ source: 'serpapi', seller: null })).toBe('Google Shopping');
  });

  it('falls back to the raw source when unknown', () => {
    expect(storeLabel({ source: 'mystery', seller: null })).toBe('mystery');
  });
});
