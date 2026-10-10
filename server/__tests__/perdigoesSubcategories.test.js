const { test } = require('node:test');
const assert = require('node:assert/strict');
const { entries, classifyProduct, excludedNames, reviewedNames } = require('../data/perdigoes-subcategories');

test('red blends are not classified as Baga, Syrah or Tinta Roriz', () => {
  for (const name of ['Poliphonia Reserve Vinho Tinto', 'Sunblessed Vinho Tinto',
    'Monte do Barão Vinho Tinto', 'Tapada do Barao Colheita Selectionada Vinho Tinto']) {
    assert.deepEqual(classifyProduct(name), { parent: 'red-wine', slug: 'red-blend' });
  }
});
test('white blends are not classified as their component grape', () => {
  assert.deepEqual(classifyProduct('Monte dos Perdigões Viognier & Gouveio Vinho Branco'),
    { parent: 'white-wine', slug: 'white-blend' });
  assert.deepEqual(classifyProduct('Sunblessed Vinho Branco'),
    { parent: 'white-wine', slug: 'white-blend' });
});
test('single-variety Alicante Bouschet keeps its own classification', () => {
  assert.deepEqual(classifyProduct('Monte Perdigoes Alicante Bouschet Vinho Tinto'),
    { parent: 'red-wine', slug: 'alicante-bouschet' });
});
test('accent normalization supports names without silently accepting unknown products', () => {
  assert.deepEqual(classifyProduct('Monte do Barao Vinho Tinto'), classifyProduct('Monte do Barão Vinho Tinto'));
  assert.throws(() => classifyProduct('Monte dos Perdigoes Unknown'), /Unreviewed/);
  assert.throws(() => classifyProduct('Digo Samanja'), /Unreviewed/);
  assert.deepEqual(excludedNames, ['Digo Samanja']);
});
test('all twenty reviewed wines map to supported unique taxonomy entries', () => {
  assert.equal(reviewedNames.length, 20);
  assert.equal(new Set(entries.map(e => e.slug)).size, entries.length);
  for (const name of reviewedNames) {
    const result = classifyProduct(name);
    assert.ok(entries.some(e => e.slug === result.slug && e.parent === result.parent));
  }
});
