import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import Today from '../app/(app)/index';
import { useAuth } from '../store/auth.store';
import { tasksApi } from '../lib/api';
import type { Task } from '../lib/types';

jest.mock('../store/auth.store', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  tasksApi: {
    list: jest.fn(),
    create: jest.fn(),
    setCompleted: jest.fn(),
    remove: jest.fn(),
  },
}));

const mockTasksApi = tasksApi as jest.Mocked<typeof tasksApi>;
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
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: 'user-1', email: 'test@example.com', name: 'test' },
    signOut: mockSignOut,
  });
  mockTasksApi.list.mockResolvedValue([]);
});

describe('Today screen', () => {
  it('renders without crashing', async () => {
    const { getByText } = render(<Today />);
    await waitFor(() => {
      expect(getByText('Today')).toBeTruthy();
    });
  });

  it('shows the user email', async () => {
    const { getByText } = render(<Today />);
    await waitFor(() => {
      expect(getByText('test@example.com')).toBeTruthy();
    });
  });

  it('renders the task input', async () => {
    const { getByTestId } = render(<Today />);
    await waitFor(() => {
      expect(getByTestId('task-input')).toBeTruthy();
    });
  });

  it('shows a task returned by tasksApi.list', async () => {
    mockTasksApi.list.mockResolvedValueOnce([makeTask({ title: 'Buy groceries' })]);

    const { findByText } = render(<Today />);
    expect(await findByText('Buy groceries')).toBeTruthy();
  });

  it('adds a task when Add button is pressed', async () => {
    const newTask = makeTask({ id: 'task-2', title: 'New task' });
    mockTasksApi.create.mockResolvedValueOnce(newTask);

    const { getByTestId, findByText } = render(<Today />);

    await waitFor(() => {
      expect(getByTestId('task-input')).toBeTruthy();
    });

    fireEvent.changeText(getByTestId('task-input'), 'New task');
    await act(async () => {
      fireEvent.press(getByTestId('task-add-btn'));
    });

    expect(mockTasksApi.create).toHaveBeenCalledWith('New task');
    expect(await findByText('New task')).toBeTruthy();
  });

  it('toggles a task on card press', async () => {
    const task = makeTask({ id: 'task-3', title: 'Toggle me', completed: false });
    mockTasksApi.list.mockResolvedValueOnce([task]);
    mockTasksApi.setCompleted.mockResolvedValueOnce({ ...task, completed: true });

    const { findByTestId } = render(<Today />);

    // Wait for the checkbox to appear (task loaded)
    const checkbox = await findByTestId('checkbox-task-3');
    await act(async () => {
      fireEvent.press(checkbox.parent!);
    });

    expect(mockTasksApi.setCompleted).toHaveBeenCalledWith('task-3', true);
  });

  it('deletes a task when delete button is pressed', async () => {
    const task = makeTask({ id: 'task-4', title: 'Delete me' });
    mockTasksApi.list.mockResolvedValueOnce([task]);
    mockTasksApi.remove.mockResolvedValueOnce({ ok: true });

    const { findByTestId, queryByText } = render(<Today />);

    const deleteBtn = await findByTestId('delete-task-4');
    await act(async () => {
      fireEvent.press(deleteBtn);
    });

    expect(mockTasksApi.remove).toHaveBeenCalledWith('task-4');
    await waitFor(() => {
      expect(queryByText('Delete me')).toBeNull();
    });
  });

  it('calls signOut when sign out is pressed', async () => {
    const { getByTestId } = render(<Today />);
    await waitFor(() => expect(getByTestId('sign-out')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByTestId('sign-out'));
    });

    expect(mockSignOut).toHaveBeenCalled();
  });
});
