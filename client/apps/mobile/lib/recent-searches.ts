/**
 * Recent searches — the rules only. No storage.
 *
 * The web keeps these in `localStorage` under `dh_recentSearches`
 * (`ModalSearchContext.tsx:147-271`). Mobile has no localStorage; the
 * AsyncStorage I/O lives in `recent-searches-store.ts` so that every rule below
 * stays pure and testable in vitest's `node` environment, where no component
 * and no native module can be loaded.
 */

/** Same key as the web, so the two apps describe the same thing. */
export const RECENTS_KEY = 'dh_recentSearches';

export const MAX_RECENT = 10;

export interface RecentSearch {
  query: string;
  timestamp: number;
}

/** Newest first, case-insensitive dedup, capped. `now` is passed in, never read. */
export function addRecent(list: RecentSearch[], query: string, now: number): RecentSearch[] {
  const term = query.trim();
  if (!term) return list;

  const folded = term.toLowerCase();
  return [{ query: term, timestamp: now }, ...list.filter((r) => r.query.toLowerCase() !== folded)]
    .slice(0, MAX_RECENT);
}

/**
 * Case-insensitive, unlike the web's exact comparison. A chip whose stored
 * spelling differs from its label would otherwise refuse to be dismissed.
 */
export function removeRecent(list: RecentSearch[], query: string): RecentSearch[] {
  const folded = query.trim().toLowerCase();
  return list.filter((r) => r.query.toLowerCase() !== folded);
}

export function clearRecents(): RecentSearch[] {
  return [];
}

export function serialiseRecents(list: RecentSearch[]): string {
  return JSON.stringify(list);
}

/**
 * Storage is a place other code, other app versions and the device itself can
 * all corrupt. Every failure mode degrades to "no recents" — the search screen
 * must never fail to open because of a bad string.
 */
export function parseRecents(raw: string | null | undefined): RecentSearch[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry): RecentSearch | null => {
      const query = (entry as { query?: unknown } | null)?.query;
      if (typeof query !== 'string' || !query.trim()) return null;
      const timestamp = (entry as { timestamp?: unknown }).timestamp;
      return {
        query: query.trim(),
        timestamp: typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : 0,
      };
    })
    .filter((r): r is RecentSearch => r !== null)
    .slice(0, MAX_RECENT);
}
