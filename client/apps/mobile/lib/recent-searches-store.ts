/**
 * Recent searches, persisted.
 *
 * The only place in the search feature that touches AsyncStorage. The rules
 * live in `recent-searches.ts`; keeping the I/O here is what lets those rules
 * be tested in vitest's `node` environment, where a native module cannot load.
 *
 * Both calls swallow failures. A list of search terms is never worth taking the
 * search screen down for — the worst case is that the Recent section is absent.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RECENTS_KEY, parseRecents, serialiseRecents, type RecentSearch } from './recent-searches.ts';

export async function loadRecents(): Promise<RecentSearch[]> {
  try {
    return parseRecents(await AsyncStorage.getItem(RECENTS_KEY));
  } catch {
    return [];
  }
}

export async function saveRecents(list: RecentSearch[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RECENTS_KEY, serialiseRecents(list));
  } catch {
    /* device store full or unavailable — the in-memory list still works */
  }
}
