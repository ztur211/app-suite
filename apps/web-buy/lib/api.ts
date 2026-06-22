import { apiRequest } from '@things/web-kit';
import type { ProductResult, ShoppingItem } from './types';

const BUY_URL = process.env.EXPO_PUBLIC_BUY_URL ?? 'http://localhost:3004';

export interface ItemUpdate {
  title?: string;
  quantity?: number | null;
  notes?: string | null;
  status?: 'active' | 'bought';
}

export interface ItemCreate {
  title: string;
  quantity?: number | null;
  notes?: string | null;
}

export const itemsApi = {
  list: () => apiRequest<ShoppingItem[]>(`${BUY_URL}/items`),
  create: (data: ItemCreate) =>
    apiRequest<ShoppingItem>(`${BUY_URL}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, partial: ItemUpdate) =>
    apiRequest<ShoppingItem>(`${BUY_URL}/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(partial),
    }),
  remove: (id: string) =>
    apiRequest<{ ok: boolean }>(`${BUY_URL}/items/${id}`, { method: 'DELETE' }),
  sync: () =>
    apiRequest<{ created: number; consumed: number }>(`${BUY_URL}/sync`, { method: 'POST' }),
  search: (query: string, limit?: number) =>
    apiRequest<ProductResult[]>(`${BUY_URL}/items/search`, {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    }),
};
