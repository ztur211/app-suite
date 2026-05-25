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

export interface User {
  id: string;
  email: string;
  name: string | null;
}
