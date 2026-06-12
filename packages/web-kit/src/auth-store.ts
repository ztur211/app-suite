import { create } from 'zustand';
import type { User } from '@things/types';
import { authApi } from './auth-api';

interface AuthState {
  user: User | null;
  loading: boolean;
  init: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  init: async () => {
    try {
      const session = await authApi.getSession();
      set({ user: session?.user ?? null, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  signUp: async (email, password) => {
    const { user } = await authApi.signUp(email, password);
    set({ user });
  },
  signIn: async (email, password) => {
    const { user } = await authApi.signIn(email, password);
    set({ user });
  },
  signOut: async () => {
    await authApi.signOut();
    set({ user: null });
  },
}));
