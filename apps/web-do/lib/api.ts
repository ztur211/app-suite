import type { Task, User } from './types';

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

export interface TaskUpdate {
  title?: string;
  /** ISO 8601 string to set, null to clear, undefined to leave unchanged. */
  dueAt?: string | null;
  completed?: boolean;
}

export const tasksApi = {
  list: () => request<Task[]>(`${DO_URL}/tasks`),
  create: (title: string, dueAt?: string) =>
    request<Task>(`${DO_URL}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title, dueAt }),
    }),
  update: (id: string, partial: TaskUpdate) =>
    request<Task>(`${DO_URL}/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(partial),
    }),
  remove: (id: string) => request<{ ok: boolean }>(`${DO_URL}/tasks/${id}`, { method: 'DELETE' }),
};
