import { MultiProductSearchProvider } from '../multi-product-search.provider';
import { ProductSearchProvider, type ProductResult } from '../product-search.provider';

function fake(results: ProductResult[] | Error): ProductSearchProvider {
  return {
    search: jest.fn(async () => {
      if (results instanceof Error) throw results;
      return results;
    }),
  } as unknown as ProductSearchProvider;
}

const r = (id: string): ProductResult => ({
  id,
  title: id,
  imageUrl: null,
  price: null,
  url: null,
  seller: null,
  source: 's',
});

describe('MultiProductSearchProvider (unit)', () => {
  it('runs providers in parallel and interleaves their results (round-robin)', async () => {
    const a = fake([r('a1'), r('a2')]);
    const b = fake([r('b1'), r('b2')]);
    const out = await new MultiProductSearchProvider([a, b]).search('q', { limit: 10 });
    expect(out.map((x) => x.id)).toEqual(['a1', 'b1', 'a2', 'b2']);
  });

  it('caps the merged results at the limit', async () => {
    const a = fake([r('a1'), r('a2'), r('a3')]);
    const b = fake([r('b1'), r('b2'), r('b3')]);
    const out = await new MultiProductSearchProvider([a, b]).search('q', { limit: 3 });
    expect(out.map((x) => x.id)).toEqual(['a1', 'b1', 'a2']);
  });

  it('skips a failing provider and returns the rest', async () => {
    const a = fake(new Error('down'));
    const b = fake([r('b1')]);
    const out = await new MultiProductSearchProvider([a, b]).search('q');
    expect(out.map((x) => x.id)).toEqual(['b1']);
  });

  it('passes the limit through to each provider', async () => {
    const a = fake([r('a1')]);
    await new MultiProductSearchProvider([a]).search('q', { limit: 4 });
    expect(a.search).toHaveBeenCalledWith('q', { limit: 4 });
  });
});
