// server/scripts/backfillSizeSellingPrice.js
//
// One-off repair for Size docs whose `sellingPrice` was persisted as 0 by the
// legacy size writers (they fell back to `|| 0` whenever the form sent no
// explicit per-size price). For every Size with sellingPrice <= 0 we derive a
// sensible price from its parent SubProduct, in this priority order:
//   1. parentSubProduct.baseSellingPrice
//   2. parentSubProduct.costPrice * (1 + parentSubProduct.markupPercentage / 100)
//   3. parentSubProduct.costPrice (break-even fallback)
// Sizes whose parent also has no usable price are skipped (reported) so an
// operator can fix them manually — we never invent a number from nothing.
//
// Idempotent: only touches Size docs where sellingPrice <= 0, so re-running is
// safe. Run once after deploying the subproduct.service.js size-writer fix.
//
// Usage:
//   cd server && node scripts/backfillSizeSellingPrice.js
require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/db');
const Size = require('../models/Size');
const SubProduct = require('../models/SubProduct');

async function backfill() {
  // Pull only the broken rows + their parent link. We can't use a single
  // updateMany with an aggregation pipeline across two collections portably,
  // so we group by parent and issue one update per parent.
  const broken = await Size.find({ sellingPrice: { $lte: 0 } })
    .select('_id subproduct')
    .lean();

  if (broken.length === 0) {
    console.log('backfillSizeSellingPrice: nothing to do (all Size.sellingPrice > 0).');
    return;
  }
  console.log(`backfillSizeSellingPrice: found ${broken.length} Size doc(s) with sellingPrice <= 0.`);

  // Group size ids by parent subproduct id.
  const byParent = new Map();
  for (const s of broken) {
    const pid = String(s.subproduct);
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(s._id);
  }

  const parents = await SubProduct.find({ _id: { $in: Array.from(byParent.keys()) } })
    .select('baseSellingPrice costPrice markupPercentage')
    .lean();
  const parentById = new Map(parents.map((p) => [String(p._id), p]));

  let repaired = 0;
  let skipped = 0;
  const skippedParents = [];

  for (const [pid, sizeIds] of byParent.entries()) {
    const parent = parentById.get(pid);
    let price = 0;
    if (parent) {
      if (parent.baseSellingPrice && parent.baseSellingPrice > 0) {
        price = parent.baseSellingPrice;
      } else if (parent.costPrice && parent.costPrice > 0) {
        const markup = parent.markupPercentage || 0;
        price = parent.costPrice * (1 + markup / 100);
      }
    }
    if (!price || price <= 0) {
      skipped += sizeIds.length;
      skippedParents.push(pid);
      continue;
    }
    const res = await Size.updateMany(
      { _id: { $in: sizeIds }, sellingPrice: { $lte: 0 } },
      { $set: { sellingPrice: price } }
    );
    repaired += res.modifiedCount || 0;
  }

  console.log(`  repaired: ${repaired}`);
  console.log(`  skipped (no usable parent price): ${skipped}`);
  if (skippedParents.length) {
    console.log(
      `  skipped parent SubProduct ids: ${skippedParents.join(', ')}\n` +
        '  → set a baseSellingPrice or costPrice on those SubProducts and re-run.'
    );
  }
}

(async () => {
  await connectDB();
  await backfill();
  await disconnectDB();
})().catch((e) => {
  console.error('backfillSizeSellingPrice failed:', e);
  process.exit(1);
});