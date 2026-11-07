// server/__tests__/hospitalityCatalog.test.js
//
// Food Service & Venue vocabulary round (2026-11-02, additive): the missing
// CATALOG words for restaurants / lounges / clubs. The architect's canon:
//   - Restaurants/lounges/clubs are ALREADY accommodated as businesses
//     (Tenant.businessType; venue serving v2; restaurant-mode POS; the
//     prepared_beverage/prepared_food/ingredient/consumable KINDS and the
//     venue menu machinery). This round adds vocabulary ONLY.
//   - prepared_food REMAINS A KIND (not a Product.type) — restaurant menu
//     items keep using the venue-serving machinery; no service-lifecycle
//     fakery (tickets/entries stay deferred per the audit).
//   - All additive: legacy behavior unchanged, no venue schema changes.
//
// 24 types: 14 foodservice_* procurement types and 10 hospitality_* retail
// types share the 'hospitality' supply
// category, and the AGE_RESTRICTED_TYPES age gate for vape + tobacco.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  PRODUCT_TYPES, TYPE_CATEGORIES, getSizesForType,
  isBeverageType, isAlcoholicType, AGE_RESTRICTED_TYPES,
} = require('../constants/productTypes');
const { catalogKindForType, KINDS, isVenueServiceProduct } = require('../constants/catalogKind');
const { foodserviceTypes, hospitalityTypes } = require('../constants/generalProductTypes');
const marketCategories = require('../config/marketCategories');
const Size = require('../models/Size');
const Product = require('../models/Product');

const FOODSERVICE_VALUES = foodserviceTypes.map((t) => t.value);
const HOSPITALITY_VALUES = hospitalityTypes.map((t) => t.value);
const CATERING_VALUES = [...FOODSERVICE_VALUES, ...HOSPITALITY_VALUES];

test('venue retail accessories and merchandise use existing size systems', () => {
  const guidance = {
    hospitality_shisha_accessory: ['unit-single', 'pack-12'],
    hospitality_cigar_accessory: ['unit-single'],
    hospitality_cigar_storage: ['unit-single'],
    hospitality_venue_apparel: ['unit-single', 'm', 'xl'],
    hospitality_venue_drinkware: ['unit-single', 'set-4', 'set-12'],
    hospitality_venue_gift_pack: ['unit-single', 'set-2', 'set-6'],
  };
  for (const [type, sizes] of Object.entries(guidance)) {
    assert.ok(HOSPITALITY_VALUES.includes(type), type);
    assert.equal(catalogKindForType(type), KINDS.retail, type);
    assert.ok(sizes.every((size) => getSizesForType(type).includes(size)), type);
    assert.ok(!AGE_RESTRICTED_TYPES.includes(type), type);
    assert.equal(isVenueServiceProduct({ type, catalogKind: KINDS.retail }), false, type);
    assert.equal(isVenueServiceProduct({ type, catalogKind: KINDS.prepared_food }), false, type);
  }
});

// ── Registry integrity across two groups ──────────────────────────────────

test('the catering vocabulary includes 14 foodservice and 10 hospitality types', () => {
  assert.deepStrictEqual(HOSPITALITY_VALUES, [
    'hospitality_shisha_kit', 'hospitality_shisha_flavour',
    'hospitality_charcoal', 'hospitality_cigar',
    'hospitality_shisha_accessory', 'hospitality_cigar_accessory', 'hospitality_cigar_storage',
    'hospitality_venue_apparel', 'hospitality_venue_drinkware', 'hospitality_venue_gift_pack',
  ]);
  assert.equal(FOODSERVICE_VALUES.length, 14);
  assert.equal(CATERING_VALUES.length, 24);
  // No duplicates anywhere in the additive stream.
  const all = new Set(CATERING_VALUES);
  assert.equal(all.size, 24);
  // Every new type is fully described and never beverage/alcoholic.
  for (const value of CATERING_VALUES) {
    assert.equal(isBeverageType(value), false, `${value} must never be a beverage type`);
    assert.equal(isAlcoholicType(value), false, `${value} must classify as non-alcoholic`);
    assert.ok(PRODUCT_TYPES[value.toUpperCase()], `${value} must be reachable via PRODUCT_TYPES`);
  }
});

test('TYPE_CATEGORIES gained FOODSERVICE and HOSPITALITY, alongside the retail groups', () => {
  assert.deepStrictEqual(new Set(TYPE_CATEGORIES.FOODSERVICE.types), new Set(FOODSERVICE_VALUES));
  assert.deepStrictEqual(new Set(TYPE_CATEGORIES.HOSPITALITY.types), new Set(HOSPITALITY_VALUES));
  // Additive spread: retail group sizes reflect the current registry.
  assert.equal(TYPE_CATEGORIES.ELECTRONICS.types.length, 14);
  assert.equal(TYPE_CATEGORIES.FASHION.types.length, 11);
  assert.equal(TYPE_CATEGORIES.BEAUTY.types.length, 7);
  assert.equal(TYPE_CATEGORIES.HOME.types.length, 11);
});

// ── Supply-category matrix ─────────────────────────────────────────────────

test('supply category: foodservice_* AND hospitality_* both resolve to "hospitality"', () => {
  for (const value of CATERING_VALUES) {
    assert.equal(marketCategories.categoryForType(value), 'hospitality', value);
  }
  assert.ok(marketCategories.categories.includes('hospitality'));
  for (const type of marketCategories.typesByCategory.hospitality) {
    assert.ok(CATERING_VALUES.includes(type), `${type} must be an enumerated catering type`);
  }
});

test('supply category: retail verticals and legacy behavior unchanged', () => {
  // Retail verticals still 'retail' (hospitality_ is NOT covered by the retail
  // prefix rule).
  assert.equal(marketCategories.categoryForType('electronics_phone'), 'retail');
  assert.equal(marketCategories.categoryForType('fashion_shoes'), 'retail');
  assert.equal(marketCategories.categoryForType('beauty_fragrance'), 'retail');
  assert.equal(marketCategories.categoryForType('home_cookware'), 'retail');
  // Legacy pins intact (fail-closed fallback semantics untouched).
  assert.equal(marketCategories.categoryForType('wine'), 'beverage');
  assert.equal(marketCategories.categoryForType('gift_set'), 'gift');
  assert.equal(marketCategories.categoryForType('prepared_food'), 'food');
  assert.equal(marketCategories.categoryForType('some_unregistered_type'), 'beverage');
  assert.equal(marketCategories.FALLBACK_CATEGORY, 'beverage');
});

// ── Catalog-kind matrix ────────────────────────────────────────────────────

test('catalogKind: foodservice_* → KINDS.ingredient, hospitality_* → KINDS.retail', () => {
  for (const value of FOODSERVICE_VALUES) {
    assert.equal(catalogKindForType(value), KINDS.ingredient, value);
  }
  for (const value of HOSPITALITY_VALUES) {
    assert.equal(catalogKindForType(value), KINDS.retail, value);
  }
  // Unknown / legacy types keep beverage.
  assert.equal(catalogKindForType('wine'), KINDS.beverage);
  assert.equal(catalogKindForType('some_unregistered_type'), KINDS.beverage);
  assert.equal(catalogKindForType(undefined), KINDS.beverage);
});

test('procurement and retail product types cannot pass as prepared menu items', async () => {
  for (const type of CATERING_VALUES) {
    assert.equal(isVenueServiceProduct({ type, catalogKind: KINDS.prepared_food }), false, type);
    assert.equal(isVenueServiceProduct({ type, catalogKind: KINDS.prepared_beverage }), false, type);
    const product = new Product({ name: 'Supply fixture', slug: 'supply-fixture', type, catalogKind: KINDS.prepared_food });
    await product.validate();
    assert.equal(product.catalogKind, catalogKindForType(type), type);
  }
  const dish = new Product({ name: 'Jollof', slug: 'jollof', type: 'other', catalogKind: KINDS.prepared_food });
  await dish.validate();
  assert.equal(dish.catalogKind, KINDS.prepared_food);
  assert.equal(isVenueServiceProduct(dish), true);
});

test('shisha/cigar are age-restricted deliverables, never beverage; venue service stays fenced', () => {
  for (const value of HOSPITALITY_VALUES) {
    assert.equal(isBeverageType(value), false, `${value} must never be beverage`);
    // Retail kinds are never venue-serviceable, and ingredient/consumable
    // kinds stay excluded (canon: retail is marketplace/shop surfaces only).
    assert.equal(
      isVenueServiceProduct({ type: value, catalogKind: catalogKindForType(value) }),
      false,
      `${value} must not be venue-serviceable`,
    );
  }
});

// ── Product enum mirrors the registry ────────────────────────────────────

test('Product type enum accepts all catering types and keeps legacy values', () => {
  const enumValues = new Set(Product.schema.path('type').enumValues);
  for (const value of CATERING_VALUES) {
    assert.ok(enumValues.has(value), `${value} must be accepted by the Product schema`);
  }
  // Additive spread did not drop legacy values.
  for (const legacy of ['beer', 'wine', 'electronics_phone', 'vape']) {
    assert.ok(enumValues.has(legacy), `${legacy} must remain accepted`);
  }
});

// ── AGE_RESTRICTED_TYPES (age gate) ────────────────────────────────────────

test('AGE_RESTRICTED_TYPES = vape + the 3 tobacco deliverables (NOT charcoal)', () => {
  assert.deepStrictEqual(new Set(AGE_RESTRICTED_TYPES),
    new Set(['vape', 'hospitality_shisha_kit', 'hospitality_shisha_flavour', 'hospitality_cigar']));
  assert.equal(AGE_RESTRICTED_TYPES.length, 4);
  assert.equal(AGE_RESTRICTED_TYPES.includes('hospitality_charcoal'), false,
    'charcoal is heating consumable, never age-restricted');
  assert.equal(AGE_RESTRICTED_TYPES.includes('foodservice_produce'), false);
});

// ── Size guidance ⊆ Size enum (no new enum entries were needed) ────────────

test('every catering size-guidance string exists in the Size enum', () => {
  const enumValues = new Set(Size.schema.path('size').enumValues);
  for (const value of CATERING_VALUES) {
    const sizes = getSizesForType(value);
    assert.ok(Array.isArray(sizes) && sizes.length > 0, `${value} needs size guidance`);
    for (const size of sizes) {
      assert.ok(enumValues.has(size), `${value}: size "${size}" must exist in the Size enum`);
    }
  }
  assert.ok(enumValues.has('kg-0.25'));
});

test('cigar/mass guidance uses the canonical strings from the canon', () => {
  assert.ok([
    'cigar-single', 'sampler-5', 'sampler-6',
    'box-5', 'box-10', 'box-20', 'box-25', 'box-50',
  ].every(size => getSizesForType('hospitality_cigar').includes(size)));
  for (const size of getSizesForType('hospitality_shisha_flavour')) {
    assert.match(size, /^(?:bag-|kg-|\d+(?:\.\d+)?k?g$)/, `${size} must be a bag weight / kg string`);
  }
  assert.ok(getSizesForType('hospitality_shisha_kit').includes('unit-single'));
  const packaging = getSizesForType('foodservice_disposables');
  assert.ok(packaging.includes('unit-single'));
  assert.ok(packaging.includes('case-24'));
  assert.ok(packaging.every((size) => /^(unit-|pack-|box-|case-|capacity-|dimension-)/.test(size)));
  const dairy = getSizesForType('foodservice_dairy');
  assert.ok(dairy.includes('1kg') && dairy.includes('1L') && dairy.includes('pack-30'));
  assert.ok(getSizesForType('foodservice_bakery').includes('unit-single'));
  assert.ok(getSizesForType('foodservice_cleaning').includes('5L'));
  assert.ok(getSizesForType('foodservice_cleaning').includes('kg-1'));
  const smallware = getSizesForType('foodservice_kitchen_smallware');
  assert.ok(smallware.includes('unit-single') && smallware.includes('set-4'));
  const tabletop = getSizesForType('foodservice_tabletop_bar');
  assert.ok(tabletop.includes('set-12') && tabletop.includes('case-24'));
  assert.ok(['unit-single', 'capacity-20l', 'power-1000w'].every(size => getSizesForType('foodservice_equipment').includes(size)));
  const janitorial = getSizesForType('foodservice_janitorial');
  assert.ok(janitorial.includes('unit-single') && janitorial.includes('case-12'));
  for (const sizes of [smallware, tabletop]) {
    assert.ok(sizes.every((size) => /^(unit-|pack-|set-|case-|capacity-|dimension-)/.test(size)));
  }
  for (const value of FOODSERVICE_VALUES) {
    assert.ok(!getSizesForType(value).includes('venue_serving'));
  }
  // Legacy size guidance unchanged (spot pins).
  assert.ok(getSizesForType('beer').includes('33cl'));
  assert.ok([
    'bag-100g', 'bag-200g', 'bag-250g', 'bag-500g', 'bag-1kg',
    'kg-0.5', 'kg-1', 'kg-2',
  ].every(size => getSizesForType('hospitality_charcoal').includes(size)));
});

// ── Creation wiring (both services; source introspection) ──────────────────

test('the SubProduct creation payload ORs in the AGE_RESTRICTED gate', () => {
  const source = fs.readFileSync(path.join(__dirname, '../services/subproduct.service.js'), 'utf8');
  assert.match(source, /const \{ AGE_RESTRICTED_TYPES \} = require\('\.\.\/constants\/productTypes'\);/);
  assert.match(source, /const isAlcoholic = typeCatalogKind === catalogKindConstants\.KINDS\.beverage\s*&& newProductData\.isAlcoholic !== false/);
  assert.match(source, /requiresAgeVerification: isAlcoholic \|\| AGE_RESTRICTED_TYPES\.includes\(newProductData\.type\)/);
});

test("createProduct's autoRequiresAgeVerification flips ONLY AGE_RESTRICTED types (explicit param still wins)", () => {
  const source = fs.readFileSync(path.join(__dirname, '../services/product.service.js'), 'utf8');
  assert.match(source, /const \{ AGE_RESTRICTED_TYPES \} = require\('\.\.\/constants\/productTypes'\);/);
  const wiring = source.match(
    /if \(requiresAgeVerification === undefined && AGE_RESTRICTED_TYPES\.includes\(type\)\) \{\s*\n\s*autoRequiresAgeVerification = true;\s*\n\s*\}/
  );
  assert.ok(wiring, 'guarded by the SAME undefined check as the legacy default');
  // The catalogKind creation pivot stays on the single-source helper.
  assert.match(source, /catalogKind: catalogKindForType\(type\)/);
});

// ── Age-gate semantics, mirrored from the two wiring points ────────────────

test('mirrored age-gate expressions: tobacco flips true, every legacy type unchanged', () => {
  // The EXACT expression now in services/subproduct.service.js (the payload
  // only knows newProductData.type there):
  const subproductGate = (newProductData) =>
    newProductData.isAlcoholic !== false ||
    AGE_RESTRICTED_TYPES.includes(newProductData.type);
  // The EXACT derivation now in services/product.service.js createProduct
  // (explicit caller param wins → alcoholic default → AGE_RESTRICTED flip):
  const createProductGate = (type, isAlcoholic, requiresAgeVerification) => {
    let autoRequiresAgeVerification = requiresAgeVerification;
    if (isAlcoholic) {
      if (autoRequiresAgeVerification === undefined) autoRequiresAgeVerification = true;
    } else if (autoRequiresAgeVerification === undefined) {
      autoRequiresAgeVerification = false;
    }
    if (requiresAgeVerification === undefined && AGE_RESTRICTED_TYPES.includes(type)) {
      autoRequiresAgeVerification = true;
    }
    return autoRequiresAgeVerification;
  };

  // NEW behavior: tobacco deliverables created isAlcoholic:false flip true.
  for (const tobacco of ['hospitality_shisha_kit', 'hospitality_shisha_flavour', 'hospitality_cigar', 'vape']) {
    assert.equal(subproductGate({ isAlcoholic: false, type: tobacco }), true, tobacco);
    assert.equal(createProductGate(tobacco, false, undefined), true, tobacco);
  }
  // Explicit caller intent still wins in createProduct.
  assert.equal(createProductGate('hospitality_cigar', false, false), false);
  assert.equal(createProductGate('hospitality_cigar', false, true), true);
  // UNCHANGED for every legacy pattern — alcoholic paths keep flipping true:
  assert.equal(subproductGate({ isAlcoholic: true, type: 'wine' }), true);
  assert.equal(subproductGate({ type: 'glassware' }), true); // isAlcoholic undefined → true
  assert.equal(createProductGate('beer', true, undefined), true);
  // …and non-alcoholic legacy types stay false:
  for (const legacy of ['wine', 'snack', 'gift_set', 'glassware', 'hospitality_charcoal']) {
    assert.equal(subproductGate({ isAlcoholic: false, type: legacy }), false, legacy);
    assert.equal(createProductGate(legacy, false, undefined), false, legacy);
  }
  // Foodservice procurement is never age-gated.
  for (const value of FOODSERVICE_VALUES) {
    assert.equal(subproductGate({ isAlcoholic: false, type: value }), false, value);
    assert.equal(createProductGate(value, false, undefined), false, value);
  }
});
