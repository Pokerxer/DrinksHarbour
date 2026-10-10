const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyProduct, validateExisting, entries } = require('../data/chateau-vartely-subcategories');

test('accented and plain names resolve to the same reviewed grape classification', () => {
  assert.deepEqual(classifyProduct('Château Vartely Totem Rară Neagră 2019'),
    { parent: 'red-wine', slug: 'rara-neagra' });
  assert.deepEqual(classifyProduct('Chateau Vartely Individo Rara Neagra'),
    { parent: 'red-wine', slug: 'rara-neagra' });
});
test('blends, fortified wine and Divin do not use misleading grape or Cognac labels', () => {
  assert.deepEqual(classifyProduct('Château Vartely Individo Merlot Cabernet Sauvignon'),
    { parent: 'red-wine', slug: 'red-blend' });
  assert.deepEqual(classifyProduct('Chateau Vartely Pastoral'),
    { parent: 'fortified-wine', slug: 'pastoral' });
  assert.deepEqual(classifyProduct('Chateau Vartely Divin Tribute XO'),
    { parent: 'brandy', slug: 'divin' });
});
test('unknown product names fail closed rather than guessing', () => {
  assert.throws(() => classifyProduct('Chateau Vartely Unknown'), /Unreviewed/);
});
test('slug collisions and duplicate matches fail before mutation', () => {
  assert.throws(() => validateExisting([{ parent: 'wrong' }], 'right'), /parent/);
  assert.throws(() => validateExisting([{ parent: 'right' }, { parent: 'right' }], 'right'), /Duplicate/);
  assert.doesNotThrow(() => validateExisting([{ parent: 'right' }], 'right'));
});
test('manifest slugs are globally unique and parent categories are supported', () => {
  assert.equal(new Set(entries.map(e => e.slug)).size, entries.length);
  for (const e of entries) assert.match(e.parent, /^(red-wine|white-wine|rose-wine|sparkling-wine|fortified-wine|brandy)$/);
});
