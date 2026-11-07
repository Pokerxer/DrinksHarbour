// server/__tests__/catalogScope.test.js
//
// Private catalogue scope (docs/audits/general-saas-evolution): a Product is
// either a canonical marketplace identity or a tenant-private identity. The
// model must keep the two states mutually exclusive and must never let a
// tenant-private row reach public publication. Legacy rows (no field) read as
// canonical, so this is additive with zero backfill — exactly like
// catalogKind before it (constants/catalogKind.js).

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const catalogScope = require('../constants/catalogScope');
const Size = require('../models/Size');
const { SUBPRODUCT_TENANT_PRODUCT_UNIQUE, SIZE_TENANT_SKU_UNIQUE } = require('../config/catalogueIndexes');

const build = (overrides = {}) =>
  new Product({
    name: 'Scope Test Product',
    slug: `scope-test-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    type: 'snack',
    isAlcoholic: false,
    ...overrides,
  });

test('catalog scope constants expose canonical read match', () => {
  assert.deepStrictEqual(
    catalogScope.canonicalReadMatch(),
    { publicationScope: { $ne: 'tenant_private' } }
  );
  assert.equal(catalogScope.TENANT_PRIVATE, 'tenant_private');
  assert.equal(catalogScope.CANONICAL, 'canonical');
});

test('legacy product without scope validates as canonical and owns no tenant', async () => {
  const doc = build();
  await assert.doesNotReject(doc.validate());
  assert.strictEqual(doc.publicationScope, undefined);
  assert.strictEqual(doc.owningTenant, undefined);
});

test('tenant-private product requires an owning tenant', async () => {
  const doc = build({ publicationScope: 'tenant_private' });
  await assert.rejects(doc.validate(), /owning tenant/i);
});

test('tenant-private product must name its owning tenant and clears publication', async () => {
  const mongoose = require('mongoose');
  const doc = build({
    publicationScope: 'tenant_private',
    owningTenant: new mongoose.Types.ObjectId(),
  });
  doc.isPublished = true;
  await assert.doesNotReject(doc.validate());
  assert.notStrictEqual(doc.isPublished, true, 'tenant-private rows are never published');
});

test('tenant-private product cannot be approved for the marketplace', async () => {
  const doc = build({
    publicationScope: 'tenant_private',
    owningTenant: new mongoose.Types.ObjectId(),
  });
  doc.status = 'approved';
  await assert.rejects(doc.validate(), /tenant-private/i);
});

test('canonical product cannot carry an owning tenant', async () => {
  const doc = build({
    owningTenant: new mongoose.Types.ObjectId(),
  });
  await assert.rejects(doc.validate(), /tenant-private|owning tenant/i);
});

// ── Size SKU uniqueness contract (per-tenant, like barcode) ─────────────────

test('Size sku is NOT globally unique at schema level (would be rebuilt by autoIndex)', () => {
  // If unique:true ever returns to the field definition, Mongoose autoIndex
  // rebuilds the cross-tenant sku_1 index on the next server start and every
  // general-SaaS tenant sharing a producer SKU string collides again. The
  // contract lives in config/catalogueIndexes.js + ensure-catalogue-uniqueness.js.
  assert.notStrictEqual(
    Size.schema.path('sku').options.unique, true,
    'Size.sku must not declare unique:true — per-tenant uniqueness is the index contract'
  );
});

test('Size declares the per-tenant partial unique sku contract', () => {
  const declared = Size.schema.indexes();
  const skuContract = declared.find(
    ([key, options]) =>
      Object.keys(key).length === 2 && key.tenant === 1 && key.sku === 1 &&
      options.unique === true && options.partialFilterExpression?.sku?.$gt === ''
  );
  assert.ok(skuContract, JSON.stringify(declared));
  assert.deepEqual(skuContract[1].partialFilterExpression, { sku: { $gt: '' } });
});

test('the config contract matches the declared Size index and the script knows the legacy name', () => {
  assert.deepStrictEqual(SIZE_TENANT_SKU_UNIQUE.key, { tenant: 1, sku: 1 });
  assert.strictEqual(SIZE_TENANT_SKU_UNIQUE.options.unique, true);
  assert.strictEqual(SIZE_TENANT_SKU_UNIQUE.options.partialFilterExpression.sku.$gt, '');
  assert.strictEqual(
    require('../config/catalogueIndexes').SIZE_GLOBAL_SKU_LEGACY.name, 'sku_1',
    'the retired global index name must stay recorded for the operator script'
  );
  assert.deepStrictEqual(SUBPRODUCT_TENANT_PRODUCT_UNIQUE.key, { tenant: 1, product: 1 });
  // Build authority ("one home per index", review 2026-11-02): the subproduct
  // uniqueness is operator-applied ONLY; the Size per-tenant SKU and Product
  // scope lookup are schema-declared and auto-built — they must NOT repeat in
  // the operator list or both name variants get built.
  assert.deepStrictEqual(require('../config/catalogueIndexes').CATALOGUE_CONTRACT_INDEXES, [SUBPRODUCT_TENANT_PRODUCT_UNIQUE]);
  assert.ok(
    !Size.schema.indexes().some(([key, options]) => options.unique && JSON.stringify(key) === '{"sku":1}'),
    'the legacy global sizes sku index must not exist anywhere in the schema'
  );
});
