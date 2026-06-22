import { SearchService } from '../search.service';
import { ProductSearchProvider } from '../product-search.provider';

describe('SearchService (unit)', () => {
  const provider = { search: jest.fn() };
  const service = new SearchService(provider as unknown as ProductSearchProvider);

  beforeEach(() => jest.clearAllMocks());

  it('trims the query and passes the limit through to the provider', async () => {
    provider.search.mockResolvedValueOnce([{ id: '1' }]);

    const result = await service.search('  milk  ', 5);

    expect(provider.search).toHaveBeenCalledWith('milk', { limit: 5 });
    expect(result).toEqual([{ id: '1' }]);
  });

  it('returns [] for an empty / whitespace query without calling the provider', async () => {
    expect(await service.search('   ')).toEqual([]);
    expect(await service.search('')).toEqual([]);
    expect(provider.search).not.toHaveBeenCalled();
  });
});
