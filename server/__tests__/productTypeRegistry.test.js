// server/__tests__/productTypeRegistry.test.js
//
// Industry-expansion registry integrity (2026-11-02 verticals: Electronics /
// Fashion / Beauty / Home). Pins the invariants that keep the additive model
// safe: no duplicate type values, every type fully described, the prefix→
// 'retail' supply-category rule, the catalogKind prefix rule, the Product
// model enum mirroring the registry, and the marketplace taxonomy registry's
// slugs/parents being unique so the seed script's preview/apply stay congruent.

const test = require('node:test');
const assert = require('node:assert/strict');
const { PRODUCT_TYPES, TYPE_CATEGORIES, getSizesForType, isBeverageType } = require('../constants/productTypes');
const { catalogKindForType, KINDS } = require('../constants/catalogKind');
const marketCategories = require('../config/marketCategories');
const taxonomy = require('../constants/marketplaceTaxonomy');

const VERTICAL_PREFIXES = ['electronics_', 'fashion_', 'beauty_', 'home_'];
const VERTICAL_PREFIX_GROUPS = {
  electronics_: 'ELECTRONICS',
  fashion_: 'FASHION',
  beauty_: 'BEAUTY',
  home_: 'HOME',
};
const verticalTypes = Object.values(PRODUCT_TYPES).filter(
  (v) => VERTICAL_PREFIXES.some((p) => v.startsWith(p))
);

test('the vertical vocabulary landed: 43 types across the four prefixed families', () => {
  const families = VERTICAL_PREFIXES.map((p) => verticalTypes.filter((v) => v.startsWith(p)).length);
  assert.deepStrictEqual(families, [14, 11, 7, 11], JSON.stringify(families));
  assert.equal(verticalTypes.length, 43);
});

test('every vertical type is fully described and never a beverage type', () => {
  for (const value of verticalTypes) {
    const expandedGroup = TYPE_CATEGORIES[VERTICAL_PREFIX_GROUPS[VERTICAL_PREFIXES.find((p) => value.startsWith(p))]];
    assert.ok(expandedGroup, `${value} must belong to its declared group`);
    assert.ok(expandedGroup.types.includes(value), `${value} must appear inside ${expandedGroup.name}`);
    assert.equal(isBeverageType(value), false, `${value} must classify as non-beverage`);
    assert.ok(Array.isArray(getSizesForType(value)) && getSizesForType(value).length > 0, `${value} needs size guidance`);
  }
});

test('supply-category prefix rule maps vertical types to "retail" only', () => {
  for (const value of verticalTypes) {
    assert.equal(marketCategories.categoryForType(value), 'retail', value);
  }
  // Legacies unchanged: beverage fallback + gift/food stays untouched.
  assert.equal(marketCategories.categoryForType('wine'), 'beverage');
  assert.equal(marketCategories.categoryForType('gift_set'), 'gift');
  assert.equal(marketCategories.categoryForType('prepared_food'), 'food');
  assert.equal(marketCategories.categoryForType('womens_dress'), 'beverage'); // not a registered vertical type
});

test('catalogKind prefix rule maps vertical types to KINDS.retail only', () => {
  for (const value of verticalTypes) {
    assert.equal(catalogKindForType(value), KINDS.retail, value);
  }
  assert.equal(catalogKindForType('wine'), KINDS.beverage);
  assert.equal(catalogKindForType('some_unregistered_type'), KINDS.beverage);
  assert.ok(KINDS.retail && KINDS.beverage, 'both kinds exist');
});

test('the Product model enum mirrors the registry (additive spread stays connected)', () => {
  const Product = require('../models/Product');
  const enumVals = new Set(Product.schema.path('type').enumValues);
  for (const value of verticalTypes) {
    assert.ok(enumVals.has(value), `${value} must be accepted by the Product schema`);
  }
});

test('marketplace taxonomy registry is consistent for an idempotent seed', () => {
  // PER-BUSINESS tree (2026-11-03): each vertical owns categories with their
  // own subcategories; electronics is seeded FIRST (user direction).
  assert.deepStrictEqual(
    taxonomy.CATEGORY_HORIZONTALS.map((v) => v.slug),
    // 'home-living' ADOPTS the pre-existing legacy platform category (same
    // "Home & Living" concept, already unique-indexed) — 2026-11-03.
    ['electronics', 'fashion', 'beauty', 'home-living', 'food-service'],
  );
  assert.equal(taxonomy.categories.length, 52);
  assert.equal(taxonomy.subcategories.length, 213);
  const perVerticalCats = taxonomy.categories.reduce((m, c) => {
    m[c.verticalSlug] = (m[c.verticalSlug] || 0) + 1;
    return m;
  }, {});
  assert.deepStrictEqual(perVerticalCats, {
    electronics: 9, fashion: 8, beauty: 7, 'home-living': 11, 'food-service': 17,
  });
  const catSlugs = taxonomy.categories.map((c) => c.slug);
  assert.equal(new Set(catSlugs).size === catSlugs.length, true, 'category slugs globally unique');
  const pairs = taxonomy.subcategories.map((s) => `${s.parentSlug}|${s.slug}`);
  assert.equal(new Set(pairs).size, pairs.length, 'no duplicate (parent, slug) pairs');
  const parentSlugs = new Set(catSlugs);
  const flatSlugs = taxonomy.subcategories.map((s) => s.slug);
  assert.equal(new Set(flatSlugs).size === flatSlugs.length, true, 'subcategory slugs globally unique (slug_1 index contract)');
  for (const sub of taxonomy.subcategories) {
    assert.ok(parentSlugs.has(sub.parentSlug), `${sub.slug} references a registered parent`);
    assert.ok(sub.name.trim().length >= 2);
    // Slug scheme: bare slugify(name) — or category-prefixed when that name
    // repeats across categories (global-unique index rule, 2026-11-03).
    assert.ok(
      sub.slug === taxonomy.slugify(sub.name) ||
      sub.slug === taxonomy.slugify(`${sub.parentName} ${sub.name}`),
      `${sub.slug} must be the bare or category-prefixed slug of "${sub.name}"`,
    );
  }
  // Adopted legacy family: the Home vertical keeps kitchen-and-dining's
  // existing identity (2026-11-03 adoption).
  const homeVertical = taxonomy.CATEGORY_HORIZONTALS.find((v) => v.slug === 'home-living');
  assert.equal(homeVertical.categories[0].name, 'Kitchen & Dining');
});

// ── Industry declarations (2026-11-02 additive; see industryScope.test.js) ──

test('every taxonomy subcategory declares a valid industry consistent with its vertical', () => {
  const { INDUSTRY_VALUES } = require('../constants/industries');
  for (const sub of taxonomy.subcategories) {
    assert.ok(INDUSTRY_VALUES.includes(sub.industry), `${sub.slug} industry must be an INDUSTRY value`);
  }
  for (const vertical of taxonomy.CATEGORY_HORIZONTALS) {
    assert.ok(INDUSTRY_VALUES.includes(vertical.industry), `${vertical.slug} vertical industry must be valid`);
  }
});

test('Food Service & Venue vertical carries the venue consumables (per-business tree)', () => {
  const foodService = taxonomy.CATEGORY_HORIZONTALS.find((v) => v.slug === 'food-service');
  assert.equal(foodService.industry, 'food-service');
  const shisha = foodService.categories.find((c) => c.name === 'Shisha & Hookah');
  assert.ok(shisha, 'Shisha & Hookah category exists in the food-service tree');
  assert.ok(shisha.subcategories.includes('Shisha Flavours (Molasses)'));
  for (const slug of ['shisha-and-hookah', 'cigars-and-tobacco', 'venue-merchandise']) {
    assert.equal(taxonomy.categories.find((c) => c.slug === slug).industry, 'hospitality');
    const leaves = taxonomy.subcategories.filter((s) => s.parentSlug === slug);
    assert.ok(leaves.length > 0);
    assert.ok(leaves.every((s) => s.industry === 'hospitality' && s.verticalSlug === 'food-service'));
  }
  const cigarLeaves = taxonomy.subcategories.filter((s) => s.parentSlug === 'cigars-and-tobacco');
  assert.ok(cigarLeaves.some((s) => s.slug === 'cigar-packs-and-singles'));
  assert.ok(cigarLeaves.every((s) => s.slug !== 'cigars'));
});

test('Home lighting, garden, and bath have catalog leaves and Home sets are type-specific', () => {
  for (const [type, category, leaf] of [
    ['home_lighting', 'lighting', 'table-and-floor-lamps'],
    ['home_garden', 'garden-and-outdoor', 'planters-and-pots'],
    ['home_bath', 'bath-and-bathroom-accessories', 'bath-mats'],
  ]) {
    assert.ok(verticalTypes.includes(type));
    assert.ok(taxonomy.subcategories.some((s) => s.parentSlug === category && s.slug === leaf));
  }
  const setSizes = ['unit-single', 'set-2', 'set-4', 'set-6', 'set-8', 'set-12'];
  const acceptedSizes = require('../models/Size').schema.path('size').enumValues;
  for (const size of setSizes) assert.ok(acceptedSizes.includes(size), size);
  for (const type of ['home_kitchen', 'home_cookware', 'home_bedding', 'home_storage', 'home_bath']) {
    assert.ok(setSizes.every(size => getSizesForType(type).includes(size)), type);
  }
  for (const type of ['home_lighting', 'home_garden', 'home_small_appliance']) {
    assert.ok(getSizesForType(type).includes('unit-single'), type);
  }
});

test('Beauty nails and tools have dedicated leaves and usable pack sizes', () => {
  const { STANDARD_SIZES } = require('../constants/productTypes');
  const sizeEnum = require('../models/Size').schema.path('size').enumValues;
  const packs = ['unit-single', 'set-2', 'set-4', 'set-6'];
  assert.ok([...STANDARD_SIZES.BEAUTY, ...packs, '5g', 'pack-24'].every(size => getSizesForType('beauty_nails').includes(size)));
  assert.ok(packs.every(size => getSizesForType('beauty_tool').includes(size)));
  assert.ok(getSizesForType('beauty_tool').every(size => /^(unit|set|pack)-/.test(size)));
  assert.ok(getSizesForType('beauty_nails').every((size) => sizeEnum.includes(size)));
  for (const [parentSlug, slug] of [
    ['nails-and-manicure', 'press-on-nails'],
    ['beauty-tools-and-accessories', 'makeup-brushes-and-sponges'],
    ['makeup', 'brow-makeup'],
  ]) {
    assert.ok(taxonomy.subcategories.some((row) => row.parentSlug === parentSlug && row.slug === slug));
  }
});

test('all guided sizes and suggested pack codes can be saved by the Size model', () => {
  const { PRODUCT_TYPE_VALUES } = require('../constants/productTypes');
  const Size = require('../models/Size');
  const sizes = new Set(Size.schema.path('size').enumValues);
  const packaging = new Set(Size.schema.path('packaging.type').enumValues);
  for (const type of PRODUCT_TYPE_VALUES) {
    for (const code of getSizesForType(type)) {
      assert.ok(sizes.has(code), `${type}: ${code}`);
      if (/^(pack|case)-/.test(code)) assert.ok(packaging.has(code), `packaging: ${code}`);
    }
  }
});
