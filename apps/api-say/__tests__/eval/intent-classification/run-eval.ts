/**
 * Intent-classification eval harness.
 *
 * Runs each case in cases.jsonl through `ai.chatStructured(intentResult, ...)`
 * with the production system prompt, then reports intent accuracy + Brier
 * score. On first run, writes baseline.json; on subsequent runs, fails CI if
 * intent accuracy drops more than 3pp from baseline.
 *
 * Requires OPENAI_API_KEY and ANTHROPIC_API_KEY env vars (real network calls).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { DateTime } from 'luxon';
import { createAiClient } from '@things/ai';
import { intentResult, type Intent } from '@things/types';
import { INTENT_CLASSIFY_PROMPT } from '../../../src/ai/prompts/intent-classify-prompt';

interface Case {
  transcript: string;
  userTz: string;
  captureMode: 'tap' | 'drive';
  expectedIntent: Intent;
  minConfidence: number;
}

interface BaselineMetrics {
  intentAccuracy: number;
  payloadFieldAccuracy: number;
  brier: number;
  perIntent: Record<Intent, { correct: number; total: number }>;
  runAt: string;
}

async function main(): Promise<void> {
  const here = path.dirname(__filename);
  const cases: Case[] = readFileSync(path.join(here, 'cases.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Case);

  const ai = createAiClient({
    openaiApiKey: process.env['OPENAI_API_KEY'] ?? '',
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'] ?? '',
  });

  let correct = 0;
  let payloadFieldOk = 0;
  let brierSum = 0;
  const perIntent: Record<Intent, { correct: number; total: number }> = {
    DO: { correct: 0, total: 0 },
    NOTE: { correct: 0, total: 0 },
    SEND: { correct: 0, total: 0 },
    BUY: { correct: 0, total: 0 },
    EAT: { correct: 0, total: 0 },
  };

  for (const c of cases) {
    const now = DateTime.now().setZone(c.userTz).toISO();
    const r = await ai.chatStructured(
      intentResult,
      [
        { role: 'system', content: INTENT_CLASSIFY_PROMPT },
        {
          role: 'user',
          content:
            `Current user timezone: ${c.userTz}\n` +
            `Current user local time: ${now}\n` +
            `captureMode: ${c.captureMode}\n\n` +
            `Transcript: """${c.transcript}"""`,
        },
      ],
      { cacheSystem: true },
    );
    const correctIntent = r.value.intent === c.expectedIntent;
    if (correctIntent) correct++;
    if (correctIntent && r.value.confidence >= c.minConfidence) payloadFieldOk++;
    perIntent[c.expectedIntent].total++;
    if (correctIntent) perIntent[c.expectedIntent].correct++;
    const truth = correctIntent ? 1 : 0;
    brierSum += (r.value.confidence - truth) ** 2;
  }

  const metrics: BaselineMetrics = {
    intentAccuracy: correct / cases.length,
    payloadFieldAccuracy: payloadFieldOk / cases.length,
    brier: brierSum / cases.length,
    perIntent,
    runAt: new Date().toISOString(),
  };

  // eslint-disable-next-line no-console
  console.log('Intent accuracy:        ', (metrics.intentAccuracy * 100).toFixed(1), '%');
  // eslint-disable-next-line no-console
  console.log('Payload field accuracy: ', (metrics.payloadFieldAccuracy * 100).toFixed(1), '%');
  // eslint-disable-next-line no-console
  console.log('Brier:                  ', metrics.brier.toFixed(3));
  // eslint-disable-next-line no-console
  console.log('Per-intent:             ', JSON.stringify(metrics.perIntent));

  const baselineFile = path.join(here, 'baseline.json');
  if (existsSync(baselineFile)) {
    const baseline = JSON.parse(readFileSync(baselineFile, 'utf8')) as BaselineMetrics;
    const drop = (baseline.intentAccuracy - metrics.intentAccuracy) * 100;
    if (drop > 3) {
      console.error(
        `FAIL: intent accuracy dropped ${drop.toFixed(1)}pp from baseline ` +
          `(${(baseline.intentAccuracy * 100).toFixed(1)}% -> ${(metrics.intentAccuracy * 100).toFixed(1)}%)`,
      );
      process.exit(1);
    }
  } else {
    writeFileSync(baselineFile, JSON.stringify(metrics, null, 2));
    // eslint-disable-next-line no-console
    console.log('Wrote initial baseline.json');
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
