jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import axios from 'axios';
import { EbayProductSearchProvider } from '../ebay-product-search.provider';

const mockGet = axios.get as jest.Mock;
const mockPost = axios.post as jest.Mock;

const opts = { clientId: 'cid', clientSecret: 'secret', base: 'https://ebay.test' };

function tokenResponse(token = 'tok-123', expiresIn = 7200) {
  return { data: { access_token: token, expires_in: expiresIn } };
}

describe('EbayProductSearchProvider (unit)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches an app token (client_credentials + Basic auth) then searches and maps results', async () => {
    mockPost.mockResolvedValueOnce(tokenResponse('tok-abc'));
    mockGet.mockResolvedValueOnce({
      data: {
        itemSummaries: [
          {
            itemId: 'v1|123|0',
            title: 'Sony Headphones',
            image: { imageUrl: 'http://img/h.jpg' },
            price: { value: '99.95', currency: 'USD' },
            itemWebUrl: 'http://ebay/itm/123',
            seller: { username: 'audio_store' },
          },
        ],
      },
    });
    const provider = new EbayProductSearchProvider(opts);

    const results = await provider.search('headphones', { limit: 10 });

    const [tokenUrl, tokenBody, tokenCfg] = mockPost.mock.calls[0] as [
      string,
      string,
      { headers: Record<string, string> },
    ];
    expect(tokenUrl).toBe('https://ebay.test/identity/v1/oauth2/token');
    expect(String(tokenBody)).toContain('grant_type=client_credentials');
    expect(tokenCfg.headers.Authorization).toBe(
      `Basic ${Buffer.from('cid:secret').toString('base64')}`,
    );

    const [searchUrl, searchCfg] = mockGet.mock.calls[0] as [
      string,
      { params: Record<string, unknown>; headers: Record<string, string> },
    ];
    expect(searchUrl).toBe('https://ebay.test/buy/browse/v1/item_summary/search');
    expect(searchCfg.params).toMatchObject({ q: 'headphones', limit: 10 });
    expect(searchCfg.headers.Authorization).toBe('Bearer tok-abc');

    expect(results).toEqual([
      {
        id: 'v1|123|0',
        title: 'Sony Headphones',
        imageUrl: 'http://img/h.jpg',
        price: { amount: 99.95, currency: 'USD' },
        url: 'http://ebay/itm/123',
        seller: 'audio_store',
        source: 'ebay',
      },
    ]);
  });

  it('caches the app token across searches (one token fetch, two searches)', async () => {
    mockPost.mockResolvedValue(tokenResponse());
    mockGet.mockResolvedValue({ data: { itemSummaries: [] } });
    const provider = new EbayProductSearchProvider(opts);

    await provider.search('a');
    await provider.search('b');

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('handles items missing price / image / seller', async () => {
    mockPost.mockResolvedValueOnce(tokenResponse());
    mockGet.mockResolvedValueOnce({ data: { itemSummaries: [{ itemId: 'x', title: 'Bare' }] } });
    const provider = new EbayProductSearchProvider(opts);

    const [r] = await provider.search('bare');

    expect(r).toMatchObject({ id: 'x', title: 'Bare', imageUrl: null, price: null, seller: null });
  });
});
