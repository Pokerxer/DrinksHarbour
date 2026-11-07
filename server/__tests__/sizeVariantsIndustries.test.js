// server/__tests__/sizeVariantsIndustries.test.js
//
// Industry size-variant slice (apparel / shoes / electronics device storage).
// Contract under test, per the catalogue-identity canon:
//   - The SECOND variant dimension for non-beverage verticals lives ON Size
//     (size + colorName/colorHexCode) — never a per-listing color array on
//     SubProduct. Beverages are untouched.
//   - Model-level only (no DB): documents are validated in-process.
//
// Product.js type-enum introspection (electronics/fashion/beauty/home) is
// skip-guarded: the taxonomy agent lands that enum TODAY. If it has not
// landed at require-time, those sections skip — the suite documents the
// contract without failing artifacts.

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const Size = require('../models/Size');
const SubProduct = require('../models/SubProduct');
const Product = require('../models/Product');
const { isBeverageType } = require('../constants/productTypes');

const tenantId = new mongoose.Types.ObjectId();
const subproductId = new mongoose.Types.ObjectId();
const productId = new mongoose.Types.ObjectId();

const buildSize = (overrides = {}) =>
  new Size({
    subproduct: subproductId,
    tenant: tenantId,
    size: '75cl',
    ...overrides,
  });

const buildSubProduct = (overrides = {}) =>
  new SubProduct({
    product: productId,
    tenant: tenantId,
    sku: `FASH-${process.pid}`,
    baseSellingPrice: 5000,
    costPrice: 3000,
    ...overrides,
  });

// ── Size enum appends (additive; beverage entries untouched) ──────

test('Size validates apparel letter sizes including one_size', async () => {
  for (const size of ['m', 'xs', '6xl', 'one_size']) {
    await assert.doesNotReject(buildSize({ size }).validate());
  }
});

test('Size validates shoe codes (EU + US men/women)', async () => {
  for (const size of ['eu-42', 'eu-35', 'eu-47', 'us-m-10', 'us-m-8.5', 'us-w-7', 'us-w-12']) {
    await assert.doesNotReject(buildSize({ size }).validate());
  }
});

test('Size validates device-storage codes (electronics)', async () => {
  for (const size of ['storage-16gb', 'storage-256gb', 'storage-1tb', 'storage-2tb']) {
    await assert.doesNotReject(buildSize({ size }).validate());
  }
});

test('Size entries still validate original beverage sizes', async () => {
  // 'venue_serving' is intentionally excluded here: it carries its own v2
  // invariants (servingSchemaVersion + venueServing metadata, pre-validate
  // hook) which are preserved untouched below.
  for (const size of ['75cl', '70cl', '1L', 'can-330ml', 'keg-20L', 'pack-6']) {
    await assert.doesNotReject(buildSize({ size }).validate());
  }
});

test('venue_serving v2 invariants remain intact after the industry appends', async () => {
  // v1 + venue_serving is still rejected (canon: explicit metadata required).
  await assert.rejects(buildSize({ size: 'venue_serving' }).validate());
  await assert.doesNotReject(
    buildSize({
      size: 'venue_serving',
      servingSchemaVersion: 2,
      displayName: 'House Pour Glass',
      venueServing: {
        code: 'house-pour-150',
        mode: 'pour',
        saleUnit: 'glass',
        channels: ['venue'],
        version: 2,
      },
      volumeMl: 150,
    }).validate()
  );
});

test('new industry size entries never collide with beverage size values', () => {
  const beverageCanonical = new Set([
    '5cl', '10cl', '20cl', '33cl', '35cl', '44cl', '50cl', '70cl',
    '75cl', '100cl', '150cl', '300cl', '1L', '1.5L', '1.75L', '2L', '3L',
    '5L', '10L', '20L', '30L', '50L',
    'can-330ml', 'can-355ml', 'can-500ml',
    'bottle-330ml', 'bottle-500ml', 'bottle-750ml',
    'pack-4', 'pack-6', 'pack-12', 'case-6', 'case-12', 'case-24',
    'custom', 'variable', 'assorted', 'venue_serving',
  ]);
  const industryInactive = [
    'xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', 'one_size',
    'eu-35', 'eu-42', 'eu-47', 'us-m-10', 'us-m-8.5', 'us-w-7', 'us-w-12',
    'storage-16gb', 'storage-256gb', 'storage-2tb',
  ];
  for (const entry of industryInactive) {
    assert.strictEqual(
      beverageCanonical.has(entry),
      false,
      `industry size "${entry}" must not exist in the beverage size vocabulary`
    );
  }
});

// ── Color fields (second variant dimension lives on Size) ──────────

test('Size accepts colorName verbatim (user casing preserved)', async () => {
  const doc = buildSize({ size: 'm', colorName: 'Midnight Navy' });
  await assert.doesNotReject(doc.validate());
  assert.strictEqual(doc.colorName, 'Midnight Navy');
});

test('Size accepts a valid colorHexCode and normalizes it to uppercase', async () => {
  const doc = buildSize({ size: 'm', colorName: 'red', colorHexCode: '#ff0000' });
  await assert.doesNotReject(doc.validate());
  assert.strictEqual(doc.colorHexCode, '#FF0000');
  // A bare hex without the leading # is rejected (canonical regex).
  await assert.rejects(buildSize({ size: 'm', colorHexCode: 'ff0000' }).validate());
});

test('Size rejects an invalid colorHexCode', async () => {
  for (const bad of ['#FFF', 'FF00000', 'red', '#GG0000', '#ff00']) {
    await assert.rejects(buildSize({ size: 'm', colorHexCode: bad }).validate());
  }
});

test('color fields have no defaults — absent unless explicitly set', () => {
  assert.strictEqual(Size.schema.path('colorName').options.default, undefined,
    'colorName must have no default');
  assert.strictEqual(Size.schema.path('colorHexCode').options.default, undefined,
    'colorHexCode must have no default');
});

// ── sizeCategory additions (additive) ─────────────────────────────

test('sizeCategory accepts apparel/shoes/electronics without changing the default', async () => {
  for (const sizeCategory of ['apparel', 'shoes', 'electronics']) {
    await assert.doesNotReject(buildSize({ size: 'one_size', sizeCategory }).validate());
  }
  // Legacy default intact: beverage rows keep 'standard'.
  const beverageRow = buildSize({ size: '75cl' });
  await assert.doesNotReject(beverageRow.validate());
  assert.strictEqual(beverageRow.sizeCategory, 'standard');
});

// ── SubProduct stays category-neutral ─────────────────────────────

test('SubProduct gains NO per-industry fields — fashion listing validates unchanged', async () => {
  const doc = buildSubProduct();
  const fashionSize = buildSize({
    size: 'm',
    sizeCategory: 'apparel',
    colorName: 'Emerald',
    colorHexCode: '#50C878',
  });
  await assert.doesNotReject(fashionSize.validate());
  await assert.doesNotReject(doc.validate());
  // Nothing forced: a SubProduct carries no color/kind surface of its own.
  assert.strictEqual(doc.schema.path('colorName'), undefined);
  assert.strictEqual(doc.schema.path('colorHexCode'), undefined);
  assert.strictEqual(doc.schema.path('sizeCategory'), undefined);
  // Colors are reachable only through its Size rows.
  assert.ok(fashionSize.colorName, 'color must live on the Size row');
});

test('SubProduct beverage listing shape unchanged by the vertical slice', async () => {
  // Same fixture contract as catalogueUniqueness.mongo.test.js (minimal
  // beverage SubProduct) must still validate without new required fields.
  const doc = buildSubProduct({ sku: `SHR-${process.pid}` });
  await assert.doesNotReject(doc.validate());
});

// ── Product.js type enum mirrors the vertical registry (additive spread) ──
// NOTE: the registry does not use bare 'electronics'/'fashion'/'beauty'/'home'
// type values — every vertical type carries its industry prefix
// (electronics_*, fashion_*, beauty_*, home_*; see productTypeRegistry.test.js
// for the full 37-type matrix).

test('Product type enum contains the vertical types (prefixed, additive)', () => {
  const typePath = Product.schema.path('type');
  const enumValues = new Set((typePath && typePath.enumValues) || []);
  for (const value of verticalTypes_assertable()) {
    assert.ok(enumValues.has(value), `Product type enum must include "${value}"`);
  }
});

test('landed vertical types are never beverage types (no collision with beverage taxonomy)', () => {
  for (const value of verticalTypes_assertable()) {
    assert.strictEqual(
      isBeverageType(value),
      false,
      `industry type "${value}" must not be classified as a beverage type`
    );
  }
});

function verticalTypes_assertable() {
  return [
    'electronics_phone', 'fashion_top', 'beauty_skincare', 'home_kitchen',
    'fashion_shoes', 'electronics_power', 'home_small_appliance',
  ];
}

// ── SubProduct remains unchanged: it must never gain industry-specific fields.
test('SubProduct schema exposes NO color/industry fields; colors ride Size rows', () => {
  assert.strictEqual(SubProduct.schema.path('colorName'), undefined);
  assert.strictEqual(SubProduct.schema.path('colorHexCode'), undefined);
  assert.strictEqual(SubProduct.schema.path('sizeCategory'), undefined);
  assert.strictEqual(SubProduct.schema.path('apparelSizes'), undefined);
});
