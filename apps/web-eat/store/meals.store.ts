import { create } from 'zustand';
import { mealsApi, type DiscoveryKind, type MealCreate, type MealUpdate } from '../lib/api';
import type { DiscoveryResult, MealItem } from '../lib/types';

export interface MealsState {
  meals: MealItem[];
  loading: boolean;
  error: string | null;
  syncing: boolean;
  syncSummary: { created: number; consumed: number } | null;
  results: DiscoveryResult[];
  searching: boolean;
  refresh: () => Promise<void>;
  create: (data: MealCreate) => Promise<void>;
  update: (id: string, partial: MealUpdate) => Promise<void>;
  remove: (id: string) => Promise<void>;
  sync: () => Promise<void>;
  /** Discover recipes or restaurants; populates `results`. */
  search: (query: string, kind: DiscoveryKind) => Promise<void>;
  /** Add a discovery result to the list, then drop it from `results`. */
  addResult: (result: DiscoveryResult) => Promise<void>;
  byId: (id: string) => MealItem | undefined;
}

export const useMeals = create<MealsState>((set, get) => ({
  meals: [],
  loading: false,
  error: null,
  syncing: false,
  syncSummary: null,
  results: [],
  searching: false,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const meals = await mealsApi.list();
      set({ meals, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },
  create: async (data) => {
    const t = await mealsApi.create(data);
    set((state) => ({ meals: [t, ...state.meals] }));
  },
  update: async (id, partial) => {
    set((state) => ({
      meals: state.meals.map((t) => (t.id === id ? { ...t, ...mergeOptimistic(partial) } : t)),
    }));
    const updated = await mealsApi.update(id, partial);
    set((state) => ({ meals: state.meals.map((t) => (t.id === id ? updated : t)) }));
  },
  remove: async (id) => {
    set((state) => ({ meals: state.meals.filter((t) => t.id !== id) }));
    await mealsApi.remove(id);
  },
  sync: async () => {
    set({ syncing: true, error: null });
    try {
      const summary = await mealsApi.sync();
      set({ syncSummary: summary, syncing: false });
      const meals = await mealsApi.list();
      set({ meals });
    } catch (e) {
      set({ error: (e as Error).message, syncing: false });
    }
  },
  search: async (query, kind) => {
    set({ searching: true, error: null });
    try {
      const { results } = await mealsApi.search(query, kind);
      set({ results, searching: false });
    } catch (e) {
      set({ error: (e as Error).message, searching: false });
    }
  },
  addResult: async (result) => {
    await get().create({ name: result.name, kind: result.kind, notes: result.detail });
    set((state) => ({ results: state.results.filter((r) => r.id !== result.id) }));
  },
  byId: (id) => get().meals.find((t) => t.id === id),
}));

function mergeOptimistic(partial: MealUpdate): Partial<MealItem> {
  const out: Partial<MealItem> = {};
  if (partial.name !== undefined) out.name = partial.name;
  if (partial.kind !== undefined) out.kind = partial.kind;
  if (partial.notes !== undefined) out.notes = partial.notes;
  if (partial.status !== undefined) out.status = partial.status;
  return out;
}
