import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import ItemDetail from '../app/(app)/item/[id]';
import { useItems } from '../store/items.store';
import { itemsApi } from '../lib/api';
import type { ShoppingItem } from '../lib/types';

jest.mock('../lib/api', () => ({
  itemsApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    sync: jest.fn(),
  },
}));

const mockBack = jest.fn();
const mockParams = { id: 'i1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

const mockApi = itemsApi as jest.Mocked<typeof itemsApi>;

const makeItem = (overrides: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id: 'i1',
  userId: 'u1',
  title: 'Milk',
  quantity: null,
  notes: null,
  status: 'active',
  sourceDictationId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  useItems.setState({
    items: [],
    loading: false,
    error: null,
    syncing: false,
    syncSummary: null,
  });
  mockParams.id = 'i1';
  mockApi.list.mockResolvedValue([]);
});

describe('Item detail screen', () => {
  it('shows not-found when item is missing', async () => {
    const { findByTestId } = render(<ItemDetail />);
    expect(await findByTestId('item-not-found')).toBeTruthy();
  });

  it('pre-fills the form with item fields when found', async () => {
    useItems.setState({
      items: [makeItem({ id: 'i1', title: 'Milk', quantity: 2, notes: 'whole' })],
    });
    const { findByDisplayValue } = render(<ItemDetail />);
    expect(await findByDisplayValue('Milk')).toBeTruthy();
    expect(await findByDisplayValue('2')).toBeTruthy();
    expect(await findByDisplayValue('whole')).toBeTruthy();
  });

  it('saves an edit and navigates back', async () => {
    useItems.setState({ items: [makeItem({ id: 'i1', title: 'Milk' })] });
    mockApi.update.mockResolvedValueOnce(makeItem({ id: 'i1', title: 'Almond milk' }));
    const { findByTestId } = render(<ItemDetail />);
    fireEvent.changeText(await findByTestId('edit-title'), 'Almond milk');
    await act(async () => {
      fireEvent.press(await findByTestId('save-btn'));
    });
    expect(mockApi.update).toHaveBeenCalledWith('i1', {
      title: 'Almond milk',
      quantity: null,
      notes: null,
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('saves quantity as a number when provided', async () => {
    useItems.setState({ items: [makeItem({ id: 'i1', title: 'Eggs', quantity: null })] });
    mockApi.update.mockResolvedValueOnce(makeItem({ id: 'i1', quantity: 12 }));
    const { findByTestId } = render(<ItemDetail />);
    fireEvent.changeText(await findByTestId('edit-quantity'), '12');
    await act(async () => {
      fireEvent.press(await findByTestId('save-btn'));
    });
    expect(mockApi.update).toHaveBeenCalledWith('i1', {
      title: 'Eggs',
      quantity: 12,
      notes: null,
    });
  });

  it('rejects non-numeric quantity', async () => {
    useItems.setState({ items: [makeItem({ id: 'i1' })] });
    const { findByTestId, findByText } = render(<ItemDetail />);
    fireEvent.changeText(await findByTestId('edit-quantity'), '12.5');
    await act(async () => {
      fireEvent.press(await findByTestId('save-btn'));
    });
    expect(await findByText('Whole numbers only')).toBeTruthy();
    expect(mockApi.update).not.toHaveBeenCalled();
  });

  it('toggles bought status via toggle button', async () => {
    useItems.setState({ items: [makeItem({ id: 'i1', status: 'active' })] });
    mockApi.update.mockResolvedValueOnce(makeItem({ id: 'i1', status: 'bought' }));
    const { findByTestId } = render(<ItemDetail />);
    await act(async () => {
      fireEvent.press(await findByTestId('toggle-bought-btn'));
    });
    expect(mockApi.update).toHaveBeenCalledWith('i1', { status: 'bought' });
  });

  it('deletes and navigates back', async () => {
    useItems.setState({ items: [makeItem({ id: 'i1' })] });
    mockApi.remove.mockResolvedValueOnce({ ok: true });
    const { findByTestId } = render(<ItemDetail />);
    await act(async () => {
      fireEvent.press(await findByTestId('delete-btn'));
    });
    expect(mockApi.remove).toHaveBeenCalledWith('i1');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('closes via close button', async () => {
    useItems.setState({ items: [makeItem({ id: 'i1' })] });
    const { findByTestId } = render(<ItemDetail />);
    await act(async () => {
      fireEvent.press(await findByTestId('close-btn'));
    });
    expect(mockBack).toHaveBeenCalled();
  });
});
