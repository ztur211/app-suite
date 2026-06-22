/**
 * Provider seam for external product search. Concrete adapters (Open Food
 * Facts, eBay, …) live alongside this file; the active one is chosen by
 * `search.module.ts` based on which credentials are configured.
 *
 * The abstract class doubles as the Nest DI token (like `SaySdk`/`AiClient`),
 * so tests can swap in a fake via `.overrideProvider(ProductSearchProvider)`.
 */

/** A single normalized product hit, provider-agnostic. */
export interface ProductResult {
  /** Stable id from the source (sku/code/itemId), falls back to title. */
  id: string;
  title: string;
  imageUrl: string | null;
  /** null when the source has no pricing (e.g. Open Food Facts). */
  price: { amount: number; currency: string } | null;
  /** Link to the product page, when available. */
  url: string | null;
  /** Brand or seller, when available. */
  seller: string | null;
  /** Which provider produced this result ('openfoodfacts' | 'ebay' | …). */
  source: string;
}

export interface ProductSearchOpts {
  /** Max results to return. Adapters default to 10. */
  limit?: number;
}

export abstract class ProductSearchProvider {
  abstract search(query: string, opts?: ProductSearchOpts): Promise<ProductResult[]>;
}
