import { describe, expect, test } from 'vitest';
import { queryTerms } from './search-highlight.ts';
import { buildSnippet, flattenNotes, getFacets, orderFacets, prettify } from './search-facets.ts';

/**
 * Transcribed from `apps/platform/src/components/Modal/ModalSearch.tsx:225-313`.
 * This is the layer that answers "why is this bottle on screen?".
 *
 * MEDOC is the shape the live API actually returned on 2026-08-19 for
 * `GET /api/products/search?q=medoc` — not an invented fixture.
 */
const MEDOC = {
  _id: '6a5a2438366d76265f2f4b99',
  name: 'Thomas Barton Reserve Privee Medoc',
  slug: 'thomas-barton-reserve-privee-medoc',
  shortDescription:
    "Premium Médoc red wine from Thomas Barton's Reserve Privée collection, presented in an elegant gift box.",
  originCountry: 'France',
  region: 'Bordeaux',
  appellation: 'Médoc',
  producer: 'Thomas Barton',
  caskType: 'oak',
  style: 'dry',
};

describe('prettify', () => {
  test('un-snake-cases the enum values the backend stores', () => {
    expect(prettify('sherry_cask')).toBe('Sherry Cask');
    expect(prettify('full_bodied')).toBe('Full Bodied');
    expect(prettify('oak')).toBe('Oak');
  });
});

describe('getFacets', () => {
  test('reads the provenance fields in the web order', () => {
    expect(getFacets(MEDOC)).toEqual([
      { key: 'country', label: 'Country', value: 'France' },
      { key: 'region', label: 'Region', value: 'Bordeaux' },
      { key: 'appellation', label: 'Appellation', value: 'Médoc' },
      { key: 'producer', label: 'Producer', value: 'Thomas Barton' },
      { key: 'cask', label: 'Cask', value: 'Oak' },
      { key: 'style', label: 'Style', value: 'Dry' },
    ]);
  });

  test('falls back through the four maker fields', () => {
    expect(getFacets({ wineryName: 'Ch. Margaux' })).toContainEqual({
      key: 'producer',
      label: 'Producer',
      value: 'Ch. Margaux',
    });
    expect(getFacets({ distilleryName: 'Ardbeg' })).toContainEqual({
      key: 'producer',
      label: 'Producer',
      value: 'Ardbeg',
    });
    expect(getFacets({ breweryName: 'Guinness' })).toContainEqual({
      key: 'producer',
      label: 'Producer',
      value: 'Guinness',
    });
  });

  test('a numeric vintage survives as a string', () => {
    expect(getFacets({ vintage: 2016 })).toEqual([
      { key: 'vintage', label: 'Vintage', value: '2016' },
    ]);
  });

  test('drops absent, null and whitespace-only values', () => {
    expect(getFacets({ region: '  ', appellation: null, producer: undefined })).toEqual([]);
  });

  test('a product with no provenance has no facets', () => {
    expect(getFacets({ name: 'Coke' })).toEqual([]);
  });
});

describe('orderFacets', () => {
  test('matched facets come first — they are the reason the row is on screen', () => {
    const { shown, matchedKeys } = orderFacets(getFacets(MEDOC), queryTerms('medoc'));

    expect(shown[0]).toEqual({ key: 'appellation', label: 'Appellation', value: 'Médoc' });
    expect(matchedKeys.has('appellation')).toBe(true);
  });

  test('caps the row at four', () => {
    expect(orderFacets(getFacets(MEDOC), queryTerms('medoc')).shown).toHaveLength(4);
  });

  test('with nothing matched the original order is kept', () => {
    const { shown, matchedKeys } = orderFacets(getFacets(MEDOC), queryTerms('speyside'));

    expect(matchedKeys.size).toBe(0);
    expect(shown.map((f) => f.key)).toEqual(['country', 'region', 'appellation', 'producer']);
  });
});

describe('flattenNotes', () => {
  test('joins every tasting-note field, arrays included', () => {
    expect(
      flattenNotes({
        tastingNotes: {
          nose: ['smoke', 'peat'],
          palate: 'oily',
          finish: 'long',
          colour: 'ignored',
          color: 'amber',
        },
      })
    ).toBe('smoke, peat, oily, long, amber');
  });

  test('a product with no tasting notes flattens to an empty string', () => {
    expect(flattenNotes({ name: 'Coke' })).toBe('');
  });
});

describe('buildSnippet', () => {
  test('quotes the passage that matched, with its source label', () => {
    const snippet = buildSnippet(MEDOC, queryTerms('gift box'));

    expect(snippet.label).toBe('Description');
    expect(snippet.text).toContain('gift box');
  });

  test('finds an ACCENTED passage from an unaccented term and quotes the original', () => {
    // The whole point of length-preserving folding: the index found in the
    // folded copy has to be valid in the original, or the quote is off by one
    // per accent and reads as garbage.
    const snippet = buildSnippet(MEDOC, queryTerms('privee'));

    expect(snippet.text).toContain('Privée');
  });

  test('falls through to tasting notes when the description does not match', () => {
    const snippet = buildSnippet(
      { description: 'A bottle.', tastingNotes: { nose: ['smoky', 'peat'] } },
      queryTerms('smoky')
    );

    expect(snippet).toEqual({ label: 'Tasting notes', text: 'smoky, peat' });
  });

  test('falls through to the flavour profile last, prettified', () => {
    expect(buildSnippet({ flavorProfile: ['stone_fruit'] }, queryTerms('stone'))).toEqual({
      label: 'Flavour',
      text: 'Stone Fruit',
    });
  });

  test('is null when nothing in the prose matched', () => {
    expect(buildSnippet(MEDOC, queryTerms('speyside'))).toBeNull();
  });

  test('is null for a product with no prose at all', () => {
    expect(buildSnippet({ name: 'Coke' }, queryTerms('coke'))).toBeNull();
  });

  test('ellipses a window out of the middle of a long passage', () => {
    const long = `${'a '.repeat(120)}smoky${' b'.repeat(120)}`;
    const snippet = buildSnippet({ description: long }, queryTerms('smoky'));

    expect(snippet.text.startsWith('…')).toBe(true);
    expect(snippet.text.endsWith('…')).toBe(true);
    expect(snippet.text).toContain('smoky');
    expect(snippet.text.length).toBeLessThanOrEqual(122);
  });

  test('does not lead with an ellipsis when the hit is at the start', () => {
    const snippet = buildSnippet({ description: 'Smoky and long on the finish.' }, queryTerms('smoky'));

    expect(snippet.text.startsWith('…')).toBe(false);
  });
});
