import type { User } from '@things/types';
import { apiRequest } from './request';

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL ?? 'http://localhost:3001';

export const authApi = {
  signUp: (email: string, password: string) =>
    apiRequest<{ user: User }>(`${AUTH_URL}/auth/sign-up/email`, {
      method: 'POST',
      body: JSON.stringify({ email, password, name: email.split('@')[0] }),
    }),
  signIn: (email: string, password: string) =>
    apiRequest<{ user: User }>(`${AUTH_URL}/auth/sign-in/email`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  signOut: () => apiRequest<void>(`${AUTH_URL}/auth/sign-out`, { method: 'POST' }),
  getSession: () => apiRequest<{ user: User } | null>(`${AUTH_URL}/auth/get-session`),
};
