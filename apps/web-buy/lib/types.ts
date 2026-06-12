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
