import { describe, expect, test } from 'vitest';
import {
  BROWSE_CATEGORIES,
  POPULAR_SEARCHES,
  QUICK_ACTIONS,
  SUGGESTION_LIMIT,
  resolveSuggestions,
  suggestionFallback,
} from './search-defaults.ts';

/**
 * The four sections of the web's default panel
 * (`ModalSearch.tsx:837-934`, all of it visible at phone width) plus the
 * suggestion fallback from `ModalSearchContext.tsx:449-463`.
 */

describe('QUICK_ACTIONS', () => {
  test('is the web\'s four, in order, with the web\'s hrefs', () => {
    expect(QUICK_ACTIONS.map((a) => [a.label, a.href])).toEqual([
      ['On Sale', '/deals'],
      ['New Arrivals', '/shop?sort=newest'],
      ['Bestsellers', '/shop?sort=popular'],
      ['Top Rated', '/shop?minRating=4'],
    ]);
  });
});

describe('BROWSE_CATEGORIES', () => {
  test('is the web\'s eight emoji tiles, in order', () => {
    expect(BROWSE_CATEGORIES.map((c) => c.slug)).toEqual([
      'whiskey', 'wine', 'beer', 'champagne', 'vodka', 'gin', 'rum', 'spirit',
    ]);
  });

  test('every tile carries an emoji and a name', () => {
    for (const c of BROWSE_CATEGORIES) {
      expect(c.emoji).toBeTruthy();
      expect(c.name).toBeTruthy();
    }
  });
});

describe('POPULAR_SEARCHES', () => {
  test('is the web\'s ten trending terms, in order', () => {
    expect(POPULAR_SEARCHES).toEqual([
      'Whiskey', 'Red Wine', 'Beer', 'Vodka', 'Champagne',
      'Gin', 'Rum', 'Brandy', 'Tequila', 'Rosé',
    ]);
  });
});

describe('suggestionFallback', () => {
  // What the web shows when /api/products/suggestions answers with nothing.
  const recents = [{ query: 'Whisky sour', timestamp: 2 }, { query: 'Rum punch', timestamp: 1 }];

  test('offers recents before the popular list', () => {
    // Substring anywhere, not prefix — "sour", "Beer" and "Rosé" all contain
    // an "r". That is the web's rule (`lower.includes(q)`), kept verbatim.
    expect(suggestionFallback('r', recents)).toEqual([
      'Whisky sour',
      'Rum punch',
      'Red Wine',
      'Beer',
      'Rum',
      'Brandy',
      'Rosé',
    ]);
  });

  test('matches anywhere in the term, not just the start', () => {
    expect(suggestionFallback('wine', recents)).toEqual(['Red Wine']);
  });

  test('is case-insensitive', () => {
    expect(suggestionFallback('GIN', recents)).toEqual(['Gin']);
  });

  test('de-duplicates case-insensitively across the two sources', () => {
    const withDupe = [{ query: 'gin', timestamp: 1 }];

    // 'gin' from recents wins; the popular 'Gin' is not offered twice.
    expect(suggestionFallback('gin', withDupe)).toEqual(['gin']);
  });

  test('stops at SUGGESTION_LIMIT', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ query: `wine ${i}`, timestamp: i }));

    expect(suggestionFallback('wine', many)).toHaveLength(SUGGESTION_LIMIT);
  });

  test('an unmatched term offers nothing rather than everything', () => {
    expect(suggestionFallback('zzzz', recents)).toEqual([]);
  });

  test('a blank term offers nothing — the default panel owns that state', () => {
    expect(suggestionFallback('   ', recents)).toEqual([]);
  });
});

describe('resolveSuggestions', () => {
  // Which list the chip strip shows. The web's context has this rule
  // (`ModalSearchContext.tsx:436-463`) but never renders the result; the mobile
  // search screen does, at the user's request.
  const recents = [{ query: 'Whisky sour', timestamp: 2 }];

  test('prefers the server list when it returned anything', () => {
    expect(resolveSuggestions(['Akashi Blended Whisky'], 'whi', recents)).toEqual([
      'Akashi Blended Whisky',
    ]);
  });

  test('falls back to recents + popular when the server returned an empty list', () => {
    expect(resolveSuggestions([], 'whi', recents)).toEqual(['Whisky sour', 'Whiskey']);
  });

  test('falls back the same way when the request FAILED', () => {
    // null means "no answer", not "no matches" — a dead endpoint should still
    // leave the user something to tap.
    expect(resolveSuggestions(null, 'whi', recents)).toEqual(['Whisky sour', 'Whiskey']);
  });

  test('never offers back exactly what is already typed', () => {
    // A chip that re-runs the current search is a dead control.
    expect(resolveSuggestions(['Gin', 'Gin & Tonic'], 'gin', [])).toEqual(['Gin & Tonic']);
  });

  test('ignores case and surrounding space when filtering the typed term', () => {
    expect(resolveSuggestions(['Gin'], '  GIN  ', [])).toEqual([]);
  });

  test('caps the strip at SUGGESTION_LIMIT', () => {
    const many = Array.from({ length: 20 }, (_, i) => `whisky ${i}`);

    expect(resolveSuggestions(many, 'whi', [])).toHaveLength(SUGGESTION_LIMIT);
  });

  test('a blank term offers nothing — the default panel owns that state', () => {
    expect(resolveSuggestions(['Gin'], '   ', recents)).toEqual([]);
  });

  test('drops blanks and non-strings the server should never have sent', () => {
    expect(resolveSuggestions(['Gin', '', '  '], 'gi', [])).toEqual(['Gin']);
  });
});
