// server/__tests__/catalogueUniqueness.mongo.test.js
//
// Opt-in: runs only with DRINKSHARBOUR_CATALOGUE_TEST_MONGO_URI pointing at a
// disposable localhost replica set (docs/audits/general-saas-evolution/
// migration.md §2/§3; never the application MONGODB_URI).
//
// Proves, under real MongoDB uniqueness enforcement:
//   1. Duplicate (tenant, product) SubProduct creation is refused by the
//      database itself, not only by the service's non-transactional check.
//   2. Two concurrent creations race to exactly one success.
//   3. The same product remains creatable by a DIFFERENT tenant: the unique
//      index is tenant-scoped, never global.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const uri = process.env.DRINKSHARBOUR_CATALOGUE_TEST_MONGO_URI;

async function connectOwned(t, suffix) {
  assert.match(
    uri,
    /^mongodb:\/\/127\.0\.0\.1:29130\/drinks_catalogue_test_[\w]+\?replicaSet=catUniqueness$/
  );
  const base = uri.split('?')[0];
  await mongoose.connect(`${base}?directConnection=true`, { serverSelectionTimeoutMS: 5000 });
  let initiated = false;
  try {
    const admin = mongoose.connection.db.admin();
    try {
      await admin.command({ replSetGetStatus: 1 });
    } catch (error) {
      if (error.code !== 94) throw error;
      await admin.command({ replSetInitiate: { _id: 'catUniqueness', members: [{ _id: 0, host: '127.0.0.1:29130' }] } });
      initiated = true;
    }
  } finally {
    // Never leak the bootstrap connection — even when a non-94 replSetGetStatus
    // error aborts initiation (review 2026-11-02 finding B10).
    await mongoose.disconnect();
  }
  if (initiated) {
    // A freshly initiated single-node set needs a beat to elect a primary
    // before the owned connection can verify.
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  const ownedUri = uri.replace('?', `_${suffix}_${process.pid}?`);
  await mongoose.connect(ownedUri);
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
}

async function seed() {
  const SubProduct = require('../models/SubProduct');
  const { SUBPRODUCT_TENANT_PRODUCT_UNIQUE } = require('../config/catalogueIndexes');
  const product = new mongoose.Types.ObjectId();
  await mongoose.connection.collection('products').insertOne({
    _id: product,
    name: 'Race Wine',
    slug: `race-${process.pid}`,
    type: 'wine',
    isAlcoholic: false,
  });
  // Create the uniqueness contract explicitly, exactly the way the reviewed
  // rollout script (scripts/ensure-catalogue-uniqueness.js --apply-uniqueness)
  // would on a real database. Tests never rely on autoIndex backfills.
  await SubProduct.collection.createIndex(
    SUBPRODUCT_TENANT_PRODUCT_UNIQUE.key,
    SUBPRODUCT_TENANT_PRODUCT_UNIQUE.options
  );
  return { product, SubProduct };
}

test('duplicate (tenant, product) sub-product creation is refused at the database level', { skip: !uri }, async t => {
  await connectOwned(t, 'dup');
  const { product, SubProduct } = await seed();
  const tenant = new mongoose.Types.ObjectId();
  await SubProduct.collection.insertOne({
    _id: new mongoose.Types.ObjectId(), product, tenant,
    sku: `RACE-${process.pid}-A`, baseSellingPrice: 1000, costPrice: 500, status: 'active',
  });
  await assert.rejects(
    SubProduct.create({ product, tenant, sku: `RACE-${process.pid}-B`, baseSellingPrice: 1000, costPrice: 500 }),
    /duplicate key|E11000/i
  );
});

test('concurrent creations of the same (tenant, product) yield exactly one success', { skip: !uri }, async t => {
  await connectOwned(t, 'race');
  const { product, SubProduct } = await seed();
  const tenant = new mongoose.Types.ObjectId();
  const results = await Promise.allSettled([
    SubProduct.create({ product, tenant, sku: `RACE-${process.pid}-1`, baseSellingPrice: 1000, costPrice: 500 }),
    SubProduct.create({ product, tenant, sku: `RACE-${process.pid}-2`, baseSellingPrice: 1000, costPrice: 500 }),
  ]);
  const succeeded = results.filter(r => r.status === 'fulfilled');
  const duplicates = results.filter(
    r => r.status === 'rejected' && /duplicate key|E11000/i.test(String(r.reason))
  );
  assert.equal(succeeded.length, 1, JSON.stringify(results.map(r => r.reason?.message || 'ok')));
  assert.equal(duplicates.length, 1, 'the loser must be a duplicate-key rejection');
});

test('the same product remains creatable by a different tenant', { skip: !uri }, async t => {
  await connectOwned(t, 'other');
  const { product, SubProduct } = await seed();
  const firstTenant = new mongoose.Types.ObjectId();
  const otherTenant = new mongoose.Types.ObjectId();
  await SubProduct.create({ product, tenant: firstTenant, sku: `RACE-${process.pid}-X`, baseSellingPrice: 1000, costPrice: 500 });
  const other = await SubProduct.create({ product, tenant: otherTenant, sku: `RACE-${process.pid}-Y`, baseSellingPrice: 1000, costPrice: 500 });
  assert.ok(other._id);
});

// ── Size SKU contract (per-tenant, like Size.barcode) ────────────────────────

async function seedSizes() {
  const Size = require('../models/Size');
  const SubProduct = require('../models/SubProduct');
  const { SIZE_TENANT_SKU_UNIQUE } = require('../config/catalogueIndexes');
  const tenantA = new mongoose.Types.ObjectId();
  const subA = new mongoose.Types.ObjectId();
  const subB = new mongoose.Types.ObjectId();
  await mongoose.connection.collection('subproducts').insertMany([
    { _id: subA, tenant: tenantA, sku: `SUB-${process.pid}-A`, baseSellingPrice: 1000, costPrice: 500 },
    { _id: subB, tenant: tenantA, sku: `SUB-${process.pid}-B`, baseSellingPrice: 1000, costPrice: 500 },
  ]);
  // The per-tenant partial unique is created explicitly, the way
  // scripts/ensure-catalogue-uniqueness.js --apply-uniqueness would.
  await Size.collection.createIndex(SIZE_TENANT_SKU_UNIQUE.key, SIZE_TENANT_SKU_UNIQUE.options);
  return { Size, tenantA, subA, subB };
}

test('the same Size sku is refused within one tenant', { skip: !uri }, async t => {
  await connectOwned(t, 'sizesame');
  const { Size, tenantA, subA } = await seedSizes();
  await Size.create({ subproduct: subA, tenant: tenantA, size: '75cl', sku: `SHR-${process.pid}` });
  await assert.rejects(
    Size.create({ subproduct: subA, tenant: tenantA, size: '1L', sku: `SHR-${process.pid}` }),
    /duplicate key|E11000/i
  );
});

test('the same Size sku remains available to a DIFFERENT tenant', { skip: !uri }, async t => {
  await connectOwned(t, 'sizeother');
  const { Size, tenantA, subA } = await seedSizes();
  await Size.create({ subproduct: subA, tenant: tenantA, size: '75cl', sku: 'MON-70' });
  const tenantB = new mongoose.Types.ObjectId();
  const subB = new mongoose.Types.ObjectId();
  await mongoose.connection.collection('subproducts').insertOne({
    _id: subB, tenant: tenantB, sku: `SUB-${process.pid}-Z`, baseSellingPrice: 1000, costPrice: 500,
  });
  const other = await Size.create({ subproduct: subB, tenant: tenantB, size: '75cl', sku: 'MON-70' });
  assert.ok(other._id);
});

test('an empty Size sku is not constrained (partial index, like barcode)', { skip: !uri }, async t => {
  await connectOwned(t, 'sizeempty');
  const { Size, tenantA, subA, subB } = await seedSizes();
  await Size.create({ subproduct: subA, tenant: tenantA, size: '75cl' });
  const second = await Size.create({ subproduct: subB, tenant: tenantA, size: '1L' });
  assert.ok(second._id);
  assert.strictEqual(second.sku, undefined);
});
