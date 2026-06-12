/** A signed-in user as surfaced by Better Auth's session/auth endpoints. */
export interface User {
  id: string;
  email: string;
  name: string | null;
}
