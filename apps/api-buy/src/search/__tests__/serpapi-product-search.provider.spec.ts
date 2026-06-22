jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import axios from 'axios';
import { SerpApiProductSearchProvider } from '../serpapi-product-search.provider';

const mockGet = axios.get as jest.Mock;

describe('SerpApiProductSearchProvider (unit)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('searches the google_shopping engine with api_key and num=limit', async () => {
    mockGet.mockResolvedValueOnce({ data: { shopping_results: [] } });
    const provider = new SerpApiProductSearchProvider({ apiKey: 'SK', base: 'https://serp.test' });

    await provider.search('air fryer', { limit: 8 });

    const [url, config] = mockGet.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(url).toBe('https://serp.test/search');
    expect(config.params).toMatchObject({
      engine: 'google_shopping',
      q: 'air fryer',
      api_key: 'SK',
      num: 8,
    });
  });

  it('maps shopping_results (merchant -> seller, extracted_price -> amount)', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        shopping_results: [
          {
            position: 1,
            product_id: 'g123',
            title: 'Ninja Air Fryer',
            price: '$99.99',
            extracted_price: 99.99,
            thumbnail: 'http://img/a.jpg',
            product_link: 'http://google/shop/g123',
            source: 'Walmart',
          },
        ],
      },
    });
    const provider = new SerpApiProductSearchProvider({ apiKey: 'SK', base: 'https://serp.test' });

    const [r] = await provider.search('air fryer');

    expect(r).toEqual({
      id: 'g123',
      title: 'Ninja Air Fryer',
      imageUrl: 'http://img/a.jpg',
      price: { amount: 99.99, currency: 'USD' },
      url: 'http://google/shop/g123',
      seller: 'Walmart',
      source: 'serpapi',
    });
  });

  it('supports a configurable engine and falls back to organic_results', async () => {
    mockGet.mockResolvedValueOnce({
      data: { organic_results: [{ title: 'X', link: 'http://w/x', extracted_price: 5 }] },
    });
    const provider = new SerpApiProductSearchProvider({
      apiKey: 'SK',
      base: 'https://serp.test',
      engine: 'walmart',
    });

    const [r] = await provider.search('x');

    const [, config] = mockGet.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(config.params.engine).toBe('walmart');
    expect(r).toMatchObject({
      title: 'X',
      url: 'http://w/x',
      price: { amount: 5, currency: 'USD' },
    });
  });

  it('returns [] when there are no results', async () => {
    mockGet.mockResolvedValueOnce({ data: {} });
    expect(await new SerpApiProductSearchProvider({ apiKey: 'SK' }).search('x')).toEqual([]);
  });
});
