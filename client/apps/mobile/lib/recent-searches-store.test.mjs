import { beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * The AsyncStorage side of recent searches. The rules live in
 * `recent-searches.ts` and are tested there; this file only proves the I/O
 * boundary — that the right key is used, and that a failing device store
 * degrades to "no recents" instead of taking the search screen down with it.
 */

const store = new Map();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    setItem: vi.fn(async (k, v) => void store.set(k, v)),
    removeItem: vi.fn(async (k) => void store.delete(k)),
  },
}));

const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
const { loadRecents, saveRecents } = await import('./recent-searches-store.ts');
const { RECENTS_KEY } = await import('./recent-searches.ts');

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe('saveRecents / loadRecents', () => {
  test('round-trips through the web\'s key', async () => {
    const list = [{ query: 'gin', timestamp: 1 }];

    await saveRecents(list);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(RECENTS_KEY, JSON.stringify(list));
    expect(await loadRecents()).toEqual(list);
  });

  test('an empty store reads as no recents', async () => {
    expect(await loadRecents()).toEqual([]);
  });

  test('a corrupt value reads as no recents rather than throwing', async () => {
    store.set(RECENTS_KEY, 'not json at all');

    expect(await loadRecents()).toEqual([]);
  });
});

describe('when the device store itself fails', () => {
  test('loadRecents degrades to empty', async () => {
    AsyncStorage.getItem.mockRejectedValueOnce(new Error('SQLITE_FULL'));

    expect(await loadRecents()).toEqual([]);
  });

  test('saveRecents swallows the failure — recents are not worth a crash', async () => {
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('quota'));

    await expect(saveRecents([{ query: 'gin', timestamp: 1 }])).resolves.toBeUndefined();
  });
});
