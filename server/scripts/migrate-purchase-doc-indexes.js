/**
 * Migration: make purchase/vendor document numbers unique PER TENANT instead of globally.
 *
 * poNumber / agreementNumber / billNumber / returnNumber are sequences generated per
 * tenant, but these fields originally carried a field-level `unique: true`, which builds
 * a GLOBAL index (`poNumber_1`). The schemas were later changed to a compound
 * `{ tenant, <number> }` unique index — but Mongoose never drops an index it no longer
 * declares, and never alters the options of an index that already exists. So a migrated
 * database ends up with both:
 *
 *   poNumber_1            unique  ← stale, global: tenant B's first PO ("RFQ-000001")
 *                                   collides with tenant A's → E11000 dup key
 *   tenant_1_poNumber_1   NOT unique ← created before the unique option was added,
 *                                   so per-tenant uniqueness isn't actually enforced
 *
 * This script uses syncIndexes() to drop the stale global indexes and rebuild the
 * compound ones with `unique: true`. Fresh deployments are unaffected. Before syncing it
 * verifies no tenant already holds duplicate numbers, since that would fail the unique
 * build and leave the collection with no uniqueness guarantee at all.
 *
 * Usage:
 *   node -r dotenv/config scripts/migrate-purchase-doc-indexes.js            # apply
 *   node -r dotenv/config scripts/migrate-purchase-doc-indexes.js --dry-run  # preview only
 */
const mongoose = require('mongoose');

const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseAgreement = require('../models/PurchaseAgreement');
const VendorBill = require('../models/VendorBill');
const VendorReturn = require('../models/VendorReturn');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour';
const DRY_RUN = process.argv.includes('--dry-run');

// [model, number field] — the field is the per-tenant document sequence.
const TARGETS = [
  [PurchaseOrder, 'poNumber'],
  [PurchaseAgreement, 'agreementNumber'],
  [VendorBill, 'billNumber'],
  [VendorReturn, 'returnNumber'],
];

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

// A unique index build fails outright if any (tenant, number) pair repeats.
async function findDuplicates(model, field) {
  return model.collection
    .aggregate([
      { $group: { _id: { tenant: '$tenant', number: `$${field}` }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 20 },
    ])
    .toArray();
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to ${MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')}`);
  console.log(DRY_RUN ? '— DRY RUN: no changes will be written —\n' : '— APPLYING index changes —\n');

  let blocked = false;

  for (const [model, field] of TARGETS) {
    const name = model.modelName;
    const coll = model.collection.collectionName;
    const before = await listIndexNames(model);

    if (before === null) {
      console.log(`• ${name} (${coll}): collection does not exist yet — skipped.\n`);
      continue;
    }
    console.log(`• ${name} (${coll})`);
    console.log(`    existing: ${before.join(', ')}`);

    const dupes = await findDuplicates(model, field);
    if (dupes.length) {
      blocked = true;
      console.log(`    ✗ BLOCKED: ${dupes.length} duplicate (tenant, ${field}) pair(s) — resolve before syncing:`);
      for (const d of dupes) console.log(`        tenant=${d._id.tenant} ${field}=${d._id.number} ×${d.count}`);
      console.log('');
      continue;
    }

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
      const after = await model.collection.indexes();
      console.log(`    dropped:  ${dropped && dropped.length ? dropped.join(', ') : '(none)'}`);
      console.log(`    now:      ${after.map((i) => `${i.name}${i.unique ? ' (unique)' : ''}`).join(', ')}`);
    }
    console.log('');
  }

  if (blocked) {
    console.log('Some collections were skipped because of duplicate numbers — see above.');
    process.exitCode = 1;
    return;
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
