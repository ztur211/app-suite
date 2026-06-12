import { apiRequest } from '@things/web-kit';
import type { Task } from './types';

const DO_URL = process.env.EXPO_PUBLIC_DO_URL ?? 'http://localhost:3002';

export interface TaskUpdate {
  title?: string;
  /** ISO 8601 string to set, null to clear, undefined to leave unchanged. */
  dueAt?: string | null;
  completed?: boolean;
}

export const tasksApi = {
  list: () => apiRequest<Task[]>(`${DO_URL}/tasks`),
  create: (title: string, dueAt?: string) =>
    apiRequest<Task>(`${DO_URL}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title, dueAt }),
    }),
  update: (id: string, partial: TaskUpdate) =>
    apiRequest<Task>(`${DO_URL}/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(partial),
    }),
  remove: (id: string) =>
    apiRequest<{ ok: boolean }>(`${DO_URL}/tasks/${id}`, { method: 'DELETE' }),
};
