import { mealsApi } from '../lib/api';
import { useMeals } from '../store/meals.store';
import type { DiscoveryResult, MealItem } from '../lib/types';

jest.mock('../lib/api', () => ({
  mealsApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    sync: jest.fn(),
    search: jest.fn(),
  },
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

const makeResult = (overrides: Partial<DiscoveryResult> = {}): DiscoveryResult => ({
  id: 'r1',
  name: 'Tacos',
  imageUrl: null,
  kind: 'recipe',
  detail: null,
  url: null,
  source: 'fake',
  ...overrides,
});

beforeEach(() => {
  useMeals.setState({
    meals: [],
    loading: false,
    error: null,
    syncing: false,
    syncSummary: null,
    results: [],
    searching: false,
  });
  jest.clearAllMocks();
});

describe('useMeals store', () => {
  it('refresh() loads meals', async () => {
    const meals = [makeMeal({ id: 'a' })];
    mockApi.list.mockResolvedValueOnce(meals);
    await useMeals.getState().refresh();
    expect(useMeals.getState().meals).toEqual(meals);
  });

  it('refresh() stores error on failure', async () => {
    mockApi.list.mockRejectedValueOnce(new Error('Network'));
    await useMeals.getState().refresh();
    expect(useMeals.getState().error).toBe('Network');
  });

  it('create() prepends', async () => {
    useMeals.setState({ meals: [makeMeal({ id: 'old' })] });
    mockApi.create.mockResolvedValueOnce(makeMeal({ id: 'new', name: 'Pizza' }));
    await useMeals.getState().create({ name: 'Pizza', kind: 'recipe' });
    expect(useMeals.getState().meals.map((m) => m.id)).toEqual(['new', 'old']);
  });

  it('update() optimistically merges then replaces', async () => {
    useMeals.setState({ meals: [makeMeal({ id: 'm1', status: 'active' })] });
    const final = makeMeal({ id: 'm1', status: 'tried' });
    mockApi.update.mockResolvedValueOnce(final);
    const p = useMeals.getState().update('m1', { status: 'tried' });
    expect(useMeals.getState().meals[0].status).toBe('tried');
    await p;
    expect(useMeals.getState().meals[0]).toEqual(final);
  });

  it('remove() optimistically removes', async () => {
    useMeals.setState({ meals: [makeMeal({ id: 'a' }), makeMeal({ id: 'b' })] });
    mockApi.remove.mockResolvedValueOnce({ ok: true });
    await useMeals.getState().remove('a');
    expect(useMeals.getState().meals.map((m) => m.id)).toEqual(['b']);
  });

  it('sync() refreshes after calling api.sync', async () => {
    mockApi.sync.mockResolvedValueOnce({ created: 1, consumed: 1 });
    mockApi.list.mockResolvedValueOnce([makeMeal({ id: 's', sourceDictationId: 'd' })]);
    await useMeals.getState().sync();
    expect(useMeals.getState().syncSummary).toEqual({ created: 1, consumed: 1 });
    expect(useMeals.getState().meals).toHaveLength(1);
  });

  it('byId() returns matching meal or undefined', () => {
    const a = makeMeal({ id: 'a' });
    useMeals.setState({ meals: [a] });
    expect(useMeals.getState().byId('a')).toBe(a);
    expect(useMeals.getState().byId('missing')).toBeUndefined();
  });

  it('search() stores results from the {kind, results} envelope', async () => {
    const results = [makeResult({ id: 'r1' }), makeResult({ id: 'r2' })];
    mockApi.search.mockResolvedValueOnce({ kind: 'recipe', results });

    await useMeals.getState().search('tacos', 'recipe');

    expect(mockApi.search).toHaveBeenCalledWith('tacos', 'recipe');
    expect(useMeals.getState().results).toEqual(results);
    expect(useMeals.getState().searching).toBe(false);
  });

  it('search() stores an error on failure', async () => {
    mockApi.search.mockRejectedValueOnce(new Error('Yelp down'));
    await useMeals.getState().search('sushi', 'restaurant');
    expect(useMeals.getState().error).toBe('Yelp down');
    expect(useMeals.getState().searching).toBe(false);
  });

  it('addResult() creates a meal from the result and drops it from results', async () => {
    const r = makeResult({
      id: 'r1',
      name: 'Teriyaki Chicken',
      kind: 'recipe',
      detail: 'Chicken · Japanese',
    });
    useMeals.setState({ results: [r, makeResult({ id: 'r2' })] });
    mockApi.create.mockResolvedValueOnce(makeMeal({ id: 'new', name: 'Teriyaki Chicken' }));

    await useMeals.getState().addResult(r);

    expect(mockApi.create).toHaveBeenCalledWith({
      name: 'Teriyaki Chicken',
      kind: 'recipe',
      notes: 'Chicken · Japanese',
    });
    expect(useMeals.getState().meals.map((m) => m.id)).toContain('new');
    expect(useMeals.getState().results.map((x) => x.id)).toEqual(['r2']);
  });
});
