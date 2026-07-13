/**
 * Retire pack SKUs (Size.unitsPerPack >= 2) in favor of quantity-triggered
 * pack pricing on the single size:
 *   1. find the sibling single size on the same subproduct (same volumeMl)
 *   2. fold the pack's stock into the single (packStock × unitsPerPack)
 *   3. copy unitsPerPack onto the single as its pack threshold
 *   4. deactivate the pack SKU
 *
 * Usage: node server/scripts/migrate-pack-skus.js [--apply]   (dry-run by default)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const Size = require('../models/Size');

  const packSizes = await Size.find({ unitsPerPack: { $gte: 2 } });
  console.log(`Found ${packSizes.length} pack SKU size(s)`);

  for (const pack of packSizes) {
    const single = await Size.findOne({
      _id: { $ne: pack._id },
      subproduct: pack.subproduct,
      volumeMl: pack.volumeMl,
      unitsPerPack: 1,
    });
    if (!single) {
      console.log(`SKIP ${pack._id} (${pack.displayName || pack.size}): no matching single size (volumeMl=${pack.volumeMl})`);
      continue;
    }
    const foldedUnits = (pack.stock || 0) * pack.unitsPerPack;
    console.log(`${APPLY ? 'APPLY' : 'DRY'} pack ${pack._id} (${pack.displayName || pack.size}, stock=${pack.stock}) → single ${single._id}: +${foldedUnits} units, threshold=${pack.unitsPerPack}`);
    if (APPLY) {
      single.stock = (single.stock || 0) + foldedUnits;
      single.unitsPerPack = pack.unitsPerPack;
      await single.save();
      pack.status = 'inactive';
      pack.availability = 'out_of_stock';
      pack.stock = 0;
      await pack.save();
    }
  }
  console.log(APPLY ? 'Done.' : 'Dry run complete — re-run with --apply to write.');

  await mongoose.disconnect();
}

run().catch((e) => { console.error('FAIL:', e); process.exit(1); });
