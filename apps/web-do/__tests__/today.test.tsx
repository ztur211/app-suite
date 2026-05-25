import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import Tasks from '../app/(app)/index';
import { useAuth } from '../store/auth.store';
import { useTasks } from '../store/tasks.store';
import { tasksApi } from '../lib/api';
import type { Task } from '../lib/types';

jest.mock('../store/auth.store', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  tasksApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

const mockApi = tasksApi as jest.Mocked<typeof tasksApi>;
const mockSignOut = jest.fn();

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  userId: 'user-1',
  title: 'Test task',
  completed: false,
  dueAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  useTasks.setState({ tasks: [], loading: false, error: null });
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: 'user-1', email: 'test@example.com', name: 'test' },
    signOut: mockSignOut,
  });
  mockApi.list.mockResolvedValue([]);
});

describe('Tasks screen', () => {
  it('renders the page heading "Tasks"', async () => {
    const { getByText } = render(<Tasks />);
    await waitFor(() => {
      expect(getByText('Tasks')).toBeTruthy();
    });
  });

  it('shows the user email', async () => {
    const { getByText } = render(<Tasks />);
    await waitFor(() => {
      expect(getByText('test@example.com')).toBeTruthy();
    });
  });

  it('renders the task input', async () => {
    const { getByTestId } = render(<Tasks />);
    await waitFor(() => {
      expect(getByTestId('task-input')).toBeTruthy();
    });
  });

  it('renders all three filter tabs', async () => {
    const { findByTestId } = render(<Tasks />);
    expect(await findByTestId('tab-today')).toBeTruthy();
    expect(await findByTestId('tab-upcoming')).toBeTruthy();
    expect(await findByTestId('tab-done')).toBeTruthy();
  });

  it('shows the today-tab empty state when no tasks', async () => {
    const { findByTestId, findByText } = render(<Tasks />);
    expect(await findByTestId('empty-state')).toBeTruthy();
    expect(await findByText('Nothing to do')).toBeTruthy();
  });

  it('shows a task returned by tasksApi.list', async () => {
    mockApi.list.mockResolvedValueOnce([makeTask({ title: 'Buy groceries' })]);

    const { findByText } = render(<Tasks />);
    expect(await findByText('Buy groceries')).toBeTruthy();
  });

  it('adds a task when Add button is pressed', async () => {
    const newTask = makeTask({ id: 'task-2', title: 'New task' });
    mockApi.create.mockResolvedValueOnce(newTask);

    const { getByTestId, findByText } = render(<Tasks />);

    await waitFor(() => {
      expect(getByTestId('task-input')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('task-input'), 'New task');
    await act(async () => {
      fireEvent.press(getByTestId('task-add-btn'));
    });

    expect(mockApi.create).toHaveBeenCalledWith('New task');
    expect(await findByText('New task')).toBeTruthy();
  });

  it('does not create a task when title is blank', async () => {
    const { getByTestId } = render(<Tasks />);
    await waitFor(() => {
      expect(getByTestId('task-input')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('task-input'), '   ');
    await act(async () => {
      fireEvent.press(getByTestId('task-add-btn'));
    });

    expect(mockApi.create).not.toHaveBeenCalled();
  });

  it('toggles completion when checkbox is pressed', async () => {
    const task = makeTask({ id: 'task-3', title: 'Toggle me', completed: false });
    mockApi.list.mockResolvedValueOnce([task]);
    mockApi.update.mockResolvedValueOnce({ ...task, completed: true });

    const { findByTestId } = render(<Tasks />);
    const checkbox = await findByTestId('checkbox-task-3');
    await act(async () => {
      fireEvent.press(checkbox);
    });

    expect(mockApi.update).toHaveBeenCalledWith('task-3', { completed: true });
  });

  it('navigates to task detail when a card is pressed', async () => {
    const task = makeTask({ id: 'task-9', title: 'Open me' });
    mockApi.list.mockResolvedValueOnce([task]);

    const { findByTestId } = render(<Tasks />);
    const card = await findByTestId('task-card-task-9');
    await act(async () => {
      fireEvent.press(card);
    });

    expect(mockPush).toHaveBeenCalledWith('/task/task-9');
  });

  it('deletes a task when delete button is pressed', async () => {
    const task = makeTask({ id: 'task-4', title: 'Delete me' });
    mockApi.list.mockResolvedValueOnce([task]);
    mockApi.remove.mockResolvedValueOnce({ ok: true });

    const { findByTestId, queryByText } = render(<Tasks />);
    const deleteBtn = await findByTestId('delete-task-4');
    await act(async () => {
      fireEvent.press(deleteBtn);
    });

    expect(mockApi.remove).toHaveBeenCalledWith('task-4');
    await waitFor(() => {
      expect(queryByText('Delete me')).toBeNull();
    });
  });

  it('shows a list error when refresh fails', async () => {
    mockApi.list.mockRejectedValueOnce(new Error('Network down'));

    const { findByTestId, findByText } = render(<Tasks />);
    expect(await findByTestId('list-error')).toBeTruthy();
    expect(await findByText('Network down')).toBeTruthy();
  });

  it('Today filter shows uncompleted tasks with no dueAt and overdue/today', async () => {
    const now = Date.now();
    const tasks: Task[] = [
      makeTask({ id: 'a', title: 'No due, active', completed: false, dueAt: null }),
      makeTask({
        id: 'b',
        title: 'Due tomorrow',
        completed: false,
        dueAt: new Date(now + 36 * 60 * 60 * 1000).toISOString(),
      }),
      makeTask({ id: 'c', title: 'Done already', completed: true, dueAt: null }),
    ];
    mockApi.list.mockResolvedValueOnce(tasks);

    const { findByText, queryByText } = render(<Tasks />);
    expect(await findByText('No due, active')).toBeTruthy();
    expect(queryByText('Due tomorrow')).toBeNull();
    expect(queryByText('Done already')).toBeNull();
  });

  it('Upcoming filter shows future-due uncompleted tasks only', async () => {
    const now = Date.now();
    const tasks: Task[] = [
      makeTask({ id: 'a', title: 'No due', completed: false, dueAt: null }),
      makeTask({
        id: 'b',
        title: 'Due next week',
        completed: false,
        dueAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    ];
    mockApi.list.mockResolvedValueOnce(tasks);

    const { findByText, findByTestId, queryByText } = render(<Tasks />);
    await findByText('No due');
    await act(async () => {
      fireEvent.press(await findByTestId('tab-upcoming'));
    });
    expect(await findByText('Due next week')).toBeTruthy();
    expect(queryByText('No due')).toBeNull();
  });

  it('Done filter shows completed tasks only', async () => {
    const tasks: Task[] = [
      makeTask({ id: 'a', title: 'Active', completed: false }),
      makeTask({ id: 'b', title: 'Finished', completed: true }),
    ];
    mockApi.list.mockResolvedValueOnce(tasks);

    const { findByText, findByTestId, queryByText } = render(<Tasks />);
    await findByText('Active');
    await act(async () => {
      fireEvent.press(await findByTestId('tab-done'));
    });
    expect(await findByText('Finished')).toBeTruthy();
    expect(queryByText('Active')).toBeNull();
  });

  it('calls signOut when sign out is pressed', async () => {
    const { getByTestId } = render(<Tasks />);
    await waitFor(() => expect(getByTestId('sign-out')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByTestId('sign-out'));
    });

    expect(mockSignOut).toHaveBeenCalled();
  });
});
