import type { UsageLogEntry, UsageLogger } from '@things/ai';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Build a UsageLogger that persists each AI call to the local
 * `things_auth.AiCall` table via the app's Prisma client. Tagged per-app so
 * usage rows are queryable by caller (e.g. `callerApp = 'api-say'`).
 */
export function makePrismaUsageLogger(prisma: PrismaService): UsageLogger {
  return async (entry: UsageLogEntry) => {
    const base = {
      userId: entry.userId ?? null,
      callerApp: entry.callerApp ?? 'unknown',
      operation: entry.operation,
      provider: entry.provider,
      model: entry.model,
      durationMs: entry.durationMs,
      startedAt: entry.startedAt,
      fellBackTo: entry.fellBackTo
        ? `${entry.fellBackTo.provider}:${entry.fellBackTo.model}`
        : null,
    };
    let extras: Record<string, number | null>;
    switch (entry.usage.kind) {
      case 'tokens':
        extras = {
          inputTokens: entry.usage.inputTokens,
          outputTokens: entry.usage.outputTokens,
          cacheReadTokens: entry.usage.cacheReadTokens ?? null,
          cacheWriteTokens: entry.usage.cacheWriteTokens ?? null,
        };
        break;
      case 'audio':
        extras = { audioSeconds: entry.usage.seconds };
        break;
      case 'embedding':
        extras = {
          inputTokens: entry.usage.inputTokens,
          vectorCount: entry.usage.vectorCount,
        };
        break;
    }
    await prisma.aiCall.create({ data: { ...base, ...extras } });
  };
}
