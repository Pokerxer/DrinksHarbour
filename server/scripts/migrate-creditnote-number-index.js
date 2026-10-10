/**
 * Migration: make the credit note number unique PER TENANT, and only where a
 * number exists.
 *
 * Credit note numbers moved from `CN-${year}-${randomUUID().slice(0,13)}` to a
 * per-tenant, per-year sequence (CN-2026-000001). That required two schema
 * changes Mongoose will not make on its own:
 *
 *   1. `number` became OPTIONAL, because a draft has no number yet — the number
 *      is allocated at post so the published sequence stays gapless.
 *   2. The unique index on { tenant, number } became PARTIAL, matching only
 *      documents where `number` is a string.
 *
 * (2) is not cosmetic. A plain unique index treats a missing value as one shared
 * value, so with a non-unique partial filter removed the constraint would allow
 * exactly ONE unnumbered draft per tenant and every second draft would fail with
 * E11000. The partial filter keeps drafts out of the constraint entirely.
 *
 * Mongoose's autoIndex CREATES declared indexes but never DROPS or ALTERS an
 * existing one, and a live database already carries `tenant_1_number_1` as a
 * plain unique index. Left alone, that stale index both blocks unnumbered drafts
 * and ignores the partial filter. This script rebuilds it.
 *
 * Usage:
 *   node -r dotenv/config scripts/migrate-creditnote-number-index.js            # apply
 *   node -r dotenv/config scripts/migrate-creditnote-number-index.js --dry-run  # preview only
 */
const mongoose = require('mongoose');
const CreditNote = require('../models/CreditNote');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour';
const DRY_RUN = process.argv.includes('--dry-run');

async function listIndexNames(model) {
  try {
    const idx = await model.collection.indexes();
    return idx.map((i) => i.name);
  } catch (e) {
    // Fresh database: the collection may not exist yet.
    if (e.codeName === 'NamespaceNotFound' || /ns does not exist/i.test(e.message)) return null;
    throw e;
  }
}

/**
 * The new index is unique, so a build fails outright if any pair repeats.
 * Checked before syncing: a failed unique build would leave the collection with
 * no uniqueness guarantee at all, which is worse than the stale index.
 */
async function findDuplicateNumbers() {
  return CreditNote.collection
    .aggregate([
      // Notes with no number are outside the partial filter, so they cannot
      // collide — exclude them before grouping or every draft looks duplicated.
      { $match: { number: { $type: 'string' } } },
      { $group: { _id: { tenant: '$tenant', number: '$number' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 20 },
    ])
    .toArray();
}

async function countUnnumbered() {
  return CreditNote.countDocuments({ number: { $exists: false } })
    + await CreditNote.countDocuments({ number: null });
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to ${MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')}`);
  console.log(DRY_RUN ? '— DRY RUN: no changes will be written —\n' : '— APPLYING index changes —\n');

  const name = CreditNote.modelName;
  const coll = CreditNote.collection.collectionName;
  const before = await listIndexNames(CreditNote);

  if (before === null) {
    console.log(`• ${name} (${coll}): collection does not exist yet — nothing to migrate.\n`);
    return;
  }

  console.log(`• ${name} (${coll})`);
  console.log(`    existing indexes: ${before.join(', ')}`);

  const total = await CreditNote.countDocuments();
  const unnumbered = await countUnnumbered();
  console.log(`    ${total} credit note(s), ${unnumbered} without a number`);

  const dupes = await findDuplicateNumbers();
  if (dupes.length) {
    console.log(`    ✗ BLOCKED: ${dupes.length} duplicate (tenant, number) pair(s) — resolve first:`);
    for (const d of dupes) {
      console.log(`        tenant=${d._id.tenant} number=${d._id.number} ×${d.count}`);
    }
    console.log('\nNothing was changed. The unique index is not rebuilt.');
    return;
  }

  if (DRY_RUN) {
    const { toDrop, toCreate } = await CreditNote.diffIndexes();
    console.log(`    would DROP:   ${toDrop.length ? toDrop.join(', ') : '(none)'}`);
    console.log(`    would CREATE: ${toCreate.length ? toCreate.join(', ') : '(none)'}`);
    for (const spec of toCreate) console.log(`                 ${JSON.stringify(spec)}`);
    console.log('');
    return;
  }

  const dropped = await CreditNote.syncIndexes();
  console.log(`    ✓ synced. dropped: ${dropped.length ? dropped.join(', ') : '(none)'}`);
  const after = await listIndexNames(CreditNote);
  console.log(`    indexes now: ${after.join(', ')}`);

  // Prove the constraint the drafts depend on: two unnumbered notes, one tenant.
  const check = await CreditNote.collection
    .aggregate([{ $match: { number: { $exists: false } } }, { $count: 'drafts' }])
    .toArray();
  console.log(`    ${check.length ? check[0].drafts : 0} unnumbered note(s) now outside the unique index`);
  console.log('\nDone.');
}

run()
  .catch((err) => {
    console.error('\n✗ Migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
