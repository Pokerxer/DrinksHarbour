/**
 * Backfill Product.brand refs by matching product names against Brand names.
 *
 * The bulk import created products without brand references, so the shop's
 * brand filter (and brand heroes) only ever saw the handful of manually
 * linked products. This links products to existing Brand docs by
 * longest-name-first, word-boundary match — deterministic, no AI.
 *
 * Usage: node scripts/backfill-product-brands.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Brand = require('../models/Brand');

const DRY_RUN = process.argv.includes('--dry-run');

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const brands = await Brand.find({}).select('name tradingAs').lean();
  // Build matchers: brand name + trading names, longest first so
  // "The Glenlivet" wins over "Glenlivet", "Imperial Blue" over "Imperial".
  const matchers = brands
    .flatMap((b) =>
      [b.name, ...(Array.isArray(b.tradingAs) ? b.tradingAs : [])]
        .filter((n) => n && n.trim().length >= 3 && n !== 'Test Brand')
        .map((n) => ({ id: b._id, brandName: b.name, re: new RegExp(`\\b${escapeRe(n.trim())}\\b`, 'i'), len: n.trim().length }))
    )
    .sort((a, z) => z.len - a.len);

  const products = await Product.find({ brand: null }).select('name').lean();
  console.log(`Products without brand: ${products.length} | brand matchers: ${matchers.length}`);

  let linked = 0;
  const perBrand = new Map();
  for (const p of products) {
    const hit = matchers.find((m) => m.re.test(p.name));
    if (!hit) continue;
    linked++;
    perBrand.set(hit.brandName, (perBrand.get(hit.brandName) || 0) + 1);
    if (!DRY_RUN) {
      await Product.updateOne({ _id: p._id }, { $set: { brand: hit.id } });
    }
  }

  console.log(`${DRY_RUN ? '[dry-run] Would link' : 'Linked'} ${linked}/${products.length} products across ${perBrand.size} brands`);
  for (const [name, n] of [...perBrand.entries()].sort((a, z) => z[1] - a[1]).slice(0, 15)) {
    console.log(`  ${name}: ${n}`);
  }

  if (!DRY_RUN) {
    // Refresh Brand.productCount to match reality.
    const counts = await Product.aggregate([
      { $match: { brand: { $ne: null } } },
      { $group: { _id: '$brand', n: { $sum: 1 } } },
    ]);
    for (const c of counts) {
      await Brand.updateOne({ _id: c._id }, { $set: { productCount: c.n } });
    }
    console.log(`Refreshed productCount on ${counts.length} brands`);
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error('FAIL:', e); process.exit(1); });
