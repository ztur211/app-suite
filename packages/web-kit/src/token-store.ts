/**
 * Session-token storage for cross-site (Bearer) auth.
 *
 * When the web apps are hosted off the API's registrable domain (e.g. on
 * Vercel's `*.vercel.app`), the Better Auth session cookie can't be sent to the
 * API — it's cross-site / third-party and browsers block it. Instead we capture
 * the session token from the `set-auth-token` response header on sign-in/up and
 * send it back as `Authorization: Bearer <token>` (see `request.ts`).
 *
 * Persists to `localStorage` on web, with an in-memory fallback for
 * environments where it's unavailable or throws (SSR, tests, React Native until
 * an AsyncStorage adapter lands).
 */
const KEY = 'things.session-token';

let memory: string | null = null;

export const tokenStore = {
  get(): string | null {
    try {
      return globalThis.localStorage?.getItem(KEY) ?? memory;
    } catch {
      return memory;
    }
  },
  set(token: string): void {
    memory = token;
    try {
      globalThis.localStorage?.setItem(KEY, token);
    } catch {
      /* in-memory only */
    }
  },
  clear(): void {
    memory = null;
    try {
      globalThis.localStorage?.removeItem(KEY);
    } catch {
      /* in-memory only */
    }
  },
};
