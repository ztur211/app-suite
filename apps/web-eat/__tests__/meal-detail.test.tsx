import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import MealDetail from '../app/(app)/meal/[id]';
import { useMeals } from '../store/meals.store';
import { mealsApi } from '../lib/api';
import type { MealItem } from '../lib/types';

jest.mock('../lib/api', () => ({
  mealsApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    sync: jest.fn(),
  },
}));

const mockBack = jest.fn();
const mockParams = { id: 'm1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

const mockApi = mealsApi as jest.Mocked<typeof mealsApi>;

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
  mockParams.id = 'm1';
  mockApi.list.mockResolvedValue([]);
});

describe('Meal detail screen', () => {
  it('shows not-found when meal is missing', async () => {
    const { findByTestId } = render(<MealDetail />);
    expect(await findByTestId('meal-not-found')).toBeTruthy();
  });

  it('pre-fills the form when found', async () => {
    useMeals.setState({
      meals: [makeMeal({ id: 'm1', name: 'Sushi', kind: 'restaurant', notes: 'omakase' })],
    });
    const { findByDisplayValue } = render(<MealDetail />);
    expect(await findByDisplayValue('Sushi')).toBeTruthy();
    expect(await findByDisplayValue('omakase')).toBeTruthy();
  });

  it('saves a name edit and navigates back', async () => {
    useMeals.setState({ meals: [makeMeal({ id: 'm1', name: 'Old' })] });
    mockApi.update.mockResolvedValueOnce(makeMeal({ id: 'm1', name: 'New' }));
    const { findByTestId } = render(<MealDetail />);
    fireEvent.changeText(await findByTestId('edit-name'), 'New');
    await act(async () => {
      fireEvent.press(await findByTestId('save-btn'));
    });
    expect(mockApi.update).toHaveBeenCalledWith('m1', {
      name: 'New',
      kind: 'recipe',
      notes: null,
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('changes kind via kind buttons', async () => {
    useMeals.setState({ meals: [makeMeal({ id: 'm1', kind: 'recipe' })] });
    mockApi.update.mockResolvedValueOnce(makeMeal({ id: 'm1', kind: 'restaurant' }));
    const { findByTestId } = render(<MealDetail />);
    await act(async () => {
      fireEvent.press(await findByTestId('edit-kind-restaurant'));
    });
    await act(async () => {
      fireEvent.press(await findByTestId('save-btn'));
    });
    expect(mockApi.update).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ kind: 'restaurant' }),
    );
  });

  it('toggles tried via toggle button', async () => {
    useMeals.setState({ meals: [makeMeal({ id: 'm1', status: 'active' })] });
    mockApi.update.mockResolvedValueOnce(makeMeal({ id: 'm1', status: 'tried' }));
    const { findByTestId } = render(<MealDetail />);
    await act(async () => {
      fireEvent.press(await findByTestId('toggle-tried-btn'));
    });
    expect(mockApi.update).toHaveBeenCalledWith('m1', { status: 'tried' });
  });

  it('deletes and navigates back', async () => {
    useMeals.setState({ meals: [makeMeal({ id: 'm1' })] });
    mockApi.remove.mockResolvedValueOnce({ ok: true });
    const { findByTestId } = render(<MealDetail />);
    await act(async () => {
      fireEvent.press(await findByTestId('delete-btn'));
    });
    expect(mockApi.remove).toHaveBeenCalledWith('m1');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });
});
