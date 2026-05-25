import { create } from 'zustand';
import { itemsApi, type ItemCreate, type ItemUpdate } from '../lib/api';
import type { ShoppingItem } from '../lib/types';

export interface ItemsState {
  items: ShoppingItem[];
  loading: boolean;
  error: string | null;
  syncing: boolean;
  syncSummary: { created: number; consumed: number } | null;
  refresh: () => Promise<void>;
  create: (data: ItemCreate) => Promise<void>;
  update: (id: string, partial: ItemUpdate) => Promise<void>;
  remove: (id: string) => Promise<void>;
  sync: () => Promise<void>;
  byId: (id: string) => ShoppingItem | undefined;
}

export const useItems = create<ItemsState>((set, get) => ({
  items: [],
  loading: false,
  error: null,
  syncing: false,
  syncSummary: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const items = await itemsApi.list();
      set({ items, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },
  create: async (data) => {
    const t = await itemsApi.create(data);
    set((state) => ({ items: [t, ...state.items] }));
  },
  update: async (id, partial) => {
    set((state) => ({
      items: state.items.map((t) => (t.id === id ? { ...t, ...mergeOptimistic(partial) } : t)),
    }));
    const updated = await itemsApi.update(id, partial);
    set((state) => ({ items: state.items.map((t) => (t.id === id ? updated : t)) }));
  },
  remove: async (id) => {
    set((state) => ({ items: state.items.filter((t) => t.id !== id) }));
    await itemsApi.remove(id);
  },
  sync: async () => {
    set({ syncing: true, error: null });
    try {
      const summary = await itemsApi.sync();
      set({ syncSummary: summary, syncing: false });
      // Reload list to pick up new items
      const items = await itemsApi.list();
      set({ items });
    } catch (e) {
      set({ error: (e as Error).message, syncing: false });
    }
  },
  byId: (id) => get().items.find((t) => t.id === id),
}));

function mergeOptimistic(partial: ItemUpdate): Partial<ShoppingItem> {
  const out: Partial<ShoppingItem> = {};
  if (partial.title !== undefined) out.title = partial.title;
  if (partial.quantity !== undefined) out.quantity = partial.quantity;
  if (partial.notes !== undefined) out.notes = partial.notes;
  if (partial.status !== undefined) out.status = partial.status;
  return out;
}
