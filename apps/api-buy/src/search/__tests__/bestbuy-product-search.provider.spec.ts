jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import axios from 'axios';
import { BestBuyProductSearchProvider } from '../bestbuy-product-search.provider';

const mockGet = axios.get as jest.Mock;

describe('BestBuyProductSearchProvider (unit)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds the products(search=...) path (one search= per term) with apiKey/pageSize/show', async () => {
    mockGet.mockResolvedValueOnce({ data: { products: [] } });
    const provider = new BestBuyProductSearchProvider({ apiKey: 'KEY', base: 'https://bb.test' });

    await provider.search('macbook pro', { limit: 5 });

    const [url, config] = mockGet.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(url).toBe('https://bb.test/v1/products(search=macbook&search=pro)');
    expect(config.params).toMatchObject({ apiKey: 'KEY', format: 'json', pageSize: 5 });
  });

  it('maps products to ProductResult', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        products: [
          {
            sku: 1234,
            name: 'MacBook Pro',
            salePrice: 1999.99,
            image: 'http://img/m.jpg',
            url: 'http://bb/p/1234',
            manufacturer: 'Apple',
          },
        ],
      },
    });
    const provider = new BestBuyProductSearchProvider({ apiKey: 'KEY', base: 'https://bb.test' });

    const [r] = await provider.search('macbook');

    expect(r).toEqual({
      id: '1234',
      title: 'MacBook Pro',
      imageUrl: 'http://img/m.jpg',
      price: { amount: 1999.99, currency: 'USD' },
      url: 'http://bb/p/1234',
      seller: 'Apple',
      source: 'bestbuy',
    });
  });

  it('handles products missing price/image/manufacturer', async () => {
    mockGet.mockResolvedValueOnce({ data: { products: [{ sku: 9, name: 'Bare' }] } });
    const provider = new BestBuyProductSearchProvider({ apiKey: 'KEY' });
    const [r] = await provider.search('bare');
    expect(r).toMatchObject({ id: '9', title: 'Bare', imageUrl: null, price: null, seller: null });
  });
});
