import { create } from 'zustand';
import { tasksApi, type TaskUpdate } from '../lib/api';
import type { Task } from '../lib/types';

export interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (title: string) => Promise<void>;
  update: (id: string, partial: TaskUpdate) => Promise<void>;
  remove: (id: string) => Promise<void>;
  byId: (id: string) => Task | undefined;
}

export const useTasks = create<TasksState>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const tasks = await tasksApi.list();
      set({ tasks, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },
  create: async (title) => {
    const t = await tasksApi.create(title);
    set((state) => ({ tasks: [t, ...state.tasks] }));
  },
  update: async (id, partial) => {
    // Optimistic merge so the UI updates immediately.
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...mergeOptimistic(partial) } : t)),
    }));
    const updated = await tasksApi.update(id, partial);
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? updated : t)) }));
  },
  remove: async (id) => {
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
    await tasksApi.remove(id);
  },
  byId: (id) => get().tasks.find((t) => t.id === id),
}));

function mergeOptimistic(partial: TaskUpdate): Partial<Task> {
  const out: Partial<Task> = {};
  if (partial.title !== undefined) out.title = partial.title;
  if (partial.completed !== undefined) out.completed = partial.completed;
  if (partial.dueAt !== undefined) out.dueAt = partial.dueAt;
  return out;
}
