import type { ShoppingItem, User } from './types';

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL ?? 'http://localhost:3001';
const BUY_URL = process.env.EXPO_PUBLIC_BUY_URL ?? 'http://localhost:3004';

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const authApi = {
  signUp: (email: string, password: string) =>
    request<{ user: User }>(`${AUTH_URL}/auth/sign-up/email`, {
      method: 'POST',
      body: JSON.stringify({ email, password, name: email.split('@')[0] }),
    }),
  signIn: (email: string, password: string) =>
    request<{ user: User }>(`${AUTH_URL}/auth/sign-in/email`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  signOut: () => request<void>(`${AUTH_URL}/auth/sign-out`, { method: 'POST' }),
  getSession: () => request<{ user: User } | null>(`${AUTH_URL}/auth/get-session`),
};

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
  list: () => request<ShoppingItem[]>(`${BUY_URL}/items`),
  create: (data: ItemCreate) =>
    request<ShoppingItem>(`${BUY_URL}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, partial: ItemUpdate) =>
    request<ShoppingItem>(`${BUY_URL}/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(partial),
    }),
  remove: (id: string) => request<{ ok: boolean }>(`${BUY_URL}/items/${id}`, { method: 'DELETE' }),
  sync: () => request<{ created: number; consumed: number }>(`${BUY_URL}/sync`, { method: 'POST' }),
};
