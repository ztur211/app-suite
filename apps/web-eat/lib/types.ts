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

export interface User {
  id: string;
  email: string;
  name: string | null;
}
