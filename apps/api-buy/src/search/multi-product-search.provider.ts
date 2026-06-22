import {
  ProductSearchProvider,
  type ProductResult,
  type ProductSearchOpts,
} from './product-search.provider';

/**
 * Fans a query out to several providers concurrently and merges the results.
 * Uses allSettled so one slow/broken/misconfigured store can't break the
 * search — its results are simply omitted. Results are interleaved round-robin
 * so no single store dominates the top of the list, then capped at the limit.
 */
export class MultiProductSearchProvider extends ProductSearchProvider {
  constructor(private readonly providers: ProductSearchProvider[]) {
    super();
  }

  async search(query: string, opts: ProductSearchOpts = {}): Promise<ProductResult[]> {
    const limit = opts.limit ?? 10;
    const settled = await Promise.allSettled(this.providers.map((p) => p.search(query, { limit })));
    const lists = settled
      .filter((s): s is PromiseFulfilledResult<ProductResult[]> => s.status === 'fulfilled')
      .map((s) => s.value);
    return interleave(lists).slice(0, limit);
  }
}

function interleave(lists: ProductResult[][]): ProductResult[] {
  const out: ProductResult[] = [];
  const longest = lists.reduce((m, l) => Math.max(m, l.length), 0);
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      if (i < list.length) out.push(list[i]);
    }
  }
  return out;
}
