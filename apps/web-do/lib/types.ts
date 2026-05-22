export interface Task {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
}
