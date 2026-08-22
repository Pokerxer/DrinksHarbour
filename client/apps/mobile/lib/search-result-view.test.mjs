import { describe, expect, test } from 'vitest';
import { toSearchResultView } from './search-result-view.ts';
import { queryTerms } from './search-highlight.ts';

/**
 * One search result row, derived. Transcribed from the row body of
 * `ModalSearch.tsx:624-777` — its own `getPrice`/`getProductImage`, the
 * in-stock rule, and the "is the hit already explained above?" test that
 * decides whether a snippet is shown at all.
 */

const BASE = {
  _id: 'p1',
  slug: 'thomas-barton-medoc',
  name: 'Thomas Barton Reserve Privee Medoc',
  primaryImage: { url: 'https://cdn/medoc.jpg' },
  priceRange: { min: 42000, max: 42000 },
  appellation: 'Médoc',
};

describe('identity and image', () => {
  test('carries id, slug and name through', () => {
    const view = toSearchResultView(BASE, []);

    expect(view.id).toBe('p1');
    expect(view.slug).toBe('thomas-barton-medoc');
    expect(view.name).toBe('Thomas Barton Reserve Privee Medoc');
  });

  test('prefers primaryImage, then images[0], then null', () => {
    expect(toSearchResultView(BASE, []).imageUrl).toBe('https://cdn/medoc.jpg');
    expect(toSearchResultView({ images: [{ url: 'https://cdn/b.jpg' }] }, []).imageUrl)
      .toBe('https://cdn/b.jpg');
    expect(toSearchResultView({ images: ['https://cdn/c.jpg'] }, []).imageUrl)
      .toBe('https://cdn/c.jpg');
    // null, not a placeholder path — RemoteImage renders its own grey plate.
    expect(toSearchResultView({ name: 'x' }, []).imageUrl).toBeNull();
  });
});

describe('price', () => {
  test('reads priceRange.min', () => {
    expect(toSearchResultView(BASE, []).price).toBe(42000);
  });

  test('shows an original price only when the range actually spans', () => {
    expect(toSearchResultView(BASE, []).originalPrice).toBeNull();
    expect(toSearchResultView({ priceRange: { min: 100, max: 180 } }, []).originalPrice).toBe(180);
  });

  test('a product with no priceRange is zero, not NaN', () => {
    expect(toSearchResultView({ name: 'x' }, []).price).toBe(0);
  });
});

describe('stock', () => {
  test('anything but out_of_stock counts as in stock', () => {
    expect(toSearchResultView({ availability: { status: 'in_stock' } }, []).inStock).toBe(true);
    // Absent availability is in stock — the web assumes the same.
    expect(toSearchResultView({ name: 'x' }, []).inStock).toBe(true);
    expect(toSearchResultView({ availability: { status: 'out_of_stock' } }, []).inStock).toBe(false);
  });

  test('surfaces a low-stock count only in the web\'s 1..10 window', () => {
    const low = toSearchResultView({ availability: { status: 'in_stock', totalStock: 4 } }, []);
    const plenty = toSearchResultView({ availability: { status: 'in_stock', totalStock: 90 } }, []);

    expect(low.lowStock).toBe(4);
    expect(plenty.lowStock).toBeNull();
  });

  test('an out-of-stock product never advertises how few are left', () => {
    const view = toSearchResultView({ availability: { status: 'out_of_stock', totalStock: 3 } }, []);

    expect(view.lowStock).toBeNull();
  });
});

describe('provenance and the snippet', () => {
  test('orders facets with the matched one first', () => {
    const view = toSearchResultView(
      { ...BASE, region: 'Bordeaux', originCountry: 'France' },
      queryTerms('medoc')
    );

    expect(view.facets[0].key).toBe('appellation');
    expect(view.matchedFacetKeys.has('appellation')).toBe(true);
  });

  test('suppresses the snippet when a facet already explains the hit', () => {
    // ModalSearch.tsx:637-642 — showing both is noise.
    const view = toSearchResultView(
      { ...BASE, description: 'A Médoc of real depth.' },
      queryTerms('medoc')
    );

    expect(view.snippet).toBeNull();
  });

  test('suppresses the snippet when the NAME already explains the hit', () => {
    const view = toSearchResultView(
      { name: 'Smoky Islay Malt', description: 'Deeply smoky.' },
      queryTerms('smoky')
    );

    expect(view.snippet).toBeNull();
  });

  test('suppresses the snippet when the brand or category explains the hit', () => {
    expect(
      toSearchResultView(
        { name: 'A bottle', brand: { name: 'Ardbeg' }, description: 'From Ardbeg.' },
        queryTerms('ardbeg')
      ).snippet
    ).toBeNull();

    expect(
      toSearchResultView(
        { name: 'A bottle', category: { name: 'Rum' }, description: 'A rum.' },
        queryTerms('rum')
      ).snippet
    ).toBeNull();
  });

  test('shows the snippet when ONLY the prose matched', () => {
    const view = toSearchResultView(
      { name: 'Lagavulin 16', description: 'Intensely smoky and maritime.' },
      queryTerms('smoky')
    );

    expect(view.snippet).toEqual({ label: 'Description', text: 'Intensely smoky and maritime.' });
  });
});

describe('subtitle', () => {
  test('joins category and brand the way the web does', () => {
    const view = toSearchResultView({ category: { name: 'Wine' }, brand: { name: 'Barton' } }, []);

    expect(view.categoryName).toBe('Wine');
    expect(view.brandName).toBe('Barton');
  });

  test('is null when neither is present, so the row drops the line', () => {
    const view = toSearchResultView({ name: 'x' }, []);

    expect(view.categoryName).toBeNull();
    expect(view.brandName).toBeNull();
  });
});
