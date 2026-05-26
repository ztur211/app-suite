import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import Meals from '../app/(app)/index';
import { useAuth } from '../store/auth.store';
import { useMeals } from '../store/meals.store';
import { mealsApi } from '../lib/api';
import type { MealItem } from '../lib/types';

jest.mock('../store/auth.store', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  mealsApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    sync: jest.fn(),
  },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

const mockApi = mealsApi as jest.Mocked<typeof mealsApi>;
const mockSignOut = jest.fn();

const makeMeal = (overrides: Partial<MealItem> = {}): MealItem => ({
  id: 'm1',
  userId: 'u1',
  name: 'Tacos',
  kind: 'recipe',
  notes: null,
  status: 'active',
  sourceDictationId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  useMeals.setState({
    meals: [],
    loading: false,
    error: null,
    syncing: false,
    syncSummary: null,
  });
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: 'u1', email: 'test@example.com', name: 'test' },
    signOut: mockSignOut,
  });
  mockApi.list.mockResolvedValue([]);
});

describe('Meals screen', () => {
  it('renders the Meals heading', async () => {
    const { findByText } = render(<Meals />);
    expect(await findByText('Meals')).toBeTruthy();
  });

  it('shows an empty state when no meals', async () => {
    const { findByTestId, findByText } = render(<Meals />);
    expect(await findByTestId('empty-state')).toBeTruthy();
    expect(await findByText('Nothing to try')).toBeTruthy();
  });

  it('adds a meal via the form with selected kind', async () => {
    mockApi.create.mockResolvedValueOnce(makeMeal({ id: 'm2', name: 'Sushi', kind: 'restaurant' }));
    const { getByTestId, findByText } = render(<Meals />);
    await waitFor(() => expect(getByTestId('meal-input')).toBeTruthy());
    fireEvent.changeText(getByTestId('meal-input'), 'Sushi');
    await act(async () => {
      fireEvent.press(getByTestId('kind-restaurant'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('meal-add-btn'));
    });
    expect(mockApi.create).toHaveBeenCalledWith({ name: 'Sushi', kind: 'restaurant' });
    expect(await findByText('Sushi')).toBeTruthy();
  });

  it('toggles tried when checkbox is pressed', async () => {
    const meal = makeMeal({ id: 'm3', name: 'Pizza', status: 'active' });
    mockApi.list.mockResolvedValueOnce([meal]);
    mockApi.update.mockResolvedValueOnce({ ...meal, status: 'tried' });
    const { findByTestId } = render(<Meals />);
    const checkbox = await findByTestId('checkbox-m3');
    await act(async () => {
      fireEvent.press(checkbox);
    });
    expect(mockApi.update).toHaveBeenCalledWith('m3', { status: 'tried' });
  });

  it('navigates to meal detail when card is pressed', async () => {
    const meal = makeMeal({ id: 'm7', name: 'Curry' });
    mockApi.list.mockResolvedValueOnce([meal]);
    const { findByTestId } = render(<Meals />);
    const card = await findByTestId('meal-card-m7');
    await act(async () => {
      fireEvent.press(card);
    });
    expect(mockPush).toHaveBeenCalledWith('/meal/m7');
  });

  it('deletes a meal', async () => {
    const meal = makeMeal({ id: 'm4', name: 'Burger' });
    mockApi.list.mockResolvedValueOnce([meal]);
    mockApi.remove.mockResolvedValueOnce({ ok: true });
    const { findByTestId, queryByText } = render(<Meals />);
    const del = await findByTestId('delete-m4');
    await act(async () => {
      fireEvent.press(del);
    });
    expect(mockApi.remove).toHaveBeenCalledWith('m4');
    await waitFor(() => expect(queryByText('Burger')).toBeNull());
  });

  it('switches filter to Tried tab', async () => {
    mockApi.list.mockResolvedValueOnce([
      makeMeal({ id: 'a', name: 'Active meal', status: 'active' }),
      makeMeal({ id: 'b', name: 'Done meal', status: 'tried' }),
    ]);
    const { findByText, findByTestId, queryByText } = render(<Meals />);
    await findByText('Active meal');
    await act(async () => {
      fireEvent.press(await findByTestId('tab-tried'));
    });
    expect(await findByText('Done meal')).toBeTruthy();
    expect(queryByText('Active meal')).toBeNull();
  });

  it('marks Say-sourced meals in the list', async () => {
    mockApi.list.mockResolvedValueOnce([makeMeal({ id: 'm9', sourceDictationId: 'd1' })]);
    const { findByTestId } = render(<Meals />);
    expect(await findByTestId('from-say-m9')).toBeTruthy();
  });

  it('shows the kind badge for each meal', async () => {
    mockApi.list.mockResolvedValueOnce([
      makeMeal({ id: 'm1', kind: 'recipe' }),
      makeMeal({ id: 'm2', kind: 'restaurant' }),
    ]);
    const { findByTestId } = render(<Meals />);
    expect(await findByTestId('kind-badge-m1')).toBeTruthy();
    expect(await findByTestId('kind-badge-m2')).toBeTruthy();
  });

  it('runs sync when sync button is pressed', async () => {
    mockApi.sync.mockResolvedValueOnce({ created: 1, consumed: 1 });
    mockApi.list
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeMeal({ id: 'synced', name: 'pho', sourceDictationId: 'd1' })]);
    const { findByTestId } = render(<Meals />);
    const sync = await findByTestId('sync-btn');
    await act(async () => {
      fireEvent.press(sync);
    });
    expect(mockApi.sync).toHaveBeenCalled();
    expect(await findByTestId('sync-summary')).toBeTruthy();
  });

  it('shows a list error when refresh fails', async () => {
    mockApi.list.mockRejectedValueOnce(new Error('boom'));
    const { findByTestId } = render(<Meals />);
    expect(await findByTestId('list-error')).toBeTruthy();
  });

  it('calls signOut when sign out is pressed', async () => {
    const { findByTestId } = render(<Meals />);
    const out = await findByTestId('sign-out');
    await act(async () => {
      fireEvent.press(out);
    });
    expect(mockSignOut).toHaveBeenCalled();
  });
});
