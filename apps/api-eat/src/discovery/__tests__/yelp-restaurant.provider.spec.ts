jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import axios from 'axios';
import { YelpRestaurantProvider } from '../yelp-restaurant.provider';

const mockGet = axios.get as jest.Mock;

describe('YelpRestaurantProvider (unit)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('searches with bearer auth and term/location/limit params', async () => {
    mockGet.mockResolvedValueOnce({ data: { businesses: [] } });
    const provider = new YelpRestaurantProvider({
      apiKey: 'yk',
      base: 'https://yelp.test',
      defaultLocation: 'NYC',
    });

    await provider.search('sushi', { limit: 7 });

    const [url, config] = mockGet.mock.calls[0] as [
      string,
      { params: Record<string, unknown>; headers: Record<string, string> },
    ];
    expect(url).toBe('https://yelp.test/v3/businesses/search');
    expect(config.params).toMatchObject({ term: 'sushi', location: 'NYC', limit: 7 });
    expect(config.headers.Authorization).toBe('Bearer yk');
  });

  it('prefers an explicit location over the default', async () => {
    mockGet.mockResolvedValueOnce({ data: { businesses: [] } });
    const provider = new YelpRestaurantProvider({
      apiKey: 'yk',
      base: 'https://yelp.test',
      defaultLocation: 'NYC',
    });

    await provider.search('tacos', { location: 'Austin, TX' });

    const [, config] = mockGet.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(config.params.location).toBe('Austin, TX');
  });

  it('maps businesses to DiscoveryResult with kind=restaurant', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        businesses: [
          {
            id: 'biz1',
            name: 'Sushi Place',
            image_url: 'http://img/s.jpg',
            rating: 4.5,
            price: '$$',
            categories: [{ title: 'Sushi Bars' }],
            location: { display_address: ['1 Main St', 'NYC'] },
            url: 'http://yelp/biz1',
          },
        ],
      },
    });
    const provider = new YelpRestaurantProvider({ apiKey: 'yk', base: 'https://yelp.test' });

    const [r] = await provider.search('sushi');

    expect(r).toEqual({
      id: 'biz1',
      name: 'Sushi Place',
      imageUrl: 'http://img/s.jpg',
      kind: 'restaurant',
      detail: '★ 4.5 · $$ · Sushi Bars · 1 Main St, NYC',
      url: 'http://yelp/biz1',
      source: 'yelp',
    });
  });
});
