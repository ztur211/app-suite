import { tokenStore } from './token-store';

/**
 * Core fetch wrapper used by every API call.
 *
 * Sends auth two ways so it works both same-site and cross-site:
 * - `credentials: 'include'` — sends the Better Auth cookie for same-site
 *   hosting / local dev;
 * - `Authorization: Bearer <token>` — for cross-site hosting (web on Vercel,
 *   API on another domain) where the cookie can't be sent. The token is
 *   captured on sign-in (see auth-api.ts) and stored by `tokenStore`.
 *
 * Throws `"<status> <statusText>: <body>"` on a non-2xx response. Returns the
 * raw `Response` so callers can read response headers (e.g. `set-auth-token`).
 */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = tokenStore.get();
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res;
}

/** Thin JSON wrapper over {@link apiFetch}: parses and returns the body. */
export async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(url, init);
  return res.json() as Promise<T>;
}
