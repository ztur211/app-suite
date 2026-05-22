import type { Task } from './types';

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL ?? 'http://localhost:3001';
const DO_URL = process.env.EXPO_PUBLIC_DO_URL ?? 'http://localhost:3002';

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
    request<{ user: { id: string; email: string; name: string | null } }>(
      `${AUTH_URL}/auth/sign-up/email`,
      {
        method: 'POST',
        body: JSON.stringify({ email, password, name: email.split('@')[0] }),
      },
    ),
  signIn: (email: string, password: string) =>
    request<{ user: { id: string; email: string; name: string | null } }>(
      `${AUTH_URL}/auth/sign-in/email`,
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    ),
  signOut: () => request<void>(`${AUTH_URL}/auth/sign-out`, { method: 'POST' }),
  getSession: () =>
    request<{ user: { id: string; email: string; name: string | null } } | null>(
      `${AUTH_URL}/auth/get-session`,
    ),
};

export const tasksApi = {
  list: () => request<Task[]>(`${DO_URL}/tasks`),
  create: (title: string, dueAt?: string) =>
    request<Task>(`${DO_URL}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title, dueAt }),
    }),
  setCompleted: (id: string, completed: boolean) =>
    request<Task>(`${DO_URL}/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),
  remove: (id: string) => request<{ ok: boolean }>(`${DO_URL}/tasks/${id}`, { method: 'DELETE' }),
};
