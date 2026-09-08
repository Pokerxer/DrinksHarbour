const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBrandSearch } = require('../utils/brandSearch');
function matches(brand, search) {
  const query = buildBrandSearch(search);
  return !query.$or || query.$or.some(clause => {
    const [field, condition] = Object.entries(clause)[0];
    return new RegExp(condition.$regex, condition.$options).test(brand[field] || '');
  });
}
test('brand names match partial, mixed-case and padded search terms', () => {
  assert.equal(matches({ name: 'Glenfiddich' }, ' glEn '), true);
  assert.equal(matches({ name: 'Laphroaig' }, 'LAPH'), true);
  assert.equal(matches({ name: 'Laphroaig' }, 'glen'), false);
});
test('literal punctuation never becomes regex syntax', () => {
  assert.equal(matches({ name: 'Glenfiddich' }, '.*'), false);
  assert.equal(matches({ name: 'House (Reserve)' }, '('), true);
});
test('search includes slugs and trading names', () => {
  assert.equal(matches({ slug: 'glenfiddich' }, 'fiddich'), true);
  assert.equal(matches({ tradingAs: ['Laphroaig Distillery'] }, 'laph'), true);
});
test('blank or non-string input adds no search constraint', () => {
  assert.deepEqual(buildBrandSearch('  '), {});
  assert.deepEqual(buildBrandSearch(undefined), {});
});
