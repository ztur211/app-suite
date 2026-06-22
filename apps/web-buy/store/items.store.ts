import { create } from 'zustand';
import { itemsApi, type ItemCreate, type ItemUpdate } from '../lib/api';
import type { ProductResult, ShoppingItem } from '../lib/types';

export interface ItemsState {
  items: ShoppingItem[];
  loading: boolean;
  error: string | null;
  syncing: boolean;
  syncSummary: { created: number; consumed: number } | null;
  results: ProductResult[];
  searching: boolean;
  refresh: () => Promise<void>;
  create: (data: ItemCreate) => Promise<void>;
  update: (id: string, partial: ItemUpdate) => Promise<void>;
  remove: (id: string) => Promise<void>;
  sync: () => Promise<void>;
  /** Run an external product search; populates `results`. */
  search: (query: string) => Promise<void>;
  /** Add a search result to the list, then drop it from `results`. */
  addResult: (result: ProductResult) => Promise<void>;
  byId: (id: string) => ShoppingItem | undefined;
}

export const useItems = create<ItemsState>((set, get) => ({
  items: [],
  loading: false,
  error: null,
  syncing: false,
  syncSummary: null,
  results: [],
  searching: false,
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
  search: async (query) => {
    set({ searching: true, error: null });
    try {
      const results = await itemsApi.search(query);
      set({ results, searching: false });
    } catch (e) {
      set({ error: (e as Error).message, searching: false });
    }
  },
  addResult: async (result) => {
    await get().create(resultToCreate(result));
    set((state) => ({ results: state.results.filter((r) => r.id !== result.id) }));
  },
  byId: (id) => get().items.find((t) => t.id === id),
}));

/** Map a search result to the fields we persist as a ShoppingItem. */
function resultToCreate(r: ProductResult): ItemCreate {
  const detail = [r.price ? `${r.price.currency} ${r.price.amount}` : null, r.seller]
    .filter(Boolean)
    .join(' · ');
  return { title: r.title, notes: detail || null };
}

function mergeOptimistic(partial: ItemUpdate): Partial<ShoppingItem> {
  const out: Partial<ShoppingItem> = {};
  if (partial.title !== undefined) out.title = partial.title;
  if (partial.quantity !== undefined) out.quantity = partial.quantity;
  if (partial.notes !== undefined) out.notes = partial.notes;
  if (partial.status !== undefined) out.status = partial.status;
  return out;
}
