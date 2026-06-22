export type { User } from '@things/types';

export interface ShoppingItem {
  id: string;
  userId: string;
  title: string;
  quantity: number | null;
  notes: string | null;
  status: 'active' | 'bought';
  sourceDictationId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A product hit returned by POST /items/search (provider-agnostic). */
export interface ProductResult {
  id: string;
  title: string;
  imageUrl: string | null;
  price: { amount: number; currency: string } | null;
  url: string | null;
  seller: string | null;
  source: string;
}
