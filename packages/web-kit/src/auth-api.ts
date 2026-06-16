import type { User } from '@things/types';
import { apiFetch, apiRequest } from './request';
import { tokenStore } from './token-store';

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL ?? 'http://localhost:3001';

/**
 * Sign-in and sign-up share a shape: POST credentials, then capture the session
 * token from the `set-auth-token` response header (Better Auth's `bearer`
 * plugin) so later cross-site requests can send it as a Bearer token. The
 * cookie is also set for same-site hosting; either path authenticates.
 */
async function authenticate(path: string, body: object): Promise<{ user: User }> {
  const res = await apiFetch(`${AUTH_URL}${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const token = res.headers.get('set-auth-token');
  if (token) tokenStore.set(token);
  return (await res.json()) as { user: User };
}

export const authApi = {
  signUp: (email: string, password: string) =>
    authenticate('/auth/sign-up/email', { email, password, name: email.split('@')[0] }),
  signIn: (email: string, password: string) =>
    authenticate('/auth/sign-in/email', { email, password }),
  signOut: async (): Promise<void> => {
    try {
      await apiRequest<void>(`${AUTH_URL}/auth/sign-out`, { method: 'POST' });
    } catch {
      // Sign out locally regardless — a failed or expired server call shouldn't
      // strand the client holding a stale token.
    } finally {
      tokenStore.clear();
    }
  },
  getSession: () => apiRequest<{ user: User } | null>(`${AUTH_URL}/auth/get-session`),
};
