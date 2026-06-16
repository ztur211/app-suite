const WEB_APPS = ['do', 'say', 'buy', 'eat', 'send'] as const;

// Expo dev servers bind 8081 upward; trust the first five for side-by-side local dev.
const devWebOrigins = Array.from({ length: 5 }, (_, i) => `http://localhost:${8081 + i}`);

/**
 * Browser origins allowed to call the APIs (CORS) and trusted by Better Auth.
 *
 * Composed (in order) of:
 * - the prod/local web subdomains (https://{do,say,buy,eat,send}.$THINGS_DOMAIN)
 *   when THINGS_DOMAIN is set;
 * - any absolute origins listed in WEB_ORIGINS (comma-separated) — used for
 *   off-domain hosting such as the Vercel web apps (https://things-do.vercel.app),
 *   which are cross-site to the API and so can't be derived from THINGS_DOMAIN;
 * - the localhost Expo dev origins (always, so `npm run dev` keeps working).
 */
export function trustedWebOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const domain = env['THINGS_DOMAIN'];
  const prod = domain ? WEB_APPS.map((app) => `https://${app}.${domain}`) : [];
  const extra = (env['WEB_ORIGINS'] ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...prod, ...extra, ...devWebOrigins];
}

/**
 * Parent cookie domain for cross-subdomain sessions (e.g. ".things.test").
 * Undefined when AUTH_COOKIE_DOMAIN is unset → Better Auth keeps host-scoped cookies.
 */
export function authCookieDomain(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const d = env['AUTH_COOKIE_DOMAIN'];
  return d && d.length > 0 ? d : undefined;
}
