import { itemsApi } from '../lib/api';
import { useItems } from '../store/items.store';
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
  useItems.setState({
    items: [],
    loading: false,
    error: null,
    syncing: false,
    syncSummary: null,
  });
  jest.clearAllMocks();
});

describe('useItems store', () => {
  it('refresh() loads items', async () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' })];
    mockApi.list.mockResolvedValueOnce(items);
    await useItems.getState().refresh();
    expect(useItems.getState().items).toEqual(items);
  });

  it('refresh() stores error message', async () => {
    mockApi.list.mockRejectedValueOnce(new Error('Network'));
    await useItems.getState().refresh();
    expect(useItems.getState().error).toBe('Network');
  });

  it('create() prepends', async () => {
    useItems.setState({ items: [makeItem({ id: 'old' })] });
    mockApi.create.mockResolvedValueOnce(makeItem({ id: 'new', title: 'Eggs' }));
    await useItems.getState().create({ title: 'Eggs' });
    expect(useItems.getState().items.map((t) => t.id)).toEqual(['new', 'old']);
  });

  it('update() optimistically merges then replaces with API response', async () => {
    useItems.setState({ items: [makeItem({ id: 'i1', status: 'active' })] });
    const final = makeItem({ id: 'i1', status: 'bought' });
    mockApi.update.mockResolvedValueOnce(final);

    const p = useItems.getState().update('i1', { status: 'bought' });
    expect(useItems.getState().items[0].status).toBe('bought'); // optimistic
    await p;
    expect(useItems.getState().items[0]).toEqual(final);
  });

  it('remove() optimistically removes', async () => {
    useItems.setState({ items: [makeItem({ id: 'a' }), makeItem({ id: 'b' })] });
    mockApi.remove.mockResolvedValueOnce({ ok: true });
    await useItems.getState().remove('a');
    expect(useItems.getState().items.map((t) => t.id)).toEqual(['b']);
  });

  it('sync() runs api.sync then refreshes the list', async () => {
    mockApi.sync.mockResolvedValueOnce({ created: 2, consumed: 2 });
    const fresh = [makeItem({ id: 'x', sourceDictationId: 'd1' })];
    mockApi.list.mockResolvedValueOnce(fresh);

    await useItems.getState().sync();

    expect(useItems.getState().syncSummary).toEqual({ created: 2, consumed: 2 });
    expect(useItems.getState().items).toEqual(fresh);
    expect(useItems.getState().syncing).toBe(false);
  });

  it('sync() stores error when api throws', async () => {
    mockApi.sync.mockRejectedValueOnce(new Error('Say down'));
    await useItems.getState().sync();
    expect(useItems.getState().error).toBe('Say down');
    expect(useItems.getState().syncing).toBe(false);
  });

  it('byId() returns matching or undefined', () => {
    const a = makeItem({ id: 'a' });
    useItems.setState({ items: [a] });
    expect(useItems.getState().byId('a')).toBe(a);
    expect(useItems.getState().byId('missing')).toBeUndefined();
  });
});
