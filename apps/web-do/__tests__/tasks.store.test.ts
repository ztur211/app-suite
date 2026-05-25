import { tasksApi } from '../lib/api';
import { useTasks } from '../store/tasks.store';
import type { Task } from '../lib/types';

jest.mock('../lib/api', () => ({
  tasksApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const mockApi = tasksApi as jest.Mocked<typeof tasksApi>;

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  userId: 'u1',
  title: 'Test',
  completed: false,
  dueAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  useTasks.setState({ tasks: [], loading: false, error: null });
  jest.clearAllMocks();
});

describe('useTasks store', () => {
  it('refresh() loads tasks from the API', async () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' })];
    mockApi.list.mockResolvedValueOnce(tasks);

    await useTasks.getState().refresh();

    expect(useTasks.getState().tasks).toEqual(tasks);
    expect(useTasks.getState().loading).toBe(false);
    expect(useTasks.getState().error).toBeNull();
  });

  it('refresh() stores error message when API throws', async () => {
    mockApi.list.mockRejectedValueOnce(new Error('Network'));

    await useTasks.getState().refresh();

    expect(useTasks.getState().error).toBe('Network');
    expect(useTasks.getState().loading).toBe(false);
  });

  it('create() prepends the new task to the list', async () => {
    useTasks.setState({ tasks: [makeTask({ id: 'old' })] });
    const created = makeTask({ id: 'new', title: 'New' });
    mockApi.create.mockResolvedValueOnce(created);

    await useTasks.getState().create('New');

    expect(useTasks.getState().tasks.map((t) => t.id)).toEqual(['new', 'old']);
  });

  it('update() optimistically merges then replaces with API response', async () => {
    useTasks.setState({ tasks: [makeTask({ id: 't1', title: 'Old', completed: false })] });
    const finalTask = makeTask({ id: 't1', title: 'Old', completed: true });
    mockApi.update.mockResolvedValueOnce(finalTask);

    const updatePromise = useTasks.getState().update('t1', { completed: true });
    // After optimistic merge but before API resolves
    expect(useTasks.getState().tasks[0].completed).toBe(true);
    await updatePromise;
    expect(useTasks.getState().tasks[0]).toEqual(finalTask);
  });

  it('update() applies title and dueAt partials', async () => {
    useTasks.setState({ tasks: [makeTask({ id: 't1', title: 'Old', dueAt: null })] });
    const dueAt = '2026-07-01T00:00:00.000Z';
    const finalTask = makeTask({ id: 't1', title: 'New', dueAt });
    mockApi.update.mockResolvedValueOnce(finalTask);

    await useTasks.getState().update('t1', { title: 'New', dueAt });

    expect(mockApi.update).toHaveBeenCalledWith('t1', { title: 'New', dueAt });
    expect(useTasks.getState().tasks[0].dueAt).toBe(dueAt);
  });

  it('remove() optimistically removes the task and calls API', async () => {
    useTasks.setState({
      tasks: [makeTask({ id: 'a' }), makeTask({ id: 'b' })],
    });
    mockApi.remove.mockResolvedValueOnce({ ok: true });

    await useTasks.getState().remove('a');

    expect(useTasks.getState().tasks.map((t) => t.id)).toEqual(['b']);
    expect(mockApi.remove).toHaveBeenCalledWith('a');
  });

  it('byId() returns the matching task or undefined', () => {
    const a = makeTask({ id: 'a' });
    useTasks.setState({ tasks: [a] });
    expect(useTasks.getState().byId('a')).toBe(a);
    expect(useTasks.getState().byId('missing')).toBeUndefined();
  });
});
