import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import TaskDetail from '../app/(app)/task/[id]';
import { useTasks } from '../store/tasks.store';
import { tasksApi } from '../lib/api';
import type { Task } from '../lib/types';

jest.mock('../lib/api', () => ({
  tasksApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockParams = { id: 'task-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

const mockApi = tasksApi as jest.Mocked<typeof tasksApi>;

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  userId: 'user-1',
  title: 'Existing task',
  completed: false,
  dueAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  useTasks.setState({ tasks: [], loading: false, error: null });
  mockParams.id = 'task-1';
  mockApi.list.mockResolvedValue([]);
});

describe('Task detail screen', () => {
  it('shows a not-found view when the task is missing and store is empty', async () => {
    // refresh resolves with no tasks
    const { findByTestId } = render(<TaskDetail />);
    expect(await findByTestId('task-not-found')).toBeTruthy();
  });

  it('pre-fills the form with the task title when found in the store', async () => {
    useTasks.setState({ tasks: [makeTask({ id: 'task-1', title: 'Buy milk' })] });

    const { findByDisplayValue } = render(<TaskDetail />);
    expect(await findByDisplayValue('Buy milk')).toBeTruthy();
  });

  it('pre-fills the dueAt field with YYYY-MM-DD when task has a due date', async () => {
    useTasks.setState({
      tasks: [makeTask({ id: 'task-1', dueAt: '2026-06-15T00:00:00.000Z' })],
    });

    const { findByDisplayValue } = render(<TaskDetail />);
    expect(await findByDisplayValue('2026-06-15')).toBeTruthy();
  });

  it('saves a title edit and navigates back', async () => {
    useTasks.setState({ tasks: [makeTask({ id: 'task-1', title: 'Old' })] });
    mockApi.update.mockResolvedValueOnce(makeTask({ id: 'task-1', title: 'New' }));

    const { findByTestId } = render(<TaskDetail />);
    const titleInput = await findByTestId('edit-title');
    fireEvent.changeText(titleInput, 'New');
    await act(async () => {
      fireEvent.press(await findByTestId('save-btn'));
    });

    expect(mockApi.update).toHaveBeenCalledWith('task-1', {
      title: 'New',
      dueAt: null,
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('saves a dueAt edit (YYYY-MM-DD → ISO) and navigates back', async () => {
    useTasks.setState({ tasks: [makeTask({ id: 'task-1', title: 'Buy milk', dueAt: null })] });
    mockApi.update.mockResolvedValueOnce(
      makeTask({ id: 'task-1', dueAt: '2026-07-04T00:00:00.000Z' }),
    );

    const { findByTestId } = render(<TaskDetail />);
    const dueAtInput = await findByTestId('edit-dueAt');
    fireEvent.changeText(dueAtInput, '2026-07-04');
    await act(async () => {
      fireEvent.press(await findByTestId('save-btn'));
    });

    expect(mockApi.update).toHaveBeenCalledWith('task-1', {
      title: 'Buy milk',
      dueAt: '2026-07-04T00:00:00.000Z',
    });
  });

  it('blocks save when dueAt is not YYYY-MM-DD', async () => {
    useTasks.setState({ tasks: [makeTask({ id: 'task-1' })] });

    const { findByTestId, findByText } = render(<TaskDetail />);
    const dueAtInput = await findByTestId('edit-dueAt');
    fireEvent.changeText(dueAtInput, 'tomorrow');
    await act(async () => {
      fireEvent.press(await findByTestId('save-btn'));
    });

    expect(await findByText('Use YYYY-MM-DD or leave blank')).toBeTruthy();
    expect(mockApi.update).not.toHaveBeenCalled();
  });

  it('blocks save when title is blank', async () => {
    useTasks.setState({ tasks: [makeTask({ id: 'task-1', title: 'Old' })] });

    const { findByTestId, findByText } = render(<TaskDetail />);
    fireEvent.changeText(await findByTestId('edit-title'), '   ');
    await act(async () => {
      fireEvent.press(await findByTestId('save-btn'));
    });

    expect(await findByText('Enter a task')).toBeTruthy();
    expect(mockApi.update).not.toHaveBeenCalled();
  });

  it('deletes the task and navigates back', async () => {
    useTasks.setState({ tasks: [makeTask({ id: 'task-1' })] });
    mockApi.remove.mockResolvedValueOnce({ ok: true });

    const { findByTestId } = render(<TaskDetail />);
    await act(async () => {
      fireEvent.press(await findByTestId('delete-btn'));
    });

    expect(mockApi.remove).toHaveBeenCalledWith('task-1');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('navigates back when close button is pressed', async () => {
    useTasks.setState({ tasks: [makeTask({ id: 'task-1' })] });

    const { findByTestId } = render(<TaskDetail />);
    await act(async () => {
      fireEvent.press(await findByTestId('close-btn'));
    });

    expect(mockBack).toHaveBeenCalled();
  });

  it('shows an error message when save fails', async () => {
    useTasks.setState({ tasks: [makeTask({ id: 'task-1' })] });
    mockApi.update.mockRejectedValueOnce(new Error('Server down'));

    const { findByTestId, findByText } = render(<TaskDetail />);
    fireEvent.changeText(await findByTestId('edit-title'), 'Fine title');
    await act(async () => {
      fireEvent.press(await findByTestId('save-btn'));
    });

    expect(await findByText('Server down')).toBeTruthy();
  });
});
