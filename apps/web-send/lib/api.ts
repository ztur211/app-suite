import { apiRequest } from '@things/web-kit';
import type { Message, MessageChannel, MessageStatus } from './types';

const SEND_URL = process.env.EXPO_PUBLIC_SEND_URL ?? 'http://localhost:3006';

export interface MessageCreate {
  channel: MessageChannel;
  body: string;
  subject?: string | null;
  recipient?: string | null;
}

export interface MessageUpdate {
  channel?: MessageChannel;
  body?: string;
  subject?: string | null;
  recipient?: string | null;
  status?: MessageStatus;
}

export const messagesApi = {
  list: () => apiRequest<Message[]>(`${SEND_URL}/messages`),
  create: (data: MessageCreate) =>
    apiRequest<Message>(`${SEND_URL}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, partial: MessageUpdate) =>
    apiRequest<Message>(`${SEND_URL}/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(partial),
    }),
  remove: (id: string) =>
    apiRequest<{ ok: boolean }>(`${SEND_URL}/messages/${id}`, { method: 'DELETE' }),
};
