import type { Dictation, Proposal, User } from './types';

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL ?? 'http://localhost:3001';
const SAY_URL = process.env.EXPO_PUBLIC_SAY_URL ?? 'http://localhost:3003';

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Idempotency-Key for mutating /dictations calls; also becomes the new dictation's id on create. */
function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const authApi = {
  signUp: (email: string, password: string) =>
    request<{ user: User }>(`${AUTH_URL}/auth/sign-up/email`, {
      method: 'POST',
      body: JSON.stringify({ email, password, name: email.split('@')[0] }),
    }),
  signIn: (email: string, password: string) =>
    request<{ user: User }>(`${AUTH_URL}/auth/sign-in/email`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  signOut: () => request<void>(`${AUTH_URL}/auth/sign-out`, { method: 'POST' }),
  getSession: () => request<{ user: User } | null>(`${AUTH_URL}/auth/get-session`),
};

export const dictationsApi = {
  list: () => request<Dictation[]>(`${SAY_URL}/dictations`),

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
    request<{ dictation: Dictation; renderedEmail?: string }>(
      `${SAY_URL}/dictations/${id}/dispatch`,
      { method: 'POST', headers: { 'Idempotency-Key': newIdempotencyKey() } },
    ),
  undoDispatch: (id: string) =>
    request<Dictation>(`${SAY_URL}/dictations/${id}/dispatch`, {
      method: 'DELETE',
      headers: { 'Idempotency-Key': newIdempotencyKey() },
    }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`${SAY_URL}/dictations/${id}`, { method: 'DELETE' }),
};
