#!/usr/bin/env node
/* eslint-disable no-console -- this is a CLI script; stdout is its output. */
// Post-deploy smoke test (foundation spec §9.2): hit every service's health
// endpoint over its public URL and fail loudly if any is down. Run by
// .github/workflows/deploy.yml after `docker compose up`, and usable locally:
//
//   THINGS_DOMAIN=things.app node scripts/smoke.mjs
//   node scripts/smoke.mjs --base http://localhost   # against a local stack
//
// API services expose GET /health -> { status: "ok", service: "<name>" };
// web services (nginx) expose GET /healthz -> "ok".

const args = process.argv.slice(2);
const baseFlagIdx = args.indexOf('--base');
const base = baseFlagIdx !== -1 ? args[baseFlagIdx + 1] : null;
const domain = process.env.THINGS_DOMAIN;

if (!base && !domain) {
  console.error('Set THINGS_DOMAIN=<domain> or pass --base <url>.');
  process.exit(2);
}

const API_APPS = ['do', 'say', 'buy', 'eat', 'send'];

/** @type {{ name: string, url: string, path: string }[]} */
const targets = [];

if (base) {
  // Local/staging: everything behind one host (ports differ per service).
  const apiPorts = { auth: 3001, do: 3002, say: 3003, buy: 3004, eat: 3005, send: 3006 };
  for (const [app, port] of Object.entries(apiPorts)) {
    targets.push({ name: `api-${app}`, url: `${base}:${port}/health`, path: '/health' });
  }
} else {
  targets.push({ name: 'api-auth', url: `https://auth.${domain}/health`, path: '/health' });
  for (const app of API_APPS) {
    targets.push({
      name: `api-${app}`,
      url: `https://api.${app}.${domain}/health`,
      path: '/health',
    });
    targets.push({ name: `web-${app}`, url: `https://${app}.${domain}/healthz`, path: '/healthz' });
  }
}

async function check({ name, url }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'manual' });
    const ok = res.status >= 200 && res.status < 400;
    return { name, url, ok, detail: `HTTP ${res.status}` };
  } catch (err) {
    return { name, url, ok: false, detail: err.name === 'AbortError' ? 'timeout' : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

const results = await Promise.all(targets.map(check));

let failed = 0;
for (const r of results) {
  const mark = r.ok ? '✅' : '❌';
  if (!r.ok) failed++;
  console.log(`${mark} ${r.name.padEnd(10)} ${r.detail.padEnd(10)} ${r.url}`);
}

console.log(`\n${results.length - failed}/${results.length} healthy`);
if (failed > 0) {
  console.error(`Smoke test FAILED: ${failed} endpoint(s) unhealthy.`);
  process.exit(1);
}
console.log('Smoke test passed.');
