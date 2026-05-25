import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import Calendar from '../app/(app)/(tabs)/calendar';
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

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

const mockApi = tasksApi as jest.Mocked<typeof tasksApi>;

const FIXED_NOW = new Date('2026-05-15T12:00:00.000Z'); // a Friday in May 2026

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  userId: 'u1',
  title: 'Test',
  completed: false,
  dueAt: null,
  createdAt: FIXED_NOW.toISOString(),
  updatedAt: FIXED_NOW.toISOString(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(FIXED_NOW);
  useTasks.setState({ tasks: [], loading: false, error: null });
  mockApi.list.mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Calendar screen', () => {
  it('renders the current month label', async () => {
    const { findByTestId } = render(<Calendar />);
    const label = await findByTestId('cal-month-label');
    expect(label).toHaveTextContent(/May 2026/);
  });

  it('renders all weekday headers', () => {
    const { getByText } = render(<Calendar />);
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d) =>
      expect(getByText(d)).toBeTruthy(),
    );
  });

  it('renders a cell for the 15th of the current month', async () => {
    const { findByTestId } = render(<Calendar />);
    expect(await findByTestId('cal-day-2026-05-15')).toBeTruthy();
  });

  it('navigates to the next month when next is pressed', async () => {
    const { findByTestId } = render(<Calendar />);
    await act(async () => {
      fireEvent.press(await findByTestId('cal-next'));
    });
    const label = await findByTestId('cal-month-label');
    expect(label).toHaveTextContent(/June 2026/);
  });

  it('navigates to the previous month when prev is pressed', async () => {
    const { findByTestId } = render(<Calendar />);
    await act(async () => {
      fireEvent.press(await findByTestId('cal-prev'));
    });
    const label = await findByTestId('cal-month-label');
    expect(label).toHaveTextContent(/April 2026/);
  });

  it('shows a dot on days with tasks', async () => {
    mockApi.list.mockResolvedValueOnce([makeTask({ id: 'a', dueAt: '2026-05-20T00:00:00.000Z' })]);
    const { findByTestId, queryByTestId } = render(<Calendar />);
    expect(await findByTestId('cal-dot-2026-05-20')).toBeTruthy();
    expect(queryByTestId('cal-dot-2026-05-21')).toBeNull();
  });

  it('lists tasks for the selected day after clicking it', async () => {
    mockApi.list.mockResolvedValueOnce([
      makeTask({ id: 'a', title: 'Doctor visit', dueAt: '2026-05-20T10:00:00.000Z' }),
      makeTask({ id: 'b', title: 'Pick up parcel', dueAt: '2026-05-21T00:00:00.000Z' }),
    ]);
    const { findByTestId, findByText, queryByText } = render(<Calendar />);

    // wait for refresh-triggered render
    await findByTestId('cal-dot-2026-05-20');

    await act(async () => {
      fireEvent.press(await findByTestId('cal-day-2026-05-20'));
    });
    expect(await findByText('Doctor visit')).toBeTruthy();
    expect(queryByText('Pick up parcel')).toBeNull();
  });

  it('shows an empty state when the selected day has no tasks', async () => {
    const { findByTestId } = render(<Calendar />);
    expect(await findByTestId('day-empty')).toBeTruthy();
  });

  it('navigates to task detail when a day task card is pressed', async () => {
    mockApi.list.mockResolvedValueOnce([
      makeTask({ id: 'a', title: 'Meeting', dueAt: '2026-05-15T15:00:00.000Z' }),
    ]);
    const { findByTestId } = render(<Calendar />);
    const card = await findByTestId('day-task-a');
    await act(async () => {
      fireEvent.press(card);
    });
    expect(mockPush).toHaveBeenCalledWith('/task/a');
  });

  it('calls refresh on mount', async () => {
    render(<Calendar />);
    await waitFor(() => expect(mockApi.list).toHaveBeenCalled());
  });
});
