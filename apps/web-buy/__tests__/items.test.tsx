import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import Items from '../app/(app)/index';
import { useAuth } from '@things/web-kit';
import { useItems } from '../store/items.store';
import { itemsApi } from '../lib/api';
import type { ShoppingItem } from '../lib/types';

jest.mock('@things/web-kit', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  itemsApi: {
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

const mockApi = itemsApi as jest.Mocked<typeof itemsApi>;
const mockSignOut = jest.fn();

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
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: 'u1', email: 'test@example.com', name: 'test' },
    signOut: mockSignOut,
  });
  mockApi.list.mockResolvedValue([]);
});

describe('Items screen', () => {
  it('renders the Shopping heading', async () => {
    const { findByText } = render(<Items />);
    expect(await findByText('Shopping')).toBeTruthy();
  });

  it('shows the user email', async () => {
    const { findByText } = render(<Items />);
    expect(await findByText('test@example.com')).toBeTruthy();
  });

  it('shows an empty state when no items', async () => {
    const { findByTestId, findByText } = render(<Items />);
    expect(await findByTestId('empty-state')).toBeTruthy();
    expect(await findByText('Nothing to buy')).toBeTruthy();
  });

  it('adds an item via the input form', async () => {
    mockApi.create.mockResolvedValueOnce(makeItem({ id: 'i2', title: 'Eggs' }));
    const { getByTestId, findByText } = render(<Items />);
    await waitFor(() => expect(getByTestId('item-input')).toBeTruthy());
    fireEvent.changeText(getByTestId('item-input'), 'Eggs');
    await act(async () => {
      fireEvent.press(getByTestId('item-add-btn'));
    });
    expect(mockApi.create).toHaveBeenCalledWith({ title: 'Eggs' });
    expect(await findByText('Eggs')).toBeTruthy();
  });

  it('toggles bought when checkbox is pressed', async () => {
    const item = makeItem({ id: 'i3', title: 'Bread', status: 'active' });
    mockApi.list.mockResolvedValueOnce([item]);
    mockApi.update.mockResolvedValueOnce({ ...item, status: 'bought' });
    const { findByTestId } = render(<Items />);
    const checkbox = await findByTestId('checkbox-i3');
    await act(async () => {
      fireEvent.press(checkbox);
    });
    expect(mockApi.update).toHaveBeenCalledWith('i3', { status: 'bought' });
  });

  it('navigates to item detail when card is pressed', async () => {
    const item = makeItem({ id: 'i7', title: 'Apples' });
    mockApi.list.mockResolvedValueOnce([item]);
    const { findByTestId } = render(<Items />);
    const card = await findByTestId('item-card-i7');
    await act(async () => {
      fireEvent.press(card);
    });
    expect(mockPush).toHaveBeenCalledWith('/item/i7');
  });

  it('deletes an item', async () => {
    const item = makeItem({ id: 'i4', title: 'Cheese' });
    mockApi.list.mockResolvedValueOnce([item]);
    mockApi.remove.mockResolvedValueOnce({ ok: true });
    const { findByTestId, queryByText } = render(<Items />);
    const del = await findByTestId('delete-i4');
    await act(async () => {
      fireEvent.press(del);
    });
    expect(mockApi.remove).toHaveBeenCalledWith('i4');
    await waitFor(() => expect(queryByText('Cheese')).toBeNull());
  });

  it('switches filter to Bought tab', async () => {
    mockApi.list.mockResolvedValueOnce([
      makeItem({ id: 'a', title: 'Apples', status: 'active' }),
      makeItem({ id: 'b', title: 'Bananas', status: 'bought' }),
    ]);
    const { findByText, findByTestId, queryByText } = render(<Items />);
    await findByText('Apples');
    await act(async () => {
      fireEvent.press(await findByTestId('tab-bought'));
    });
    expect(await findByText('Bananas')).toBeTruthy();
    expect(queryByText('Apples')).toBeNull();
  });

  it('runs sync and refreshes when sync button is pressed', async () => {
    mockApi.sync.mockResolvedValueOnce({ created: 1, consumed: 1 });
    mockApi.list
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeItem({ id: 'synced', title: 'milk', sourceDictationId: 'd1' })]);
    const { findByTestId } = render(<Items />);
    const sync = await findByTestId('sync-btn');
    await act(async () => {
      fireEvent.press(sync);
    });
    expect(mockApi.sync).toHaveBeenCalled();
    expect(await findByTestId('sync-summary')).toBeTruthy();
  });

  it('marks Say-sourced items in the list', async () => {
    mockApi.list.mockResolvedValueOnce([
      makeItem({ id: 'i9', title: 'Milk', sourceDictationId: 'd1' }),
    ]);
    const { findByTestId } = render(<Items />);
    expect(await findByTestId('from-say-i9')).toBeTruthy();
  });

  it('shows a list error when refresh fails', async () => {
    mockApi.list.mockRejectedValueOnce(new Error('boom'));
    const { findByTestId, findByText } = render(<Items />);
    expect(await findByTestId('list-error')).toBeTruthy();
    expect(await findByText('boom')).toBeTruthy();
  });

  it('calls signOut when sign out is pressed', async () => {
    const { findByTestId } = render(<Items />);
    const out = await findByTestId('sign-out');
    await act(async () => {
      fireEvent.press(out);
    });
    expect(mockSignOut).toHaveBeenCalled();
  });
});
