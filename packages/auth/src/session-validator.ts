/**
 * Minimal interface representing the subset of Better Auth's `auth` object
 * needed for session validation. Other apps pass in their local `auth`
 * instance — this avoids importing Better Auth directly into every consumer.
 */
export interface AuthApiLike {
  api: {
    getSession(opts: { headers: Headers }): Promise<{
      user: { id: string };
      session: { id: string };
    } | null>;
  };
}

export interface SessionInfo {
  userId: string;
  sessionId: string;
}

/**
 * Validates a session from an HTTP cookie header.
 *
 * Call this in any NestJS app that shares the `things_auth` database.
 * Pass in the app's local `auth` instance (created via `betterAuth()`).
 *
 * Returns `null` when:
 * - `cookieHeader` is undefined or empty
 * - Better Auth finds no valid session for the token
 *
 * Throws when Better Auth throws (e.g. DB error) — let the caller decide
 * whether to treat that as a 401 or a 503.
 */
export async function validateSessionFromCookie(
  cookieHeader: string | undefined,
  auth: AuthApiLike,
): Promise<SessionInfo | null> {
  if (!cookieHeader) return null;

  const session = await auth.api.getSession({
    headers: new Headers({ cookie: cookieHeader }),
  });

  if (!session) return null;

  return { userId: session.user.id, sessionId: session.session.id };
}
