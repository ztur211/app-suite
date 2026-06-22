jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import axios from 'axios';
import { KrogerProductSearchProvider } from '../kroger-product-search.provider';

const mockGet = axios.get as jest.Mock;
const mockPost = axios.post as jest.Mock;

const token = (t = 'tok', expiresIn = 1800) => ({
  data: { access_token: t, expires_in: expiresIn, token_type: 'bearer' },
});

describe('KrogerProductSearchProvider (unit)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('gets a client-credentials token then searches with locationId + bearer', async () => {
    mockPost.mockResolvedValueOnce(token('ktok'));
    mockGet.mockResolvedValueOnce({ data: { data: [] } });
    const provider = new KrogerProductSearchProvider({
      clientId: 'ci',
      clientSecret: 'cs',
      base: 'https://kr.test',
      locationId: '01400943',
    });

    await provider.search('milk', { limit: 5 });

    const [turl, tbody, tcfg] = mockPost.mock.calls[0] as [
      string,
      string,
      { headers: Record<string, string> },
    ];
    expect(turl).toBe('https://kr.test/v1/connect/oauth2/token');
    expect(String(tbody)).toContain('grant_type=client_credentials');
    expect(tcfg.headers.Authorization).toBe(`Basic ${Buffer.from('ci:cs').toString('base64')}`);

    const [surl, scfg] = mockGet.mock.calls[0] as [
      string,
      { params: Record<string, unknown>; headers: Record<string, string> },
    ];
    expect(surl).toBe('https://kr.test/v1/products');
    expect(scfg.params).toMatchObject({
      'filter.term': 'milk',
      'filter.limit': 5,
      'filter.locationId': '01400943',
    });
    expect(scfg.headers.Authorization).toBe('Bearer ktok');
  });

  it('maps products (promo price preferred, medium image), brand as seller', async () => {
    mockPost.mockResolvedValueOnce(token());
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            productId: '000111',
            brand: 'Kroger',
            description: '2% Milk',
            images: [
              {
                perspective: 'front',
                sizes: [
                  { size: 'medium', url: 'http://img/m.jpg' },
                  { size: 'large', url: 'http://img/l.jpg' },
                ],
              },
            ],
            items: [{ price: { regular: 3.99, promo: 2.99 } }],
          },
        ],
      },
    });
    const provider = new KrogerProductSearchProvider({
      clientId: 'ci',
      clientSecret: 'cs',
      base: 'https://kr.test',
    });

    const [r] = await provider.search('milk');

    expect(r).toEqual({
      id: '000111',
      title: '2% Milk',
      imageUrl: 'http://img/m.jpg',
      price: { amount: 2.99, currency: 'USD' },
      url: null,
      seller: 'Kroger',
      source: 'kroger',
    });
  });

  it('uses the regular price when promo is 0', async () => {
    mockPost.mockResolvedValueOnce(token());
    mockGet.mockResolvedValueOnce({
      data: {
        data: [{ productId: 'p', description: 'X', items: [{ price: { regular: 5, promo: 0 } }] }],
      },
    });
    const [r] = await new KrogerProductSearchProvider({
      clientId: 'ci',
      clientSecret: 'cs',
    }).search('x');
    expect(r.price).toEqual({ amount: 5, currency: 'USD' });
  });

  it('caches the token across searches', async () => {
    mockPost.mockResolvedValue(token());
    mockGet.mockResolvedValue({ data: { data: [] } });
    const provider = new KrogerProductSearchProvider({ clientId: 'ci', clientSecret: 'cs' });
    await provider.search('a');
    await provider.search('b');
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});
