jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import axios from 'axios';
import { OpenFoodFactsProductSearchProvider } from '../openfoodfacts-product-search.provider';

const mockGet = axios.get as jest.Mock;

describe('OpenFoodFactsProductSearchProvider (unit)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queries the OFF search endpoint with the trimmed term and page size', async () => {
    mockGet.mockResolvedValueOnce({ data: { products: [] } });
    const provider = new OpenFoodFactsProductSearchProvider('https://off.test');

    await provider.search('oat milk', { limit: 5 });

    expect(mockGet).toHaveBeenCalledTimes(1);
    const [url, config] = mockGet.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(url).toBe('https://off.test/cgi/search.pl');
    expect(config.params).toMatchObject({ search_terms: 'oat milk', json: 1, page_size: 5 });
  });

  it('maps OFF products to ProductResult (no price, brand as seller)', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        products: [
          {
            code: '737628064502',
            product_name: 'Oat Milk',
            brands: 'Oatly',
            image_url: 'http://img/1.jpg',
          },
        ],
      },
    });
    const provider = new OpenFoodFactsProductSearchProvider('https://off.test');

    const results = await provider.search('milk');

    expect(results).toEqual([
      {
        id: '737628064502',
        title: 'Oat Milk',
        imageUrl: 'http://img/1.jpg',
        price: null,
        url: 'https://off.test/product/737628064502',
        seller: 'Oatly',
        source: 'openfoodfacts',
      },
    ]);
  });

  it('skips products without a name and respects the limit', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        products: [
          { code: '1', product_name: 'A' },
          { code: '2' }, // no name -> dropped
          { code: '3', product_name: 'C' },
        ],
      },
    });
    const provider = new OpenFoodFactsProductSearchProvider('https://off.test');

    const results = await provider.search('x', { limit: 1 });

    expect(results.map((r) => r.title)).toEqual(['A']);
  });

  it('returns [] when OFF returns no products field', async () => {
    mockGet.mockResolvedValueOnce({ data: {} });
    const provider = new OpenFoodFactsProductSearchProvider('https://off.test');
    expect(await provider.search('x')).toEqual([]);
  });
});
