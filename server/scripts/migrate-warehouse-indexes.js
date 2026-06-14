/**
 * Migration: reconcile indexes on the warehouse collections after the
 * single-per-subproduct → multi-warehouse model rewrite.
 *
 * The old `Warehouse` model carried per-subproduct fields (subProduct, location,
 * zone/aisle/shelf, status, currentQuantity, …) and unique indexes built on them.
 * Mongoose never drops indexes that are no longer declared in the schema, so a
 * pre-existing `warehouses` collection keeps those stale indexes. The worst is the
 * old UNIQUE `tenant_1_subProduct_1`: the new model has no `subProduct`, so a second
 * warehouse stores `subProduct: null` and collides ("E11000 dup key … subProduct: null").
 *
 * This script uses Mongoose's syncIndexes() to drop every index not declared on the
 * current schema and create any that are missing — for Warehouse, WarehouseStock and
 * WarehouseMovement. Fresh deployments are unaffected (only schema indexes ever exist);
 * this is only needed for databases migrated from the old model.
 *
 * Usage:
 *   node -r dotenv/config scripts/migrate-warehouse-indexes.js            # apply
 *   node -r dotenv/config scripts/migrate-warehouse-indexes.js --dry-run  # preview only
 *
 * Note: _id_ is managed by MongoDB and is never touched by syncIndexes().
 */
const mongoose = require('mongoose');

const Warehouse = require('../models/Warehouse');
const WarehouseStock = require('../models/WarehouseStock');
const WarehouseMovement = require('../models/WarehouseMovement');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour';
const DRY_RUN = process.argv.includes('--dry-run');

const MODELS = [Warehouse, WarehouseStock, WarehouseMovement];

async function listIndexNames(model) {
  try {
    const idx = await model.collection.indexes();
    return idx.map((i) => i.name);
  } catch (e) {
    // Collection may not exist yet (fresh DB) — nothing to reconcile.
    if (e.codeName === 'NamespaceNotFound' || /ns does not exist/i.test(e.message)) return null;
    throw e;
  }
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to ${MONGODB_URI}`);
  console.log(DRY_RUN ? '— DRY RUN: no changes will be written —\n' : '— APPLYING index changes —\n');

  for (const model of MODELS) {
    const name = model.modelName;
    const coll = model.collection.collectionName;
    const before = await listIndexNames(model);

    if (before === null) {
      console.log(`• ${name} (${coll}): collection does not exist yet — skipped.`);
      continue;
    }
    console.log(`• ${name} (${coll})`);
    console.log(`    existing: ${before.join(', ')}`);

    if (DRY_RUN) {
      // diffIndexes() reports what syncIndexes() would change, without writing.
      const { toDrop, toCreate } = await model.diffIndexes();
      console.log(`    would DROP:   ${toDrop.length ? toDrop.join(', ') : '(none)'}`);
      console.log(
        `    would CREATE: ${toCreate.length ? toCreate.map((k) => JSON.stringify(k)).join(', ') : '(none)'}`
      );
    } else {
      // syncIndexes() drops indexes not in the schema and creates any missing ones.
      const dropped = await model.syncIndexes();
      const after = await listIndexNames(model);
      console.log(`    dropped:  ${dropped && dropped.length ? dropped.join(', ') : '(none)'}`);
      console.log(`    now:      ${after.join(', ')}`);
    }
    console.log('');
  }

  console.log(DRY_RUN ? 'Dry run complete.' : 'Index migration complete.');
}

run()
  .catch((err) => {
    console.error('Index migration error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  });
