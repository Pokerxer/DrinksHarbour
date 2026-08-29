/**
 * Backfill / refresh Brand.productCount and Brand.activeProductCount from the
 * actual Product collection.
 *
 * Why: the storefront /brands grid used to filter on productCount > 0, and a
 * large share of active brands in the DB (203/211 zero-count ones) actually had
 * products linked by ObjectId but a stale productCount of 0, so they never
 * appeared. This script recomputes the two cached counters for every brand
 * (irrespective of status) so the counts on the grid and stats are accurate.
 *
 * productCount        = number of Product docs that reference this brand
 * activeProductCount  = of those, how many have status === 'approved'
 *
 * Usage:
 *   node scripts/backfill-brand-product-counts.js --dry   # print, no writes
 *   node scripts/backfill-brand-product-counts.js         # write + report
 */
require('dotenv').config();
const mongoose = require('mongoose');

const Brand = require('../models/Brand');
const Product = require('../models/Product');

const DRY_RUN = process.argv.includes('--dry');
const uri = process.env.MONGODB_URI;

async function main() {
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }
  await mongoose.connect(uri);

  // Per-brand totals. Only brands with ≥1 product are returned by the group,
  // so we start from zero for every brand and overlay the real counts.
  const totals = await Product.aggregate([
    { $match: { brand: { $ne: null } } },
    {
      $group: {
        _id: '$brand',
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
        },
      },
    },
  ]);

  const countMap = new Map(totals.map(t => [String(t._id), t]));

  const allBrands = await Brand.find({}).select('_id name slug productCount activeProductCount').lean();
  let fixed = 0;

  for (const brand of allBrands) {
    const row = countMap.get(String(brand._id));
    const total = row ? row.total : 0;
    const active = row ? row.active : 0;

    if (brand.productCount !== total || brand.activeProductCount !== active) {
      fixed++;
      if (DRY_RUN) {
        const changed = (brand.productCount || 0) !== total;
        if (changed) console.log(`  ${brand.name} (${brand.slug}): ${brand.productCount || 0} → ${total}`);
      } else {
        await Brand.updateOne(
          { _id: brand._id },
          { $set: { productCount: total, activeProductCount: active } }
        );
      }
    }
  }

  const zeroWithProducts = Array.from(countMap.values()).filter(t => t.total > 0).length;
  console.log('\nSummary:', JSON.stringify({
    brandsScanned: allBrands.length,
    brandsWithProducts: zeroWithProducts,
    changes: fixed,
    dryRun: DRY_RUN,
  }, null, 2));
  if (DRY_RUN) {
    console.log(
      `\n${allBrands.length} brands scanned — ${zeroWithProducts} now have products; ` +
        `${fixed} would be updated. Re-run without --dry to apply.`
    );
  }

  await mongoose.disconnect();
  console.log(DRY_RUN ? 'Dry run complete (no writes).' : 'Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
