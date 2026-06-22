import type { ProductResult } from './types';

const SOURCE_LABELS: Record<string, string> = {
  ebay: 'eBay',
  bestbuy: 'Best Buy',
  etsy: 'Etsy',
  aliexpress: 'AliExpress',
  kroger: 'Kroger',
  openfoodfacts: 'Open Food Facts',
  serpapi: 'Google Shopping',
};

/**
 * Human-readable store/merchant for a search result. Most providers ARE the
 * store (eBay, Best Buy, …). SerpApi aggregates many merchants, so its real
 * store lives in `seller` (e.g. "Walmart") — fall back to "Google Shopping".
 */
export function storeLabel(r: Pick<ProductResult, 'source' | 'seller'>): string {
  if (r.source === 'serpapi') return r.seller || SOURCE_LABELS.serpapi;
  return SOURCE_LABELS[r.source] ?? r.source;
}
