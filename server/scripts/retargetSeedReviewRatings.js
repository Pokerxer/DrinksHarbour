// scripts/retargetSeedReviewRatings.js
//
// Re-point the seeded review ratings at a target average (default 4.7) and
// rewrite each review's copy so the words still match its new score.
//
// Why the copy has to move with the number: review-templates.js picks from a
// sentiment tier chosen by rating (5→high, 4→mid, 1-3→low). Changing a 4 to a
// 5 without re-picking would leave "Good, not outstanding" under five stars —
// exactly the mismatch the copy bank was rebuilt to eliminate.
//
// Distribution is solved, not guessed: given N reviews and a target mean, it
// finds a 3/4/5 split that lands on the target while keeping a small negative
// tail, so the book does not read as uniformly perfect.
//
// Assignment is deterministic-ish but shuffled, so the 3★ reviews do not all
// land on the same product. Products with a single review are kept off the
// 3★ list where possible — one bad review shouldn't define a product whose
// only other signal is absent.
//
// After rewriting it refreshes the denormalised Product.averageRating /
// reviewCount through the model's own updateRating(), which is also the fix
// for any drift already in the data.
//
// Safety: refuses any database whose name does not end in `_seed`.
//
// Usage:
//   node -r dotenv/config scripts/retargetSeedReviewRatings.js --dry-run
//   node -r dotenv/config scripts/retargetSeedReviewRatings.js --target 4.7

'use strict';

const mongoose = require('mongoose');
const { pickReview } = require('./data/review-templates');
const flagsLib = require('./lib/flags');
const { SEED_MARKER } = require('./lib/backdate');

/**
 * Choose how many 3/4/5-star reviews land on the target mean.
 *
 * A real 4.7-average catalogue still carries a few middling reviews; a book of
 * nothing but 4s and 5s reads as manufactured. So rather than taking the first
 * exact solution (which is n3=0), aim for a ~2% three-star tail and, among the
 * splits that hit the target equally well, keep the one closest to that shape.
 */
function solveDistribution(total, target, tailShare = 0.02) {
  const preferredN3 = Math.max(1, Math.round(total * tailShare));
  let best = null;
  for (let n3 = 0; n3 <= Math.round(total * 0.05); n3 += 1) {
    const remaining = total - n3;
    const n5 = Math.round(target * total - 3 * n3 - 4 * remaining);
    const n4 = remaining - n5;
    if (n4 < 0 || n5 < 0) continue;
    const mean = (3 * n3 + 4 * n4 + 5 * n5) / total;
    const err = Math.abs(mean - target);
    const tailMiss = Math.abs(n3 - preferredN3);
    // Mean accuracy first, then closeness to the desired tail.
    if (!best || err < best.err - 1e-9 ||
        (Math.abs(err - best.err) <= 1e-9 && tailMiss < best.tailMiss)) {
      best = { n3, n4, n5, mean, err, tailMiss };
    }
  }
  if (!best) throw new Error(`cannot hit target ${target} with ${total} reviews`);
  return best;
}

/**
 * Recompute Product.averageRating / reviewCount from approved reviews.
 *
 * Product.updateRating() is not reused here: it calls Review.aggregate() on the
 * default mongoose connection, but this script runs on its own createConnection,
 * so the model is unregistered there and the call buffers until it times out.
 * The aggregate is run directly on this connection instead, applying the same
 * one-decimal rounding as services/review.helpers.computeRatingAggregate().
 *
 * Also repairs pre-existing drift: any product holding a non-zero reviewCount
 * with no approved reviews is reset to zero.
 */
async function refreshProductAggregates(conn, reviews, products) {
  const stats = await reviews.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]).toArray();

  let written = 0;
  const live = new Set();
  for (const row of stats) {
    live.add(String(row._id));
    const res = await products.updateOne(
      { _id: row._id },
      {
        $set: {
          averageRating: Math.round((row.avg || 0) * 10) / 10,
          reviewCount: row.count,
        },
      },
    );
    written += res.modifiedCount;
  }

  const reset = await products.updateMany(
    { reviewCount: { $gt: 0 }, _id: { $nin: stats.map((s) => s._id) } },
    { $set: { averageRating: 0, reviewCount: 0 } },
  );

  console.log(`   ✓ product aggregates written : ${written} (of ${stats.length} with reviews)`);
  console.log(`   ✓ stale aggregates reset     : ${reset.modifiedCount}`);
}

async function main() {
  const args = flagsLib.parseArgv(process.argv.slice(2));
  const dryRun = flagsLib.bool(flagsLib.get(args, 'dry-run'));
  const target = Number(flagsLib.get(args, 'target') ?? 4.7);
  if (!(target > 1 && target <= 5)) throw new Error('--target must be in (1, 5]');

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  const conn = await mongoose.createConnection(uri).asPromise();
  const dbName = conn.db.databaseName;
  if (!/_seed$/.test(dbName)) {
    console.error(`✋ Refusing to modify "${dbName}" — name must end in "_seed".`);
    await conn.close();
    process.exit(1);
  }

  const reviews = conn.db.collection('reviews');
  const products = conn.db.collection('products');

  const all = await reviews.find({ seedSource: SEED_MARKER }).toArray();
  if (all.length === 0) {
    console.log('No seeded reviews found. Nothing to do.');
    await conn.close();
    return;
  }

  const before = all.reduce((s, r) => s + r.rating, 0) / all.length;
  const plan = solveDistribution(all.length, target);

  console.log(`▶ Retargeting review ratings in "${dbName}"`);
  console.log(`   reviews : ${all.length}`);
  console.log(`   average : ${before.toFixed(3)} → target ${target.toFixed(2)}`);
  console.log(`   plan    : 3★ ${plan.n3} · 4★ ${plan.n4} · 5★ ${plan.n5}  (mean ${plan.mean.toFixed(4)})`);
  console.log(`   dry run : ${dryRun ? 'yes' : 'no'}`);
  console.log('');

  // Product type/subType drives the copy family, so fetch it alongside.
  const productIds = [...new Set(all.map((r) => String(r.product)))]
    .map((id) => new mongoose.Types.ObjectId(id));
  const prodDocs = await products
    .find({ _id: { $in: productIds } })
    .project({ type: 1, subType: 1 })
    .toArray();
  const prodMap = new Map(prodDocs.map((p) => [String(p._id), p]));

  // Reviews per product — used to keep 3★ off single-review products.
  const perProduct = new Map();
  for (const r of all) {
    const k = String(r.product);
    perProduct.set(k, (perProduct.get(k) || 0) + 1);
  }

  // 3★ placement: eligible reviews are those on a product with more than one
  // review, so a single middling score never becomes a product's whole story.
  // Sorting by review count alone would stack every 3★ onto the single busiest
  // product, so candidates are shuffled and then taken one-per-product.
  const assignment = new Map();
  const shuffled = [...all].sort(() => Math.random() - 0.5);

  const eligible = shuffled.filter((r) => (perProduct.get(String(r.product)) || 0) > 1);
  const usedProducts = new Set();
  const threeStars = [];
  for (const r of eligible) {
    if (threeStars.length >= plan.n3) break;
    const key = String(r.product);
    if (usedProducts.has(key)) continue;      // at most one 3★ per product
    usedProducts.add(key);
    threeStars.push(r);
  }
  // If there were not enough distinct multi-review products, allow a second
  // 3★ on a product rather than silently missing the target mean.
  for (const r of eligible) {
    if (threeStars.length >= plan.n3) break;
    if (!threeStars.includes(r)) threeStars.push(r);
  }
  for (const r of threeStars) assignment.set(String(r._id), 3);

  // Remainder splits into 4★/5★ in shuffled order.
  const rest = shuffled.filter((r) => !assignment.has(String(r._id)));
  rest.forEach((r, idx) => assignment.set(String(r._id), idx < plan.n4 ? 4 : 5));

  const seenTitles = new Set();
  const seenComments = new Set();
  let updated = 0;

  for (const rv of all) {
    const rating = assignment.get(String(rv._id));
    const prod = prodMap.get(String(rv.product));
    // Re-pick copy at the new rating so tier and score agree.
    const picked = pickReview({ type: prod?.type, subType: prod?.subType, rating });
    seenTitles.add(picked.title);
    seenComments.add(picked.comment);

    if (!dryRun) {
      await reviews.updateOne(
        { _id: rv._id },
        { $set: { rating, title: picked.title, comment: picked.comment } },
      );
    }
    updated += 1;
  }

  const dist = { 3: plan.n3, 4: plan.n4, 5: plan.n5 };
  console.log(`   ✓ ${updated} review(s) ${dryRun ? 'would be ' : ''}retargeted`);
  console.log(`   distribution      : ${JSON.stringify(dist)}`);
  console.log(`   distinct titles   : ${seenTitles.size}`);
  console.log(`   distinct comments : ${seenComments.size}`);

  if (!dryRun) {
    await refreshProductAggregates(conn, reviews, products);
  }

  await conn.close();
}

main().catch((err) => {
  console.error('💥', err.message);
  process.exit(1);
});