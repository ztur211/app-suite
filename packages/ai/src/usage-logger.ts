import type { Usage } from './types';

export type AiOperation =
  | 'chat'
  | 'chatStructured'
  | 'summarize'
  | 'transcribe'
  | 'embed'
  | 'vision';

export interface UsageLogEntry {
  operation: AiOperation;
  provider: string;
  model: string;
  usage: Usage;
  /** Set by the caller's NestJS request context; absent for system calls. */
  userId?: string;
  /** Calling app (e.g. 'api-say'); set by the caller's context. */
  callerApp?: string;
  startedAt: Date;
  durationMs: number;
  /** If the primary route failed and the call ended up on the fallback. */
  fellBackTo?: { provider: string; model: string };
}

export type UsageLogger = (entry: UsageLogEntry) => Promise<void>;

export const noopUsageLogger: UsageLogger = async () => {
  // intentional no-op
};
