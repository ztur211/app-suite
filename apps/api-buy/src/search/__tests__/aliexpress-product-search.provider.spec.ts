jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import { createHash } from 'node:crypto';
import axios from 'axios';
import { AliexpressProductSearchProvider, signTop } from '../aliexpress-product-search.provider';

const mockGet = axios.get as jest.Mock;

describe('signTop', () => {
  it('is MD5(secret + alphabetised key+value + secret), uppercase hex', () => {
    const params = { b: '2', a: '1' };
    const expected = createHash('md5').update('SECa1b2SEC').digest('hex').toUpperCase();
    expect(signTop(params, 'SEC')).toBe(expected);
    expect(signTop(params, 'SEC')).toMatch(/^[0-9A-F]{32}$/);
  });
});

describe('AliexpressProductSearchProvider (unit)', () => {
  beforeEach(() => jest.clearAllMocks());

  const opts = {
    appKey: 'AK',
    appSecret: 'AS',
    base: 'https://ae.test/sync',
    now: () => new Date('2026-06-01T00:00:00Z'),
  };

  it('calls the gateway with correctly-signed product.query params', async () => {
    mockGet.mockResolvedValueOnce({ data: {} });

    await new AliexpressProductSearchProvider(opts).search('headphones', { limit: 5 });

    const [url, config] = mockGet.mock.calls[0] as [string, { params: Record<string, string> }];
    expect(url).toBe('https://ae.test/sync');
    expect(config.params).toMatchObject({
      app_key: 'AK',
      method: 'aliexpress.affiliate.product.query',
      sign_method: 'md5',
      format: 'json',
      v: '2.0',
      keywords: 'headphones',
      page_size: '5',
    });
    // The attached signature matches a fresh signTop over the other params.
    const { sign, ...rest } = config.params;
    expect(sign).toBe(signTop(rest, 'AS'));
  });

  it('maps the nested product response', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        aliexpress_affiliate_product_query_response: {
          resp_result: {
            result: {
              products: {
                product: [
                  {
                    product_id: 100,
                    product_title: 'BT Headphones',
                    product_main_image_url: 'http://img/h.jpg',
                    target_sale_price: '19.99',
                    target_sale_price_currency: 'USD',
                    product_detail_url: 'http://ae/i/100',
                    second_level_category_name: 'Audio',
                  },
                ],
              },
            },
          },
        },
      },
    });

    const [r] = await new AliexpressProductSearchProvider(opts).search('headphones');

    expect(r).toEqual({
      id: '100',
      title: 'BT Headphones',
      imageUrl: 'http://img/h.jpg',
      price: { amount: 19.99, currency: 'USD' },
      url: 'http://ae/i/100',
      seller: 'Audio',
      source: 'aliexpress',
    });
  });

  it('returns [] when the response carries no products', async () => {
    mockGet.mockResolvedValueOnce({ data: {} });
    expect(await new AliexpressProductSearchProvider(opts).search('x')).toEqual([]);
  });
});
