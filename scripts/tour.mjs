#!/usr/bin/env node
/* eslint-disable no-console -- this is a CLI script; stdout is its output. */
// App-to-app tour: drive a real (headed) browser through the five deployed
// Things web apps in sequence, logging in once and confirming the session
// carries to every app. A watchable post-deploy walkthrough / acceptance check
// for the Vercel web deploy (see infra/VERCEL.md).
//
//   TOUR_EMAIL=you@example.com TOUR_PASSWORD=… node scripts/tour.mjs
//   node scripts/tour.mjs --seconds 90 --shots ./tour-shots
//   node scripts/tour.mjs --headless          # CI / no display
//   node scripts/tour.mjs --dry-run           # print the plan, launch nothing
//
// Why "log in once, verify it carries" is implemented by *re-seeding* the token:
// web on Vercel is cross-site to the API, so auth is a Bearer token kept in
// `localStorage['things.session-token']` — which is PER ORIGIN. Each app is its
// own Vercel origin (things-do…, things-say…), and there is no SSO redirect
// handoff between web apps (by design — only web↔API is cross-site). So the
// meaningful, true claim this tour verifies is: ONE session token, captured by
// logging into the first app, is accepted as a valid credential by ALL FIVE
// apps' shared auth backend. We capture it on Do's login, seed it into each
// later origin, load the app, and assert its boot `get-session` returns the
// user (and no login form appears). That is exactly what cross-site Bearer auth
// promises; we don't fake an SSO handoff that the apps don't implement.

import { pathToFileURL } from 'node:url';

// ── Pure, unit-tested helpers ───────────────────────────────────────────────

/** The suite, in canonical order (CLAUDE.md): single-syllable verb + "Things". */
export const SUITE = [
  { slug: 'do', name: 'Do Things' },
  { slug: 'say', name: 'Say Things' },
  { slug: 'buy', name: 'Buy Things' },
  { slug: 'eat', name: 'Eat Things' },
  { slug: 'send', name: 'Send Things' },
];

const DEFAULT_SECONDS = 75;

/** Clamp a requested total duration (seconds) into the watchable [60, 90] band. */
export function clampSeconds(input, { min = 60, max = 90, fallback = DEFAULT_SECONDS } = {}) {
  const n = Number.isFinite(input) ? input : fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeUrl(url) {
  return String(url).trim().replace(/\/+$/, '');
}

/** First port for `--local`: web-do=base, web-say=base+1, … web-send=base+4. */
export const LOCAL_BASE_PORT = 8081;

/**
 * Ordered tour targets. Priority per app: an explicit `TOUR_<APP>_URL` env
 * override always wins; else in `--local` mode it's that app's Expo web dev
 * server (`http://localhost:<localBase + index>`); else its Vercel production
 * host (`https://things-<slug>.vercel.app`, per infra/VERCEL.md).
 */
export function tourTargets(
  env = process.env,
  { local = false, localBase = LOCAL_BASE_PORT } = {},
) {
  return SUITE.map(({ slug, name }, i) => {
    const override = env[`TOUR_${slug.toUpperCase()}_URL`];
    let url;
    if (override) url = normalizeUrl(override);
    else if (local) url = `http://localhost:${localBase + i}`;
    else url = `https://things-${slug}.vercel.app`;
    return { slug, name, url };
  });
}

/**
 * Absolute completion deadlines (ms from start) for `n` evenly-paced steps
 * across `totalMs`. Step i should be *done* by `deadlines[i]`; padding each step
 * up to its deadline makes the whole tour land on the requested budget
 * regardless of how fast any single page loads.
 */
export function stepDeadlines(totalMs, n) {
  const slice = totalMs / n;
  return Array.from({ length: n }, (_, i) => Math.round(slice * (i + 1)));
}

/** Time left to dwell on a step so it completes at its deadline (never < 0). */
export function dwellMs(deadlineOffset, elapsedMs) {
  return Math.max(0, deadlineOffset - elapsedMs);
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SESSION_TOKEN_KEY = 'things.session-token';

function parseArgs(argv) {
  const opts = {
    seconds: DEFAULT_SECONDS,
    secondsRaw: null,
    headless: false,
    dryRun: false,
    signup: false,
    slowmo: null,
    timeout: 30_000,
    shots: null,
    video: null,
    local: false,
    localBase: LOCAL_BASE_PORT,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--help':
      case '-h':
        opts.help = true;
        break;
      case '--headless':
        opts.headless = true;
        break;
      case '--headed':
        opts.headless = false;
        break;
      case '--local':
        opts.local = true;
        break;
      case '--local-base':
        opts.localBase = Number(next());
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--signup':
        opts.signup = true;
        break;
      case '--seconds':
      case '-s':
        opts.secondsRaw = Number(next());
        break;
      case '--slowmo':
        opts.slowmo = Number(next());
        break;
      case '--timeout':
        opts.timeout = Number(next());
        break;
      case '--shots':
        opts.shots = next();
        break;
      case '--video':
        opts.video = next();
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        opts.help = true;
    }
  }
  opts.seconds = clampSeconds(opts.secondsRaw ?? DEFAULT_SECONDS);
  if (!Number.isInteger(opts.localBase) || opts.localBase < 1) opts.localBase = LOCAL_BASE_PORT;
  return opts;
}

const HELP = `App-to-app tour — drive a headed browser through the 5 Things web apps.

Usage:
  TOUR_EMAIL=… TOUR_PASSWORD=… node scripts/tour.mjs [options]

Options:
  -s, --seconds <n>   Total tour duration; clamped to 60-90 (default 75).
      --headless      Run without a visible window (CI / no display).
      --local         Target local Expo web dev servers instead of the Vercel hosts.
      --local-base <p>  First local port (default 8081; do=base … send=base+4).
      --signup        Create the account (toggle to sign-up) instead of signing in.
      --slowmo <ms>   Slow each browser action by <ms> (nicer to watch).
      --timeout <ms>  Per-step navigation/response timeout (default 30000).
      --shots <dir>   Save a screenshot of each app to <dir>.
      --video <dir>   Record the whole tour to a video in <dir>.
      --dry-run       Print the resolved plan and exit (launches no browser).
  -h, --help          Show this help.

Targets default to https://things-<app>.vercel.app; override any with
TOUR_DO_URL / TOUR_SAY_URL / TOUR_BUY_URL / TOUR_EAT_URL / TOUR_SEND_URL.`;

/** Resolve Playwright's email/password/submit handles, resilient to testID drift. */
function loginFields(page) {
  return {
    email: page.getByTestId('login-email').or(page.getByPlaceholder('Email')),
    password: page.getByTestId('login-password').or(page.getByPlaceholder('Password')),
    submit: page
      .getByTestId('login-submit')
      .or(page.getByRole('button', { name: /sign (in|up)/i })),
  };
}

/** Step 1: real login on the first app; returns the captured session token. */
async function loginAndCapture(page, target, { email, password, signup, timeout }) {
  await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout });
  const fields = loginFields(page);
  await fields.email.waitFor({ state: 'visible', timeout });

  if (signup) {
    await page.getByText(/don't have an account\? sign up/i).click({ timeout });
  }

  await fields.email.fill(email);
  await fields.password.fill(password);

  const authResponse = page.waitForResponse(
    (r) => /\/auth\/sign-(in|up)\/email/.test(r.url()) && r.request().method() === 'POST',
    { timeout },
  );
  await fields.submit.click();
  const res = await authResponse;
  if (!res.ok()) {
    return { ok: false, detail: `sign-in HTTP ${res.status()}`, token: null };
  }

  // auth-api stores the `set-auth-token` header into localStorage synchronously
  // once the sign-in fetch resolves; wait for it to land.
  await page.waitForFunction((key) => !!globalThis.localStorage?.getItem(key), SESSION_TOKEN_KEY, {
    timeout,
  });
  const token = await page.evaluate(
    (key) => globalThis.localStorage.getItem(key),
    SESSION_TOKEN_KEY,
  );
  return {
    ok: !!token,
    detail: token ? 'logged in, token captured' : 'no token after sign-in',
    token,
  };
}

/** Steps 2-5: token is pre-seeded into the origin; confirm the app accepts it. */
async function verifyCarried(page, target, { timeout }) {
  const sessionResponse = page.waitForResponse((r) => /\/auth\/get-session/.test(r.url()), {
    timeout,
  });
  await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout });

  let authedByApi = false;
  try {
    const res = await sessionResponse;
    const body = res.ok() ? await res.json().catch(() => null) : null;
    authedByApi = !!(body && body.user);
  } catch {
    authedByApi = false; // get-session never fired within the timeout
  }

  // Cross-check the UI: a carried session must NOT bounce to the login form.
  const onLoginScreen = await page
    .getByTestId('login-email')
    .isVisible()
    .catch(() => false);

  const ok = authedByApi && !onLoginScreen;
  const detail = ok
    ? 'session carried (get-session → user)'
    : authedByApi
      ? 'get-session ok but login form shown'
      : onLoginScreen
        ? 'bounced to login (token rejected)'
        : 'no authenticated get-session';
  return { ok, detail };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(HELP);
    process.exit(0);
  }

  const targets = tourTargets(process.env, { local: opts.local, localBase: opts.localBase });
  const totalMs = opts.seconds * 1000;
  const deadlines = stepDeadlines(totalMs, targets.length);

  if (opts.secondsRaw != null && clampSeconds(opts.secondsRaw) !== opts.secondsRaw) {
    console.warn(`⚠  --seconds ${opts.secondsRaw} is outside 60-90; using ${opts.seconds}.`);
  }

  if (opts.dryRun) {
    const mode = opts.local ? 'LOCAL (Expo dev servers)' : 'production (Vercel)';
    console.log(
      `Tour plan — ${opts.seconds}s total, ${mode}, ${opts.headless ? 'headless' : 'headed'}:\n`,
    );
    targets.forEach((t, i) => {
      const role = i === 0 ? 'log in + capture token' : 'verify session carried';
      console.log(
        `  ${i + 1}. ${t.name.padEnd(11)} done by ~${deadlines[i] / 1000}s  ${t.url}  (${role})`,
      );
    });
    console.log('\nDry run — no browser launched.');
    process.exit(0);
  }

  const email = process.env.TOUR_EMAIL;
  const password = process.env.TOUR_PASSWORD;
  if (!email || !password) {
    console.error('Set TOUR_EMAIL and TOUR_PASSWORD (the account to sign in as).');
    console.error('Pass --signup to create the account instead of signing in.');
    process.exit(2);
  }

  if (!opts.headless && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    console.warn('⚠  Headed mode but no DISPLAY/WAYLAND_DISPLAY detected.');
    console.warn('   Run on a desktop, wrap with `xvfb-run`, or pass --headless.\n');
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error(
      'Playwright is required: `npm i -D playwright` then `npx playwright install chromium`.',
    );
    process.exit(2);
  }

  const browser = await chromium.launch({
    headless: opts.headless,
    slowMo: Number.isFinite(opts.slowmo) ? opts.slowmo : undefined,
  });
  const context = await browser.newContext(
    opts.video ? { recordVideo: { dir: opts.video } } : undefined,
  );
  const page = await context.newPage();

  const results = [];
  const startTs = Date.now();
  let token = null;
  let fs;
  if (opts.shots) {
    fs = await import('node:fs');
    fs.mkdirSync(opts.shots, { recursive: true });
  }

  try {
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const isFirst = i === 0;
      console.log(
        `▶ [${i + 1}/${targets.length}] ${target.name} — ${isFirst ? 'logging in…' : 'checking session…'}`,
      );

      // Login failed on app 1 → nothing can carry. Record the remaining apps as
      // skipped and stop, rather than burning the budget sleeping on pages we
      // can't authenticate.
      if (!isFirst && !token) {
        for (let j = i; j < targets.length; j++) {
          results.push({
            name: targets[j].name,
            url: targets[j].url,
            ok: false,
            detail: 'skipped — login failed, no session token',
          });
        }
        break;
      }

      let result;
      if (isFirst) {
        result = await loginAndCapture(page, target, {
          email,
          password,
          signup: opts.signup,
          timeout: opts.timeout,
        });
        token = result.token;
        if (token) {
          // Seed the captured token into every subsequent origin at document
          // start, so each app boots already holding the session.
          await context.addInitScript(
            ([key, value]) => {
              try {
                globalThis.localStorage?.setItem(key, value);
              } catch {
                /* in-memory only; nothing to do */
              }
            },
            [SESSION_TOKEN_KEY, token],
          );
        }
      } else {
        result = await verifyCarried(page, target, { timeout: opts.timeout });
      }

      results.push({ name: target.name, url: target.url, ...result });

      if (opts.shots && fs) {
        const file = `${opts.shots}/${String(i + 1).padStart(2, '0')}-${target.slug}.png`;
        await page.screenshot({ path: file, fullPage: true }).catch(() => {});
      }

      // Pace: dwell on this app until its slot deadline so the whole tour lands
      // on the requested 60-90s budget and each app is on screen long enough.
      const dwell = dwellMs(deadlines[i], Date.now() - startTs);
      if (dwell > 0) await sleep(dwell);
    }
  } finally {
    await context.close(); // flushes --video
    await browser.close();
  }

  const elapsed = Math.round((Date.now() - startTs) / 1000);
  console.log('');
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? '✅' : '❌'} ${r.name.padEnd(11)} ${r.detail}`);
  }
  console.log(`\n${results.length - failed}/${results.length} apps OK · ${elapsed}s elapsed`);
  if (opts.video) console.log(`Video saved under ${opts.video}/`);
  if (opts.shots) console.log(`Screenshots saved under ${opts.shots}/`);

  if (failed > 0) {
    console.error(`Tour FAILED: ${failed} app(s) did not carry the session.`);
    process.exit(1);
  }
  console.log('Tour passed — session carried across all five apps.');
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
