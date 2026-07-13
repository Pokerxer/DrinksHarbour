// server/__tests__/searchFilter.helper.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  expandCategorySlugs,
  CATEGORY_TYPE_GROUPS,
} = require('../helpers/searchFilter.helper');

const matches = (patterns, type) => patterns.some(p => new RegExp(p, 'i').test(type));

test('expandCategorySlugs maps "wines" to a wine-family type pattern', () => {
  const { typePatterns, slugs } = expandCategorySlugs(['wines']);
  for (const t of ['red_wine', 'white_wine', 'rose_wine', 'sparkling_wine', 'champagne', 'fortified_wine']) {
    assert.ok(matches(typePatterns, t), `expected pattern to match type ${t}`);
  }
  assert.ok(!matches(typePatterns, 'scotch'));
  assert.deepStrictEqual(slugs, [], 'umbrella slug should not be queried literally');
});

test('expandCategorySlugs maps "spirits" to whisky + white-spirit types', () => {
  const { typePatterns } = expandCategorySlugs(['spirits']);
  for (const t of ['scotch', 'whiskey', 'bourbon', 'vodka', 'gin', 'rum', 'tequila', 'brandy', 'liqueur']) {
    assert.ok(matches(typePatterns, t), `expected pattern to match type ${t}`);
  }
  assert.ok(!matches(typePatterns, 'red_wine'));
  assert.ok(!matches(typePatterns, 'juice'));
});

test('whisky family pattern covers non-enum DB type variants', () => {
  // Production has categories typed outside the schema enum — the family
  // pattern must still catch them.
  const { typePatterns } = expandCategorySlugs(['whisky']);
  for (const t of ['japanese-whisky', 'world-whisky', 'irish-whiskey', 'rye_whiskey', 'scotch', 'bourbon']) {
    assert.ok(matches(typePatterns, t), `expected whisky pattern to match ${t}`);
  }
  assert.ok(!matches(typePatterns, 'red_wine'));
});

test('expandCategorySlugs maps footer slugs beers and non-alcoholic', () => {
  const beers = expandCategorySlugs(['beers']).typePatterns;
  assert.ok(matches(beers, 'beer') && matches(beers, 'cider'));
  const na = expandCategorySlugs(['non-alcoholic']).typePatterns;
  for (const t of ['soft_drink', 'juice', 'water', 'coffee', 'tea', 'yogurt_drink']) {
    assert.ok(matches(na, t), `expected non-alcoholic pattern to match ${t}`);
  }
  assert.ok(!matches(na, 'scotch'));
});

test('expandCategorySlugs maps whisky spelling variants onto the whisky family', () => {
  for (const alias of ['whisky', 'whiskies', 'whiskeys']) {
    const { typePatterns } = expandCategorySlugs([alias]);
    assert.ok(matches(typePatterns, 'scotch') && matches(typePatterns, 'whiskey'), alias);
  }
  assert.deepStrictEqual(expandCategorySlugs(['scotch-whisky']).typePatterns, ['scotch']);
});

test('expandCategorySlugs passes real slugs through as literal slug candidates', () => {
  const { typePatterns, slugs } = expandCategorySlugs(['scotch']);
  assert.deepStrictEqual(typePatterns, []);
  assert.deepStrictEqual(slugs, ['scotch']);
});

test('expandCategorySlugs de-pluralizes unknown slugs as a fallback', () => {
  const { slugs } = expandCategorySlugs(['vodkas']);
  assert.ok(slugs.includes('vodka'));
  assert.ok(slugs.includes('vodkas'));
});

test('expandCategorySlugs handles mixed case, whitespace and mixed inputs', () => {
  const { typePatterns, slugs } = expandCategorySlugs([' Wines ', 'SCOTCH']);
  assert.ok(matches(typePatterns, 'red_wine'));
  assert.ok(slugs.includes('scotch'));
});

test('expandCategorySlugs returns empty for empty/blank input', () => {
  assert.deepStrictEqual(expandCategorySlugs([]), { typePatterns: [], slugs: [] });
  assert.deepStrictEqual(expandCategorySlugs(['', '  ']), { typePatterns: [], slugs: [] });
  assert.deepStrictEqual(expandCategorySlugs(undefined), { typePatterns: [], slugs: [] });
});

test('every schema enum type lands in exactly the expected family', () => {
  const Category = require('../models/Category');
  const enumValues = Category.schema.path('type').enumValues;
  const wines = [CATEGORY_TYPE_GROUPS['wines']];
  const spirits = [CATEGORY_TYPE_GROUPS['spirits']];
  const beers = [CATEGORY_TYPE_GROUPS['beers']];
  const nonAlco = [CATEGORY_TYPE_GROUPS['non-alcoholic']];
  for (const t of enumValues) {
    const families = [
      matches(wines, t) && 'wines',
      matches(spirits, t) && 'spirits',
      matches(beers, t) && 'beers',
      matches(nonAlco, t) && 'non-alcoholic',
    ].filter(Boolean);
    // Accessory/other types belong to no family; drink types to exactly one.
    assert.ok(families.length <= 1, `type "${t}" matched multiple families: ${families}`);
  }
});
