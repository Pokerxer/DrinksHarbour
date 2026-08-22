import { describe, expect, test } from 'vitest';

const { filterRoots, searchSubcategories, parentOf, SUB_RESULT_LIMIT } = await import(
  './category-drawer.ts'
);

/**
 * The drawer's three useMemos in
 * `apps/platform/src/components/Navigation/MobileBottomNav.tsx:120-138`,
 * lifted out so they can be tested without rendering.
 */

const roots = [
  { _id: 'c1', name: 'Wine', slug: 'wine', productCount: 12 },
  { _id: 'c2', name: 'Spirits', slug: 'spirits', productCount: 8 },
  { _id: 'c3', name: 'Beer', slug: 'beer', productCount: 0 },
];

const subs = [
  { _id: 's1', name: 'Red Wine', slug: 'red-wine', productCount: 5, parent: 'c1' },
  { _id: 's2', name: 'White Wine', slug: 'white-wine', productCount: 3, parent: { _id: 'c1' } },
  { _id: 's3', name: 'Empty Wine', slug: 'empty-wine', productCount: 0, parent: 'c1' },
  { _id: 's4', name: 'Whisky', slug: 'whisky', productCount: 7, parent: 'c2' },
  { _id: 's5', name: 'Orphan', slug: 'orphan', productCount: 2, parent: null },
];

describe('filterRoots', () => {
  test('an empty query returns every root untouched', () => {
    expect(filterRoots(roots, '')).toEqual(roots);
    expect(filterRoots(roots, '   ')).toEqual(roots);
  });

  test('matches on name, case-insensitively', () => {
    expect(filterRoots(roots, 'wi').map((c) => c._id)).toEqual(['c1']);
    expect(filterRoots(roots, 'SPIRITS').map((c) => c._id)).toEqual(['c2']);
  });

  test('a query matching nothing returns empty, not everything', () => {
    expect(filterRoots(roots, 'zzz')).toEqual([]);
  });

  test('tolerates a missing list', () => {
    expect(filterRoots(null, 'wine')).toEqual([]);
    expect(filterRoots(undefined, '')).toEqual([]);
  });
});

describe('searchSubcategories', () => {
  test('returns nothing until there is a query — the browse view owns that case', () => {
    expect(searchSubcategories(subs, '')).toEqual([]);
    expect(searchSubcategories(subs, '  ')).toEqual([]);
  });

  test('matches on name, case-insensitively', () => {
    expect(searchSubcategories(subs, 'wine').map((s) => s._id)).toEqual(['s1', 's2']);
  });

  test('hides subcategories with no products', () => {
    // s3 "Empty Wine" matches the query but has productCount 0.
    expect(searchSubcategories(subs, 'wine').map((s) => s._id)).not.toContain('s3');
  });

  test('caps the result list', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      _id: `x${i}`,
      name: `Gin ${i}`,
      slug: `gin-${i}`,
      productCount: 1,
      parent: 'c2',
    }));
    expect(searchSubcategories(many, 'gin')).toHaveLength(SUB_RESULT_LIMIT);
  });

  test('tolerates a missing list', () => {
    expect(searchSubcategories(null, 'wine')).toEqual([]);
  });
});

describe('parentOf', () => {
  test('resolves a parent given as a raw id string', () => {
    expect(parentOf(subs[0], roots)?._id).toBe('c1');
  });

  test('resolves a parent given as a populated object', () => {
    // The API populates `parent` sometimes and leaves it an id other times.
    expect(parentOf(subs[1], roots)?._id).toBe('c1');
  });

  test('returns null for an unparented subcategory rather than throwing', () => {
    expect(parentOf(subs[4], roots)).toBeNull();
  });

  test('returns null when the parent is not among the roots', () => {
    expect(parentOf({ _id: 'z', parent: 'nope' }, roots)).toBeNull();
  });
});
