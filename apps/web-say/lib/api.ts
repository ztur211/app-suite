import { apiRequest } from '@things/web-kit';
import type { Dictation, Proposal } from './types';

const SAY_URL = process.env.EXPO_PUBLIC_SAY_URL ?? 'http://localhost:3003';

/** Idempotency-Key for mutating /dictations calls; also becomes the new dictation's id on create. */
function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const dictationsApi = {
  list: () => apiRequest<Dictation[]>(`${SAY_URL}/dictations`),

  /**
   * Create a typed dictation. captureMode 'type' skips Whisper transcription;
   * api-say still classifies intent + reshapes the payload via @things/ai, so
   * this requires ANTHROPIC_API_KEY on the server (surfaces as an error here if
   * it is missing). Sent as multipart/form-data to match the FileInterceptor.
   */
  async create(previewTranscript: string): Promise<{ dictation: Dictation; proposal: Proposal }> {
    const form = new FormData();
    form.append('captureMode', 'type');
    form.append('previewTranscript', previewTranscript);
    const res = await fetch(`${SAY_URL}/dictations`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Idempotency-Key': newIdempotencyKey() },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    return res.json() as Promise<{ dictation: Dictation; proposal: Proposal }>;
  },

  dispatch: (id: string) =>
    apiRequest<{ dictation: Dictation; renderedEmail?: string }>(
      `${SAY_URL}/dictations/${id}/dispatch`,
      { method: 'POST', headers: { 'Idempotency-Key': newIdempotencyKey() } },
    ),
  undoDispatch: (id: string) =>
    apiRequest<Dictation>(`${SAY_URL}/dictations/${id}/dispatch`, {
      method: 'DELETE',
      headers: { 'Idempotency-Key': newIdempotencyKey() },
    }),
  remove: (id: string) =>
    apiRequest<{ ok: boolean }>(`${SAY_URL}/dictations/${id}`, { method: 'DELETE' }),
};
