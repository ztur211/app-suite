import { Injectable } from '@nestjs/common';
import { ProductSearchProvider, type ProductResult } from './product-search.provider';

@Injectable()
export class SearchService {
  constructor(private readonly provider: ProductSearchProvider) {}

  /** Search external products. Empty queries short-circuit to []. */
  async search(query: string, limit?: number): Promise<ProductResult[]> {
    const q = (query ?? '').trim();
    if (!q) return [];
    return this.provider.search(q, { limit });
  }
}
