import { describe, expect, test } from 'vitest';
import {
  foldText,
  matchesTerms,
  queryTerms,
  splitHighlight,
  toPattern,
} from './search-highlight.ts';

/**
 * Transcribed from `apps/platform/src/components/Modal/ModalSearch.tsx:143-223`.
 * These are the functions that let a hit for "medoc" explain itself against a
 * bottle whose name reads "Médoc".
 */

describe('foldText', () => {
  test('strips accents and lowercases', () => {
    expect(foldText('Médoc')).toBe('medoc');
    expect(foldText('Rosé')).toBe('rose');
    expect(foldText('Saint-Estèphe')).toBe('saint-estephe');
  });

  test('PRESERVES LENGTH — buildSnippet slices the original by a folded index', () => {
    // This is the one rule the whole snippet mechanism rests on. Folding with
    // a bare normalize('NFD').replace(marks) would make "Médoc" 5 chars folded
    // and 5 original by luck, but "ﬁ"-style expansions and any multi-codepoint
    // decomposition would shift every later index.
    for (const s of ['Médoc', 'Château Pétrus', 'Rosé d’Anjou', 'Saint-Estèphe 2016']) {
      expect(foldText(s)).toHaveLength(s.length);
    }
  });

  test('leaves non-Latin characters alone', () => {
    expect(foldText('12 Years · 40%')).toBe('12 years · 40%');
  });
});

describe('queryTerms', () => {
  test('returns the whole query plus each word of 3+ letters, longest first', () => {
    expect(queryTerms('red wine')).toEqual(['red wine', 'wine', 'red']);
  });

  test('drops words shorter than three letters', () => {
    // Highlighting every "de" in a French appellation is noise, not signal.
    expect(queryTerms('vin de pays')).toEqual(['vin de pays', 'pays', 'vin']);
  });

  test('folds the terms, so they only ever match folded text', () => {
    expect(queryTerms('Médoc')).toEqual(['medoc']);
  });

  test('de-duplicates a single-word query against itself', () => {
    expect(queryTerms('whisky')).toEqual(['whisky']);
  });

  test('an empty or blank query has no terms', () => {
    expect(queryTerms('')).toEqual([]);
    expect(queryTerms('   ')).toEqual([]);
  });
});

describe('toPattern', () => {
  test('matches an accented original from an unaccented term', () => {
    const re = new RegExp(toPattern('medoc'), 'i');
    expect(re.test('Médoc')).toBe(true);
  });

  test('escapes regex metacharacters', () => {
    expect(() => new RegExp(toPattern('12% (cask)'))).not.toThrow();
    expect(new RegExp(toPattern('12% (cask)'), 'i').test('12% (Cask)')).toBe(true);
  });
});

describe('matchesTerms', () => {
  test('is accent-insensitive in both directions', () => {
    expect(matchesTerms('Médoc', queryTerms('medoc'))).toBe(true);
    expect(matchesTerms('Medoc', queryTerms('médoc'))).toBe(true);
  });

  test('is false for an absent, empty or unmatched value', () => {
    expect(matchesTerms(undefined, queryTerms('gin'))).toBe(false);
    expect(matchesTerms('', queryTerms('gin'))).toBe(false);
    expect(matchesTerms('Bordeaux', queryTerms('speyside'))).toBe(false);
  });
});

describe('splitHighlight', () => {
  // React Native has no <mark>. The web's <Highlight> component becomes a pure
  // segmenter; the screen maps segments onto nested <Text>.
  test('splits a string into matched and unmatched runs', () => {
    expect(splitHighlight('Thomas Barton Medoc', 'medoc')).toEqual([
      { text: 'Thomas Barton ', matched: false },
      { text: 'Medoc', matched: true },
    ]);
  });

  test('matches across an accent and quotes the ORIGINAL spelling', () => {
    expect(splitHighlight('Premium Médoc red', 'medoc')).toEqual([
      { text: 'Premium ', matched: false },
      { text: 'Médoc', matched: true },
      { text: ' red', matched: false },
    ]);
  });

  test('prefers the longest term, so "red wine" beats "wine"', () => {
    expect(splitHighlight('A red wine', 'red wine')).toEqual([
      { text: 'A ', matched: false },
      { text: 'red wine', matched: true },
    ]);
  });

  test('an empty query yields one unmatched segment', () => {
    expect(splitHighlight('Glenfiddich', '')).toEqual([{ text: 'Glenfiddich', matched: false }]);
  });

  test('never emits empty segments', () => {
    for (const seg of splitHighlight('Medoc', 'medoc')) expect(seg.text).not.toBe('');
  });

  test('reassembles to exactly the input', () => {
    const input = 'Château Pétrus Médoc 2016';
    const joined = splitHighlight(input, 'medoc petrus').map((s) => s.text).join('');
    expect(joined).toBe(input);
  });
});
