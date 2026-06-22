import { create } from 'zustand';
import { messagesApi, type MessageCreate, type MessageUpdate } from '../lib/api';
import type { Message } from '../lib/types';

export interface MessagesState {
  messages: Message[];
  loading: boolean;
  error: string | null;
  syncing: boolean;
  syncSummary: { inboundCreated: number; processed: number } | null;
  telegramChatId: string | null;
  refresh: () => Promise<void>;
  create: (data: MessageCreate) => Promise<void>;
  update: (id: string, partial: MessageUpdate) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Deliver an outbound telegram message and replace it with the result. */
  send: (id: string) => Promise<void>;
  /** Pull inbound telegram updates, then refresh the list. */
  sync: () => Promise<void>;
  /** Connect a Telegram chat to this account. */
  linkTelegram: (chatId: string) => Promise<void>;
  byId: (id: string) => Message | undefined;
}

export const useMessages = create<MessagesState>((set, get) => ({
  messages: [],
  loading: false,
  error: null,
  syncing: false,
  syncSummary: null,
  telegramChatId: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const messages = await messagesApi.list();
      set({ messages, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },
  create: async (data) => {
    const m = await messagesApi.create(data);
    set((state) => ({ messages: [m, ...state.messages] }));
  },
  update: async (id, partial) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...mergeOptimistic(partial) } : m,
      ),
    }));
    const updated = await messagesApi.update(id, partial);
    set((state) => ({ messages: state.messages.map((m) => (m.id === id ? updated : m)) }));
  },
  remove: async (id) => {
    set((state) => ({ messages: state.messages.filter((m) => m.id !== id) }));
    await messagesApi.remove(id);
  },
  send: async (id) => {
    const updated = await messagesApi.send(id);
    set((state) => ({ messages: state.messages.map((m) => (m.id === id ? updated : m)) }));
  },
  sync: async () => {
    set({ syncing: true, error: null });
    try {
      const summary = await messagesApi.sync();
      set({ syncSummary: summary, syncing: false });
      const messages = await messagesApi.list();
      set({ messages });
    } catch (e) {
      set({ error: (e as Error).message, syncing: false });
    }
  },
  linkTelegram: async (chatId) => {
    const { chatId: linked } = await messagesApi.linkTelegram(chatId);
    set({ telegramChatId: linked });
  },
  byId: (id) => get().messages.find((m) => m.id === id),
}));

function mergeOptimistic(partial: MessageUpdate): Partial<Message> {
  const out: Partial<Message> = {};
  if (partial.channel !== undefined) out.channel = partial.channel;
  if (partial.subject !== undefined) out.subject = partial.subject;
  if (partial.body !== undefined) out.body = partial.body;
  if (partial.recipient !== undefined) out.recipient = partial.recipient;
  if (partial.status !== undefined) out.status = partial.status;
  return out;
}
