jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import axios from 'axios';
import { EtsyProductSearchProvider } from '../etsy-product-search.provider';

const mockGet = axios.get as jest.Mock;

describe('EtsyProductSearchProvider (unit)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GETs active listings with x-api-key, keywords, limit, includes=Images', async () => {
    mockGet.mockResolvedValueOnce({ data: { count: 0, results: [] } });
    const provider = new EtsyProductSearchProvider({ apiKey: 'EK', base: 'https://etsy.test' });

    await provider.search('vintage lamp', { limit: 7 });

    const [url, config] = mockGet.mock.calls[0] as [
      string,
      { params: Record<string, unknown>; headers: Record<string, string> },
    ];
    expect(url).toBe('https://etsy.test/v3/application/listings/active');
    expect(config.params).toMatchObject({ keywords: 'vintage lamp', limit: 7, includes: 'Images' });
    expect(config.headers['x-api-key']).toBe('EK');
  });

  it('maps listings (price = amount/divisor) and the first image', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        count: 1,
        results: [
          {
            listing_id: 555,
            title: 'Vintage Lamp',
            url: 'http://etsy/l/555',
            price: { amount: 4500, divisor: 100, currency_code: 'USD' },
            images: [{ url_570xN: 'http://img/570.jpg', url_fullxfull: 'http://img/full.jpg' }],
          },
        ],
      },
    });
    const provider = new EtsyProductSearchProvider({ apiKey: 'EK', base: 'https://etsy.test' });

    const [r] = await provider.search('lamp');

    expect(r).toEqual({
      id: '555',
      title: 'Vintage Lamp',
      imageUrl: 'http://img/570.jpg',
      price: { amount: 45, currency: 'USD' },
      url: 'http://etsy/l/555',
      seller: null,
      source: 'etsy',
    });
  });

  it('handles a listing without images or price', async () => {
    mockGet.mockResolvedValueOnce({
      data: { results: [{ listing_id: 9, title: 'Bare', url: 'http://e/9' }] },
    });
    const provider = new EtsyProductSearchProvider({ apiKey: 'EK' });
    const [r] = await provider.search('bare');
    expect(r).toMatchObject({ id: '9', title: 'Bare', imageUrl: null, price: null });
  });
});
