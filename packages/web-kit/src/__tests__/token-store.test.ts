import { tokenStore } from '../token-store';

const KEY = 'things.session-token';

function workingLocalStorage() {
  const store: Record<string, string> = {};
  return {
    store,
    mock: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    },
  };
}

function setLocalStorage(value: unknown) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value });
}

describe('tokenStore', () => {
  let current: ReturnType<typeof workingLocalStorage>;

  beforeEach(() => {
    current = workingLocalStorage();
    setLocalStorage(current.mock);
    tokenStore.clear();
  });

  afterEach(() => {
    // Restore a benign localStorage so environment teardown never touches a throwing mock.
    setLocalStorage(workingLocalStorage().mock);
  });

  it('returns null when no token is stored', () => {
    expect(tokenStore.get()).toBeNull();
  });

  it('persists the token to localStorage on set and reads it back', () => {
    tokenStore.set('tok-123');
    expect(current.store[KEY]).toBe('tok-123');
    expect(tokenStore.get()).toBe('tok-123');
  });

  it('clear removes the token', () => {
    tokenStore.set('tok-123');
    tokenStore.clear();
    expect(tokenStore.get()).toBeNull();
    expect(KEY in current.store).toBe(false);
  });

  it('falls back to in-memory storage when localStorage is undefined (node/RN)', () => {
    setLocalStorage(undefined);
    tokenStore.set('mem-tok');
    expect(tokenStore.get()).toBe('mem-tok');
    tokenStore.clear();
    expect(tokenStore.get()).toBeNull();
  });

  it('falls back to in-memory storage when localStorage methods throw (blocked storage)', () => {
    setLocalStorage({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    tokenStore.set('mem-tok');
    expect(tokenStore.get()).toBe('mem-tok');
    tokenStore.clear();
    expect(tokenStore.get()).toBeNull();
  });
});
