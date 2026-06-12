import type { MealItem, MealKind, MealStatus, User } from './types';

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL ?? 'http://localhost:3001';
const EAT_URL = process.env.EXPO_PUBLIC_EAT_URL ?? 'http://localhost:3005';

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
  list: () => request<MealItem[]>(`${EAT_URL}/meals`),
  create: (data: MealCreate) =>
    request<MealItem>(`${EAT_URL}/meals`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, partial: MealUpdate) =>
    request<MealItem>(`${EAT_URL}/meals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(partial),
    }),
  remove: (id: string) => request<{ ok: boolean }>(`${EAT_URL}/meals/${id}`, { method: 'DELETE' }),
  sync: () => request<{ created: number; consumed: number }>(`${EAT_URL}/sync`, { method: 'POST' }),
};
