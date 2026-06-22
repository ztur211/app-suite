export type { User } from '@things/types';

export type MealKind = 'recipe' | 'restaurant' | 'either';
export type MealStatus = 'active' | 'tried';

export interface MealItem {
  id: string;
  userId: string;
  name: string;
  kind: MealKind;
  notes: string | null;
  status: MealStatus;
  sourceDictationId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A recipe/restaurant hit returned by POST /meals/search. */
export interface DiscoveryResult {
  id: string;
  name: string;
  imageUrl: string | null;
  kind: 'recipe' | 'restaurant';
  detail: string | null;
  url: string | null;
  source: string;
}
