// scripts/verifyProductionMigration.js
//
// Post-migration verification, and the one write production still needs:
// recomputing the denormalised Product.averageRating / reviewCount from the
// reviews that now live there.
//
// Why the aggregate is run by hand rather than through Product.updateRating():
// that method calls Review.aggregate() on the DEFAULT mongoose connection, but
// these scripts open their own via createConnection(). The model is unregistered
// on the default connection, so the call buffers until it times out
// ("buffering timed out after 10000ms"). The aggregate is therefore issued on
// this script's connection, applying the same one-decimal rounding as
// services/review.helpers.computeRatingAggregate().
//
// Usage:
//   node -r dotenv/config scripts/verifyProductionMigration.js
//   node -r dotenv/config scripts/verifyProductionMigration.js --recompute-ratings

'use strict';

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const flagsLib = require('./lib/flags');

const SEED_ADMIN_ID = '6a9b17cc52ac39a73d004774';
const SEED_MARKER = 'seed-script';

function resolveProdUri(args) {
  const flag = flagsLib.get(args, 'prod-uri');
  if (flag) return String(flag);
  if (process.env.PROD_MONGODB_URI) return process.env.PROD_MONGODB_URI;
  const backup = path.resolve(__dirname, '..', '.env.backup-preseed');
  if (fs.existsSync(backup)) {
    const line = fs.readFileSync(backup, 'utf8')
      .split('\n').find((l) => l.startsWith('MONGODB_URI'));
    if (line) return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('Cannot resolve the production URI');
}

const results = [];
function check(label, pass, detail = '') {
  results.push({ label, pass });
  console.log(`   ${pass ? '✓' : '✗'} ${label.padEnd(50)} ${detail}`);
}

async function main() {
  const args = flagsLib.parseArgv(process.argv.slice(2));
  const recompute = flagsLib.bool(flagsLib.get(args, 'recompute-ratings'));
  const conn = await mongoose.createConnection(resolveProdUri(args)).asPromise();
  const P = conn.db;

  console.log(`▶ Verifying migration in "${P.databaseName}"`);
  console.log('');

  const adminId = new mongoose.Types.ObjectId(SEED_ADMIN_ID);
  const seededUsers = await P.collection('users')
    .countDocuments({ role: 'customer', createdBy: adminId });
  const seededOrders = await P.collection('orders').countDocuments({ seedSource: SEED_MARKER });
  const seededReviews = await P.collection('reviews').countDocuments({ seedSource: SEED_MARKER });

  console.log('   counts');
  check('seeded users present', seededUsers === 400, `${seededUsers}/400`);
  check('seeded orders present', seededOrders === 433, `${seededOrders}/433`);
  check('seeded reviews present', seededReviews === 241, `${seededReviews}/241`);
  check('total users', (await P.collection('users').countDocuments()) === 533, '533');
  check('total orders', (await P.collection('orders').countDocuments()) === 453, '453');
  check('total reviews', (await P.collection('reviews').countDocuments()) === 244, '244');

  // ── Integrity ─────────────────────────────────────────────────────────────
  console.log('');
  console.log('   integrity');
  // Scope the integrity checks to MIGRATED rows. Production legitimately holds
  // POS walk-in orders with no `user` (source:'pos'), and a pre-existing review
  // pointing at a since-deleted product — neither is this migration's doing, and
  // failing on them would hide a real regression in the noise.
  const orders = await P.collection('orders').find({})
    .project({ user: 1, orderNumber: 1, seedSource: 1, source: 1 }).toArray();
  const userIds = new Set((await P.collection('users').distinct('_id')).map(String));
  const migratedOrders = orders.filter((o) => o.seedSource === SEED_MARKER);
  const orphanOrders = migratedOrders.filter((o) => !o.user || !userIds.has(String(o.user)));
  check('no migrated order references a missing user', orphanOrders.length === 0,
    orphanOrders.length ? `${orphanOrders.length}` : `${migratedOrders.length} checked`);

  const reviews = await P.collection('reviews').find({})
    .project({ user: 1, product: 1, seedSource: 1 }).toArray();
  const migratedReviews = reviews.filter((r) => r.seedSource === SEED_MARKER);
  const orphanReviews = migratedReviews.filter((r) => !r.user || !userIds.has(String(r.user)));
  check('no migrated review references a missing user', orphanReviews.length === 0,
    orphanReviews.length ? `${orphanReviews.length}` : `${migratedReviews.length} checked`);

  const prodIds = new Set((await P.collection('products').distinct('_id')).map(String));
  const orphanRevProd = migratedReviews.filter((r) => !prodIds.has(String(r.product)));
  check('no migrated review references a missing product', orphanRevProd.length === 0,
    orphanRevProd.length ? `${orphanRevProd.length}` : `${migratedReviews.length} checked`);

  // Report pre-existing issues without failing the run — they are production's
  // to triage, but silence would be worse than a note.
  const preExistingOrphanOrders = orders
    .filter((o) => o.seedSource !== SEED_MARKER && (!o.user || !userIds.has(String(o.user))));
  const preExistingOrphanReviews = reviews
    .filter((r) => r.seedSource !== SEED_MARKER && !prodIds.has(String(r.product)));
  if (preExistingOrphanOrders.length || preExistingOrphanReviews.length) {
    const posCount = preExistingOrphanOrders.filter((o) => o.source === 'pos').length;
    console.log(`     ℹ pre-existing (not from this migration): ` +
      `${preExistingOrphanOrders.length} order(s) without a user ` +
      `(${posCount} are POS walk-ins), ` +
      `${preExistingOrphanReviews.length} review(s) on a deleted product`);
  }

  const nums = orders.map((o) => o.orderNumber);
  check('orderNumbers unique', nums.length === new Set(nums).size,
    `${nums.length} orders`);

  // ── Order-number counter ──────────────────────────────────────────────────
  console.log('');
  console.log('   order-number counter');
  const now = new Date();
  const todayPrefix = 'DH' + String(now.getFullYear()).slice(-2)
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0');
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const todayCount = await P.collection('orders')
    .countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } });
  const next = `${todayPrefix}${String(todayCount + 1).padStart(4, '0')}`;
  const taken = await P.collection('orders').countDocuments({ orderNumber: next });
  check(`next number ${next} is free`, taken === 0, taken ? 'BLOCKED' : '');

  // ── Ratings ───────────────────────────────────────────────────────────────
  console.log('');
  console.log('   ratings');
  const stats = await P.collection('reviews').aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]).toArray();
  const allApproved = await P.collection('reviews').find({ status: 'approved' })
    .project({ rating: 1 }).toArray();
  const mean = allApproved.reduce((s, r) => s + r.rating, 0) / (allApproved.length || 1);
  console.log(`     approved reviews: ${allApproved.length}, mean ${mean.toFixed(4)}`);

  if (recompute) {
    let written = 0;
    for (const row of stats) {
      const res = await P.collection('products').updateOne(
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
    const reset = await P.collection('products').updateMany(
      { reviewCount: { $gt: 0 }, _id: { $nin: stats.map((s) => s._id) } },
      { $set: { averageRating: 0, reviewCount: 0 } },
    );
    console.log(`     ✓ aggregates written ${written}, stale reset ${reset.modifiedCount}`);
  }

  const live = new Map(stats.map((s) => [String(s._id), s]));
  const rated = await P.collection('products')
    .find({ $or: [{ reviewCount: { $gt: 0 } }, { averageRating: { $gt: 0 } }] })
    .project({ averageRating: 1, reviewCount: 1 }).toArray();
  let stale = 0;
  for (const p of rated) {
    const l = live.get(String(p._id));
    const ea = l ? Math.round(l.avg * 10) / 10 : 0;
    const ec = l ? l.count : 0;
    if (ea !== p.averageRating || ec !== p.reviewCount) stale += 1;
  }
  check('product aggregates match reviews', stale === 0,
    `${rated.length} rated, ${stale} stale`);

  // ── Safety ────────────────────────────────────────────────────────────────
  console.log('');
  console.log('   safety');
  const mailOff = (
    String(process.env.OUTBOUND_EMAIL || '').toLowerCase() === 'off' ||
    ['true', '1', 'yes'].includes(String(process.env.DISABLE_OUTBOUND_EMAIL || '').toLowerCase())
  );
  check('outbound email disabled', mailOff);
  const adminInProd = await P.collection('users')
    .countDocuments({ email: 'seed-admin@drinksharbour.test' });
  check('seed admin NOT in production', adminInProd === 0, adminInProd ? 'PRESENT' : '');
  const inflated = await P.collection('sizes').countDocuments({ seedStockFit: true });
  check('inflated stock NOT in production', inflated === 0, inflated ? `${inflated} sizes` : '');

  const failed = results.filter((r) => !r.pass);
  console.log('');
  console.log('─'.repeat(70));
  console.log(`   ${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) for (const f of failed) console.log(`     ✗ ${f.label}`);

  await conn.close();
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('💥', err.message);
  process.exit(1);
});
