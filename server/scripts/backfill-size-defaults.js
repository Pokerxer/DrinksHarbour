'use strict';

// Backfill all existing Size documents with the new platform default values:
//   sizeCategory → 'standard'
//   unitsPerPack → 6
//   packaging    → { type: 'pack-6' }
//   roundUp      → '100'
//
// Only fields that are missing, empty, or holding an old default are touched —
// tenant-specific values (price, stock, sku, etc.) are never overwritten.
//
// Usage:
//   DRY_RUN=true  MONGODB_URI=... node backfill-size-defaults.js   # preview only
//   MONGODB_URI=...              node backfill-size-defaults.js   # apply

const mongoose = require('mongoose');

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://jrwaldehzx:NWXdpyCMP7yB7a4N@cluster0.ukrr40p.mongodb.net/drinksharbour';

const DRY_RUN = String(process.env.DRY_RUN || '').toLowerCase() === 'true';
const BATCH_SIZE = 500;

const VALID_SIZE_CATEGORIES = [
  'miniature', 'single_serve', 'standard', 'large', 'extra_large',
  'multi_pack', 'bulk', 'gift_set', 'variety_pack', 'keg',
];

const VALID_ROUND_UP = ['none', '100', '500', '1000'];

function normalizePackaging(packaging) {
  // Already a valid object with a type — leave as-is.
  if (packaging && typeof packaging === 'object' && !Array.isArray(packaging) && packaging.type) {
    return null; // no change needed
  }
  // Flat string → convert to { type: string }
  if (typeof packaging === 'string' && packaging.trim() !== '') {
    return { type: packaging.trim() };
  }
  // Missing / null / empty / invalid → default
  return { type: 'pack-6' };
}

async function main() {
  console.log(`Connecting to MongoDB (DRY_RUN=${DRY_RUN})...`);
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 60000,
  });
  console.log('Connected.');

  // Load the Size model from the schema so Mongoose validation/enum applies.
  const Size = require('../models/Size');

  const totalCount = await Size.countDocuments({});
  console.log(`Found ${totalCount} Size documents.\n`);

  let processed = 0;
  let updated = 0;
  const fieldStats = {
    sizeCategory: 0,
    unitsPerPack: 0,
    packaging: 0,
    roundUp: 0,
  };

  // Process in batches via cursor to avoid loading everything into memory.
  const cursor = Size.find({}).lean().cursor();

  let batchOps = [];

  for await (const size of cursor) {
    const setFields = {};
    let hasChange = false;

    // ── sizeCategory → 'standard' ──────────────────────────────────────
    if (
      !size.sizeCategory ||
      size.sizeCategory === '' ||
      !VALID_SIZE_CATEGORIES.includes(size.sizeCategory)
    ) {
      setFields.sizeCategory = 'standard';
      hasChange = true;
      fieldStats.sizeCategory++;
    }

    // ── unitsPerPack → 6 ───────────────────────────────────────────────
    // Update if missing, null, 0, or the old default of 1.
    if (
      size.unitsPerPack === undefined ||
      size.unitsPerPack === null ||
      size.unitsPerPack === 0 ||
      size.unitsPerPack === 1
    ) {
      setFields.unitsPerPack = 6;
      hasChange = true;
      fieldStats.unitsPerPack++;
    }

    // ── packaging → { type: 'pack-6' } ────────────────────────────────
    const normalizedPkg = normalizePackaging(size.packaging);
    if (normalizedPkg !== null) {
      setFields.packaging = normalizedPkg;
      hasChange = true;
      fieldStats.packaging++;
    }

    // ── roundUp → '100' ────────────────────────────────────────────────
    // Update if missing, empty, 'none' (old default), or invalid enum.
    if (
      !size.roundUp ||
      size.roundUp === '' ||
      size.roundUp === 'none' ||
      !VALID_ROUND_UP.includes(size.roundUp)
    ) {
      setFields.roundUp = '100';
      hasChange = true;
      fieldStats.roundUp++;
    }

    if (hasChange) {
      batchOps.push({
        updateOne: {
          filter: { _id: size._id },
          update: { $set: setFields },
        },
      });
      updated++;
    }

    processed++;

    // Flush batch
    if (batchOps.length >= BATCH_SIZE) {
      if (!DRY_RUN) {
        await Size.bulkWrite(batchOps, { ordered: false });
      }
      console.log(
        `  Processed ${processed}/${totalCount} | Updated so far: ${updated} | Batch flushed (${batchOps.length} ops)`
      );
      batchOps = [];
    }
  }

  // Flush remaining
  if (batchOps.length > 0) {
    if (!DRY_RUN) {
      await Size.bulkWrite(batchOps, { ordered: false });
    }
    console.log(`  Processed ${processed}/${totalCount} | Final batch flushed (${batchOps.length} ops)`);
  }

  console.log('\n══════════════════════════════════════════════');
  console.log(`  Total processed:  ${processed}`);
  console.log(`  Total updated:    ${updated}`);
  console.log('  Field-level changes:');
  console.log(`    sizeCategory → 'standard': ${fieldStats.sizeCategory}`);
  console.log(`    unitsPerPack → 6:          ${fieldStats.unitsPerPack}`);
  console.log(`    packaging → {type:'pack-6'}: ${fieldStats.packaging}`);
  console.log(`    roundUp → '100':           ${fieldStats.roundUp}`);
  console.log('════════════════════════════════════════════════');

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN — no changes were written. Re-run without DRY_RUN=true to apply.');
  } else {
    console.log('\n✅ Backfill complete. Verifying with a sample...');
    const sample = await Size.findOne({}).lean();
    if (sample) {
      console.log(
        'Sample:',
        JSON.stringify(
          {
            _id: sample._id,
            size: sample.size,
            sizeCategory: sample.sizeCategory,
            unitsPerPack: sample.unitsPerPack,
            packaging: sample.packaging,
            roundUp: sample.roundUp,
          },
          null,
          2
        )
      );
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});