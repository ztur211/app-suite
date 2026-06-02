import { create } from 'zustand';
import { dictationsApi } from '../lib/api';
import type { Dictation } from '../lib/types';

export interface DictationsState {
  dictations: Dictation[];
  loading: boolean;
  creating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Returns true on success; sets `error` and returns false on failure. */
  capture: (text: string) => Promise<boolean>;
  dispatch: (id: string) => Promise<void>;
  undoDispatch: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  byId: (id: string) => Dictation | undefined;
}

export const useDictations = create<DictationsState>((set, get) => ({
  dictations: [],
  loading: false,
  creating: false,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const dictations = await dictationsApi.list();
      set({ dictations, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },
  capture: async (text) => {
    set({ creating: true, error: null });
    try {
      const { dictation } = await dictationsApi.create(text);
      set((state) => ({ dictations: [dictation, ...state.dictations], creating: false }));
      return true;
    } catch (e) {
      set({ error: (e as Error).message, creating: false });
      return false;
    }
  },
  dispatch: async (id) => {
    const { dictation } = await dictationsApi.dispatch(id);
    set((state) => ({ dictations: state.dictations.map((d) => (d.id === id ? dictation : d)) }));
  },
  undoDispatch: async (id) => {
    const dictation = await dictationsApi.undoDispatch(id);
    set((state) => ({ dictations: state.dictations.map((d) => (d.id === id ? dictation : d)) }));
  },
  remove: async (id) => {
    set((state) => ({ dictations: state.dictations.filter((d) => d.id !== id) }));
    await dictationsApi.remove(id);
  },
  byId: (id) => get().dictations.find((d) => d.id === id),
}));
