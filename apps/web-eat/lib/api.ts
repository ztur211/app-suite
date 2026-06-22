import { apiRequest } from '@things/web-kit';
import type { DiscoveryResult, MealItem, MealKind, MealStatus } from './types';

export type DiscoveryKind = 'recipe' | 'restaurant';

const EAT_URL = process.env.EXPO_PUBLIC_EAT_URL ?? 'http://localhost:3005';

export interface MealCreate {
  name: string;
  kind: MealKind;
  notes?: string | null;
}

export interface MealUpdate {
  name?: string;
  kind?: MealKind;
  notes?: string | null;
  status?: MealStatus;
}

export const mealsApi = {
  list: () => apiRequest<MealItem[]>(`${EAT_URL}/meals`),
  create: (data: MealCreate) =>
    apiRequest<MealItem>(`${EAT_URL}/meals`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, partial: MealUpdate) =>
    apiRequest<MealItem>(`${EAT_URL}/meals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(partial),
    }),
  remove: (id: string) =>
    apiRequest<{ ok: boolean }>(`${EAT_URL}/meals/${id}`, { method: 'DELETE' }),
  sync: () =>
    apiRequest<{ created: number; consumed: number }>(`${EAT_URL}/sync`, { method: 'POST' }),
  search: (query: string, kind: DiscoveryKind, location?: string) =>
    apiRequest<{ kind: DiscoveryKind; results: DiscoveryResult[] }>(`${EAT_URL}/meals/search`, {
      method: 'POST',
      body: JSON.stringify({ query, kind, location }),
    }),
};
