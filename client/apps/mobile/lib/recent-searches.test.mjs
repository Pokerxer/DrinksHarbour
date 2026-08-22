import { describe, expect, test } from 'vitest';
import {
  MAX_RECENT,
  RECENTS_KEY,
  addRecent,
  clearRecents,
  parseRecents,
  removeRecent,
  serialiseRecents,
} from './recent-searches.ts';

/**
 * The web's rules, from `ModalSearchContext.tsx:147-271`: newest first,
 * case-insensitive dedup, capped at 10, persisted under `dh_recentSearches`.
 *
 * Pure on purpose — the AsyncStorage I/O lives in `recent-searches-store.ts`,
 * so every rule here is testable in vitest's `node` environment.
 */

const at = (query, timestamp) => ({ query, timestamp });

describe('the storage contract', () => {
  test('uses the same key and cap as the web', () => {
    expect(RECENTS_KEY).toBe('dh_recentSearches');
    expect(MAX_RECENT).toBe(10);
  });
});

describe('addRecent', () => {
  test('puts the newest first', () => {
    const result = addRecent([at('gin', 1)], 'rum', 2);

    expect(result.map((r) => r.query)).toEqual(['rum', 'gin']);
  });

  test('stamps the entry with the time it was given', () => {
    expect(addRecent([], 'gin', 1700)).toEqual([at('gin', 1700)]);
  });

  test('de-duplicates case-insensitively, promoting the new spelling', () => {
    const result = addRecent([at('Gin', 1), at('rum', 2)], 'GIN', 3);

    expect(result).toEqual([at('GIN', 3), at('rum', 2)]);
  });

  test('caps the list at MAX_RECENT, dropping the oldest', () => {
    let list = [];
    for (let i = 0; i < 15; i += 1) list = addRecent(list, `term-${i}`, i);

    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0].query).toBe('term-14');
    expect(list.at(-1).query).toBe('term-5');
  });

  test('ignores a blank term rather than storing an empty chip', () => {
    expect(addRecent([at('gin', 1)], '   ', 2)).toEqual([at('gin', 1)]);
  });

  test('trims the stored term', () => {
    expect(addRecent([], '  red wine  ', 1)).toEqual([at('red wine', 1)]);
  });

  test('does not mutate the list it was given', () => {
    const original = [at('gin', 1)];
    addRecent(original, 'rum', 2);

    expect(original).toEqual([at('gin', 1)]);
  });
});

describe('removeRecent', () => {
  test('drops the matching entry', () => {
    expect(removeRecent([at('gin', 1), at('rum', 2)], 'gin')).toEqual([at('rum', 2)]);
  });

  test('matches case-insensitively, so the ✕ on a chip always works', () => {
    // The web compares exactly here and can leave a chip that refuses to go
    // when the stored spelling differs from the label. Folding the comparison
    // is the smaller, safer rule.
    expect(removeRecent([at('Gin', 1)], 'gin')).toEqual([]);
  });

  test('an unknown term leaves the list alone', () => {
    expect(removeRecent([at('gin', 1)], 'vodka')).toEqual([at('gin', 1)]);
  });
});

describe('clearRecents', () => {
  test('is empty', () => {
    expect(clearRecents()).toEqual([]);
  });
});

describe('parseRecents', () => {
  test('reads what serialiseRecents wrote', () => {
    const list = [at('gin', 1), at('rum', 2)];

    expect(parseRecents(serialiseRecents(list))).toEqual(list);
  });

  test('tolerates every shape of garbage rather than throwing', () => {
    // Storage is a place other code, other versions and the user's device can
    // all corrupt. A search screen must never fail to open because of it.
    for (const bad of [null, undefined, '', 'not json', '{}', '[1,2,3]', '{"a":1}', '"gin"']) {
      expect(parseRecents(bad)).toEqual([]);
    }
  });

  test('drops entries with no usable query', () => {
    expect(parseRecents('[{"query":"gin","timestamp":1},{"query":""},{"timestamp":2},null]')).toEqual([
      at('gin', 1),
    ]);
  });

  test('defaults a missing timestamp to 0 rather than dropping the term', () => {
    expect(parseRecents('[{"query":"gin"}]')).toEqual([at('gin', 0)]);
  });

  test('re-applies the cap, in case an older build wrote more', () => {
    const many = JSON.stringify(
      Array.from({ length: 25 }, (_, i) => at(`term-${i}`, i))
    );

    expect(parseRecents(many)).toHaveLength(MAX_RECENT);
  });
});
