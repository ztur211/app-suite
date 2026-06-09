const WEB_APPS = ['do', 'say', 'buy', 'eat', 'send'] as const;

// Expo dev servers bind 8081 upward; trust the first five for side-by-side local dev.
const devWebOrigins = Array.from({ length: 5 }, (_, i) => `http://localhost:${8081 + i}`);

/**
 * Browser origins allowed to call the APIs (CORS) and trusted by Better Auth.
 * Always includes the localhost Expo dev origins; adds the prod/local web
 * subdomains (https://{do,say,buy,eat,send}.$THINGS_DOMAIN) when THINGS_DOMAIN is set.
 */
export function trustedWebOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const domain = env['THINGS_DOMAIN'];
  const prod = domain ? WEB_APPS.map((app) => `https://${app}.${domain}`) : [];
  return [...prod, ...devWebOrigins];
}

/**
 * Parent cookie domain for cross-subdomain sessions (e.g. ".things.test").
 * Undefined when AUTH_COOKIE_DOMAIN is unset → Better Auth keeps host-scoped cookies.
 */
export function authCookieDomain(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const d = env['AUTH_COOKIE_DOMAIN'];
  return d && d.length > 0 ? d : undefined;
}
