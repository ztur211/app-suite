export type { User } from '@things/types';

export interface Task {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}
