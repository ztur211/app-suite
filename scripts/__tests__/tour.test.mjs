import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SUITE, clampSeconds, tourTargets, stepDeadlines, dwellMs } from '../tour.mjs';

test('SUITE is the five apps in canonical order', () => {
  assert.deepEqual(
    SUITE.map((a) => a.slug),
    ['do', 'say', 'buy', 'eat', 'send'],
  );
  assert.equal(SUITE[0].name, 'Do Things');
});

test('clampSeconds keeps an in-range value', () => {
  assert.equal(clampSeconds(75), 75);
  assert.equal(clampSeconds(60), 60);
  assert.equal(clampSeconds(90), 90);
});

test('clampSeconds clamps out-of-range values into [60, 90]', () => {
  assert.equal(clampSeconds(30), 60);
  assert.equal(clampSeconds(120), 90);
});

test('clampSeconds falls back to 75 for non-finite input', () => {
  assert.equal(clampSeconds(NaN), 75);
  assert.equal(clampSeconds(undefined), 75);
  assert.equal(clampSeconds(Infinity), 75); // non-finite -> fallback 75 (then clamp leaves it)
});

test('tourTargets defaults to the things-<slug>.vercel.app hosts in order', () => {
  const targets = tourTargets({});
  assert.deepEqual(
    targets.map((t) => t.url),
    [
      'https://things-do.vercel.app',
      'https://things-say.vercel.app',
      'https://things-buy.vercel.app',
      'https://things-eat.vercel.app',
      'https://things-send.vercel.app',
    ],
  );
});

test('tourTargets honours per-app TOUR_<APP>_URL overrides (trimmed)', () => {
  const targets = tourTargets({
    TOUR_DO_URL: 'https://do.example.com',
    TOUR_SEND_URL: '  https://send.example.com/  ',
  });
  const bySlug = Object.fromEntries(targets.map((t) => [t.slug, t.url]));
  assert.equal(bySlug.do, 'https://do.example.com');
  assert.equal(bySlug.send, 'https://send.example.com'); // trimmed, trailing slash stripped
  assert.equal(bySlug.say, 'https://things-say.vercel.app'); // untouched default
});

test('tourTargets --local points at localhost:8081.. in suite order', () => {
  const targets = tourTargets({}, { local: true });
  assert.deepEqual(
    targets.map((t) => t.url),
    [
      'http://localhost:8081',
      'http://localhost:8082',
      'http://localhost:8083',
      'http://localhost:8084',
      'http://localhost:8085',
    ],
  );
});

test('tourTargets --local honours a custom base port', () => {
  const targets = tourTargets({}, { local: true, localBase: 19000 });
  assert.equal(targets[0].url, 'http://localhost:19000'); // do
  assert.equal(targets[4].url, 'http://localhost:19004'); // send
});

test('TOUR_<APP>_URL still overrides in --local mode', () => {
  const targets = tourTargets({ TOUR_BUY_URL: 'http://localhost:9999' }, { local: true });
  const bySlug = Object.fromEntries(targets.map((t) => [t.slug, t.url]));
  assert.equal(bySlug.buy, 'http://localhost:9999'); // explicit override wins
  assert.equal(bySlug.do, 'http://localhost:8081'); // others stay on the local scheme
});

test('stepDeadlines spaces n completion deadlines evenly across the budget', () => {
  assert.deepEqual(stepDeadlines(75000, 5), [15000, 30000, 45000, 60000, 75000]);
  assert.deepEqual(stepDeadlines(90000, 5), [18000, 36000, 54000, 72000, 90000]);
});

test('dwellMs returns the remaining time to a deadline, never negative', () => {
  assert.equal(dwellMs(15000, 4000), 11000); // step finished early -> wait 11s
  assert.equal(dwellMs(15000, 16000), 0); // step overran -> no wait
  assert.equal(dwellMs(15000, 15000), 0);
});
