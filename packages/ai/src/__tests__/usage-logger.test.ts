import { noopUsageLogger } from '../usage-logger';
import type { UsageLogEntry, UsageLogger } from '../usage-logger';

describe('UsageLogger', () => {
  it('noopUsageLogger resolves without doing anything observable', async () => {
    const entry: UsageLogEntry = {
      operation: 'chat',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      usage: { kind: 'tokens', inputTokens: 1, outputTokens: 1 },
      startedAt: new Date('2026-05-23T00:00:00Z'),
      durationMs: 42,
    };
    await expect(noopUsageLogger(entry)).resolves.toBeUndefined();
  });

  it('UsageLogger is a function type that returns a Promise<void>', async () => {
    const calls: UsageLogEntry[] = [];
    const logger: UsageLogger = async (e) => {
      calls.push(e);
    };
    await logger({
      operation: 'transcribe',
      provider: 'openai',
      model: 'whisper-1',
      usage: { kind: 'audio', seconds: 10 },
      startedAt: new Date(),
      durationMs: 1234,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.operation).toBe('transcribe');
  });

  it('UsageLogEntry supports the fellBackTo field for fallback calls', async () => {
    const calls: UsageLogEntry[] = [];
    const logger: UsageLogger = async (e) => {
      calls.push(e);
    };
    await logger({
      operation: 'chat',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      usage: { kind: 'tokens', inputTokens: 100, outputTokens: 200 },
      startedAt: new Date(),
      durationMs: 800,
      fellBackTo: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    });
    expect(calls[0]?.fellBackTo).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    });
  });
});
