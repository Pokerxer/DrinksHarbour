import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeVariantSubcategoryId } from './subcategorySitemap.ts';

test('collapses singular/plural variant pairs within a parent, keeping the higher count', () => {
  const entries = [
    { slug: 'fruit-liqueur', parentSlug: 'liqueurs', productCount: 3 },
    { slug: 'fruit-liqueurs', parentSlug: 'liqueurs', productCount: 9 },
    { slug: 'cream-liqueurs', parentSlug: 'liqueurs', productCount: 12 },
    { slug: 'cream-liqueur', parentSlug: 'liqueurs', productCount: 12 },
  ];
  const result = dedupeVariantSubcategoryId(entries);
  assert.deepEqual(
    result.map((e) => e.slug).sort(),
    ['cream-liqueurs', 'fruit-liqueurs'],
  );
});

test('keeps entries across different parents even with identical slugs', () => {
  const entries = [
    { slug: 'prosecco', parentSlug: 'sparkling-wine', productCount: 10 },
    { slug: 'prosecco', parentSlug: 'other-parent', productCount: 4 },
  ];
  assert.equal(dedupeVariantSubcategoryId(entries).length, 2);
});

test('zero-count ties keep the longer (plural) slug; unrelated subcats pass through untouched', () => {
  const tie = dedupeVariantSubcategoryId([
    { slug: 'aged-rum', parentSlug: 'rum', productCount: 0 },
    { slug: 'aged-rums', parentSlug: 'rum', productCount: 0 },
  ]);
  assert.deepEqual(tie.map((e) => e.slug), ['aged-rums']);
  const untouched = dedupeVariantSubcategoryId([
    { slug: 'single-malt-scotch', parentSlug: 'scotch', productCount: 40 },
  ]);
  assert.deepEqual(untouched, [{ slug: 'single-malt-scotch', parentSlug: 'scotch', productCount: 40 }]);
});
