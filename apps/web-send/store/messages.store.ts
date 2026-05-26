import { create } from 'zustand';
import { messagesApi, type MessageCreate, type MessageUpdate } from '../lib/api';
import type { Message } from '../lib/types';

export interface MessagesState {
  messages: Message[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (data: MessageCreate) => Promise<void>;
  update: (id: string, partial: MessageUpdate) => Promise<void>;
  remove: (id: string) => Promise<void>;
  byId: (id: string) => Message | undefined;
}

export const useMessages = create<MessagesState>((set, get) => ({
  messages: [],
  loading: false,
  error: null,
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
