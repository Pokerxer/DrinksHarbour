#!/usr/bin/env node
'use strict';
/**
 * Catalogue contract rollout (docs/audits/general-saas-evolution F2 + Size SKU).
 *
 *   node scripts/ensure-catalogue-uniqueness.js                   # read-only full report
 *   node scripts/ensure-catalogue-uniqueness.js --apply-uniqueness
 *   node scripts/ensure-catalogue-uniqueness.js --retire-global-size-sku
 *
 * READ-ONLY by default.
 *
 * Contract note (2026-11-02, user decision): SKU uniqueness lives on the SIZE
 * document and is scoped PER TENANT (exactly like Size.barcode). The legacy
 * cross-tenant `sku_1` global index on sizes is retired only by
 * `--retire-global-size-sku`, an explicit operator step (Product.slug
 * duplicates are reported too — slug uniqueness was re-armed by removing a
 * duplicate schema key the same day, and its unique index must not be built
 * over duplicates).
 *
 * Order matters:
 *   1. Reconcile duplicates by hand first — running a unique index over real
 *      duplicates fails the build and leaves the requirement silently
 *      unenforced (each merged pair needs a human decision).
 *   2. `--apply-uniqueness` creates the operator-applied contract indexes
 *      (idempotent; currently the subproducts (tenant, product) unique — the
 *      Size per-tenant SKU and Product scope lookup are schema-declared and
 *      built from server starts).
 *   3. `--retire-global-size-sku` drops the legacy global sizes `sku_1` index
 *      (the per-tenant unique must already exist — via schema auto-build or
 *      step 2 environments).
 *
 * The duplicate report mirrors each index's EXACT semantics (review
 * 2026-11-02 finding B4): a unique index keys null/missing values too, while
 * the Size SKU partial index exempts `sku <= ''`; the report must never flag
 * less or more than the real constraint.
 *
 * Never drops an index outside `--retire-global-size-sku` and never runs on
 * request paths. Staging/production usage is an operator action, not a
 * deployment step.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const {
  CATALOGUE_CONTRACT_INDEXES,
  SUBPRODUCT_TENANT_PRODUCT_UNIQUE,
  SIZE_TENANT_SKU_UNIQUE,
  SIZE_GLOBAL_SKU_LEGACY,
} = require('../config/catalogueIndexes');

/** Duplicates exactly as the {tenant, product} unique index conceives them —
 *  *, missing and null keys are indexed, so they must group together too. */
async function reportSubproductDuplicates(db) {
  const duplicates = await db
    .collection(SUBPRODUCT_TENANT_PRODUCT_UNIQUE.collection)
    .aggregate([
      { $group: {
        _id: { tenant: { $ifNull: ['$tenant', null] }, product: { $ifNull: ['$product', null] } },
        rows: { $push: '$_id' },
        count: { $sum: 1 },
      } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 50 },
    ])
    .toArray();
  if (duplicates.length) {
    console.log(`⚠️  ${duplicates.length}+ duplicate (tenant, product) pairs found. Reconcile manually before applying uniqueness.`);
    for (const dup of duplicates) {
      console.log(`   tenant=${dup._id.tenant} product=${dup._id.product} rows=${JSON.stringify(dup.rows)}`);
    }
  } else {
    console.log('✅ No duplicate (tenant, product) pairs found.');
  }
  return duplicates.length;
}

/** Duplicates exactly as the {tenant, sku} UNIQUE-PARTIAL index conceives them —
 *  only non-empty string SKUs participate (same as the partialFilterExpression). */
async function reportSizeSkuDuplicates(db) {
  const duplicates = await db
    .collection(SIZE_TENANT_SKU_UNIQUE.collection)
    .aggregate([
      { $match: { sku: { $gt: '' } } },
      { $group: {
        _id: { tenant: { $ifNull: ['$tenant', null] }, sku: '$sku' },
        rows: { $push: '$_id' },
        count: { $sum: 1 },
      } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 50 },
    ])
    .toArray();
  if (duplicates.length) {
    console.log(`⚠️  ${duplicates.length}+ duplicate (tenant, size sku) pairs found. Reconcile manually before applying uniqueness.`);
    for (const dup of duplicates) {
      console.log(`   tenant=${dup._id.tenant} sku=${dup._id.sku} rows=${JSON.stringify(dup.rows)}`);
    }
  } else {
    console.log('✅ No duplicate (tenant, size sku) pairs found.');
  }
  return duplicates.length;
}

/** Report-only: duplicate Product slugs (the unicity re-armed by removing the
 *  duplicate schema key on 2026-11-02). */
async function reportSlugDuplicates(db) {
  const duplicates = await db
    .collection('products')
    .aggregate([
      { $group: { _id: '$slug', rows: { $push: '$_id' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 50 },
    ])
    .toArray();
  if (duplicates.length) {
    console.log(`⚠️  ${duplicates.length}+ duplicate Product SLUGS found. Unique re-armed at schema level — reconcile before a server start builds the unique index.`);
    for (const dup of duplicates) {
      console.log(`   slug=${JSON.stringify(dup._id)} rows=${JSON.stringify(dup.rows)}`);
    }
  } else {
    console.log('✅ No duplicate Product slugs found.');
  }
  return duplicates.length;
}

/** True when a non-unique single {sku: 1} index (the legacy global constraint)
 *  is present on sizes. Returns the exact index document so the retire step
 *  can drop BY ITS ACTUAL NAME (review 2026-11-02 finding B5). */
function findLegacyGlobalSizeSku(sizeIndexes) {
  return sizeIndexes.find(
    (idx) => !idx.unique && JSON.stringify(idx.key) === '{"sku":1}'
  ) || null;
}

/** True when the per-tenant unique contract (any name) exists on sizes. */
function perTenantSizeSkuExists(sizeIndexes) {
  return sizeIndexes.some(
    (idx) => idx.unique && JSON.stringify(idx.key) === '{"tenant":1,"sku":1}'
  );
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  const args = process.argv.slice(2);
  const knownFlags = ['--apply-uniqueness', '--retire-global-size-sku'];
  const unknown = args.filter((arg) => arg.startsWith('--') && !knownFlags.includes(arg));
  if (unknown.length) {
    throw new Error(`Unknown argument(s) ${JSON.stringify(unknown)} — supported: ${knownFlags.join(' ')} (read-only report when no flag is given)`);
  }
  const apply = args.includes('--apply-uniqueness');
  const retireGlobal = args.includes('--retire-global-size-sku');
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false,
    maxPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
  });
  try {
    const db = mongoose.connection.db;
    let blocked = false;

    blocked = (await reportSubproductDuplicates(db)) > 0 || blocked;
    blocked = (await reportSizeSkuDuplicates(db)) > 0 || blocked;
    await reportSlugDuplicates(db);

    const sizes = db.collection(SIZE_TENANT_SKU_UNIQUE.collection);
    let sizeIndexes = await sizes.indexes();
    const legacyGlobal = findLegacyGlobalSizeSku(sizeIndexes);
    if (legacyGlobal) {
      console.log(`ℹ️  Legacy global sizes "${legacyGlobal.name}" index still present (cross-tenant SKU constraint).`);
      console.log('   The per-tenant contract is NOT in effect until --retire-global-size-sku runs.');
    } else {
      console.log('✅ Legacy global sizes sku index is gone (per-tenant SKU uniqueness is authoritative).');
    }

    if (!apply && !retireGlobal) {
      console.log('ℹ️  Report-only run. Use --apply-uniqueness (step 2) and then --retire-global-size-sku (step 3).');
      return;
    }

    if (apply) {
      if (blocked) throw new Error('Refusing --apply-uniqueness while duplicate pairs exist.');
      for (const { collection, key, options } of CATALOGUE_CONTRACT_INDEXES) {
        const name = await db.collection(collection).createIndex(key, options);
        console.log(`✅ ${collection}: ensured index ${name}`);
      }
    }

    if (retireGlobal) {
      // Re-read the CURRENT index list — in a combined
      // `--apply-uniqueness --retire-global-size-sku` run the list captured
      // above is stale and would refuse despite step 2 having just succeeded
      // (review 2026-11-02 finding B3).
      sizeIndexes = await sizes.indexes();
      if (!perTenantSizeSkuExists(sizeIndexes)) {
        throw new Error('Refusing to drop the global sku index before the per-tenant unique index exists. The per-tenant contract is schema-declared (Size.js): start the server once against this database so it builds, or create {tenant:1,sku:1} unique manually.');
      }
      const legacy = findLegacyGlobalSizeSku(sizeIndexes);
      if (!legacy) {
        console.log('✅ Nothing to retire: sizes legacy global sku index is already absent.');
      } else {
        const result = await sizes.dropIndex(legacy.name);
        console.log(`✅ sizes: dropped legacy global index "${legacy.name}", acknowledged=${result.ok === 1 ? 'ok' : JSON.stringify(result)}`);
      }
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) main().catch(err => {
  console.error('Catalogue contract rollout failed:', err.message);
  process.exitCode = 1;
});
module.exports = { main, findLegacyGlobalSizeSku, perTenantSizeSkuExists };
