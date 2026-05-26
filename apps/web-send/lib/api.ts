import type { Message, MessageChannel, MessageStatus } from './types';

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL ?? 'http://localhost:3001';
const SEND_URL = process.env.EXPO_PUBLIC_SEND_URL ?? 'http://localhost:3006';

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

export interface MessageCreate {
  channel: MessageChannel;
  body: string;
  subject?: string | null;
  recipient?: string | null;
}

export interface MessageUpdate {
  channel?: MessageChannel;
  body?: string;
  subject?: string | null;
  recipient?: string | null;
  status?: MessageStatus;
}

export const messagesApi = {
  list: () => request<Message[]>(`${SEND_URL}/messages`),
  create: (data: MessageCreate) =>
    request<Message>(`${SEND_URL}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, partial: MessageUpdate) =>
    request<Message>(`${SEND_URL}/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(partial),
    }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`${SEND_URL}/messages/${id}`, { method: 'DELETE' }),
};
