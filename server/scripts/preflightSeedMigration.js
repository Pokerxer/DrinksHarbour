// scripts/preflightSeedMigration.js
//
// Read-only gate for the seed → production migration. Asserts every property
// the migration depends on and exits non-zero if any of them fail, so the
// migration script can refuse to start on a dataset that has drifted.
//
// Checks, in order:
//   1. both databases reachable, and they are NOT the same database
//   2. the three selectors return the expected shape
//   3. selectors are mutually closed — no order/review points outside the set
//   4. no _id, email or orderNumber collides with production
//   5. every catalog reference an order carries resolves in PRODUCTION
//      (products/subproducts/sizes/tenants are NOT migrated, so a seeded order
//      pointing at a catalog row that only exists in the seed DB would arrive
//      broken)
//   6. no order carries a null user, and no review is orphaned
//   7. no seeded orderNumber can block production's daily counter
//      (generateOrderNumber counts today's orders; a seeded number occupying
//      today's sequence permanently breaks checkout — see renumberSeedOrders.js)
//
// Usage:
//   node -r dotenv/config scripts/preflightSeedMigration.js
//   node -r dotenv/config scripts/preflightSeedMigration.js --prod-uri "mongodb+srv://..."

'use strict';

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const flagsLib = require('./lib/flags');

const SEED_ADMIN_EMAIL = 'seed-admin@drinksharbour.test';
const SEED_MARKER = 'seed-script';

/** Read the production URI from --prod-uri, env, or .env.backup-preseed. */
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
  throw new Error('Cannot resolve the production URI — pass --prod-uri or set PROD_MONGODB_URI');
}

const results = [];
function check(label, pass, detail = '') {
  results.push({ label, pass, detail });
  console.log(`   ${pass ? '✓' : '✗'} ${label.padEnd(52)} ${detail}`);
  return pass;
}

async function main() {
  const args = flagsLib.parseArgv(process.argv.slice(2));
  const seedUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!seedUri) throw new Error('MONGODB_URI is not set (expected the seed database)');
  const prodUri = resolveProdUri(args);

  const seedConn = await mongoose.createConnection(seedUri).asPromise();
  const prodConn = await mongoose.createConnection(prodUri).asPromise();
  const S = seedConn.db;
  const P = prodConn.db;

  console.log('▶ Pre-flight — seed → production migration');
  console.log(`   seed : ${S.databaseName}`);
  console.log(`   prod : ${P.databaseName}`);
  console.log('');

  check('seed database name ends in _seed', /_seed$/.test(S.databaseName), S.databaseName);
  check('seed and prod are different databases', S.databaseName !== P.databaseName);

  // ── Selectors ─────────────────────────────────────────────────────────────
  const admin = await S.collection('users').findOne({ email: SEED_ADMIN_EMAIL });
  if (!admin) throw new Error(`seed admin ${SEED_ADMIN_EMAIL} not found`);
  const adminId = admin._id;

  const customers = await S.collection('users')
    .find({ role: 'customer', createdBy: adminId }).toArray();
  const orders = await S.collection('orders')
    .find({ seedSource: SEED_MARKER }).toArray();
  const reviews = await S.collection('reviews')
    .find({ seedSource: SEED_MARKER }).toArray();

  console.log('');
  console.log('   selection');
  check('customers selected', customers.length > 0, `${customers.length}`);
  check('orders selected', orders.length > 0, `${orders.length}`);
  check('reviews selected', reviews.length > 0, `${reviews.length}`);

  // ── Closure ───────────────────────────────────────────────────────────────
  console.log('');
  console.log('   referential closure');
  const custIds = new Set(customers.map((c) => String(c._id)));
  const orderIds = new Set(orders.map((o) => String(o._id)));

  const nullUserOrders = orders.filter((o) => !o.user);
  check('no order has a null user', nullUserOrders.length === 0,
    nullUserOrders.length ? nullUserOrders.map((o) => o.orderNumber).join(', ') : '');

  const strayOrders = orders.filter((o) => o.user && !custIds.has(String(o.user)));
  check('every order.user is in the customer set', strayOrders.length === 0,
    strayOrders.length ? `${strayOrders.length} stray` : '');

  const strayReviewUsers = reviews.filter((r) => !r.user || !custIds.has(String(r.user)));
  check('every review.user is in the customer set', strayReviewUsers.length === 0,
    strayReviewUsers.length ? `${strayReviewUsers.length} stray` : '');

  const strayReviewOrders = reviews.filter((r) => r.order && !orderIds.has(String(r.order)));
  check('every review.order is in the order set', strayReviewOrders.length === 0,
    strayReviewOrders.length ? `${strayReviewOrders.length} stray` : '');

  const noProduct = reviews.filter((r) => !r.product);
  check('every review has a product', noProduct.length === 0);

  // ── Collisions with production ────────────────────────────────────────────
  console.log('');
  console.log('   collisions with production');

  const custIdArr = customers.map((c) => c._id);
  const idClash = await P.collection('users').countDocuments({ _id: { $in: custIdArr } });
  check('no customer _id exists in prod', idClash === 0, idClash ? `${idClash}` : '');

  const emails = customers.map((c) => c.email);
  const emailClash = await P.collection('users')
    .find({ email: { $in: emails } }).project({ email: 1 }).toArray();
  check('no customer email exists in prod', emailClash.length === 0,
    emailClash.length ? emailClash.slice(0, 3).map((e) => e.email).join(', ') : '');

  const orderIdArr = orders.map((o) => o._id);
  const oidClash = await P.collection('orders').countDocuments({ _id: { $in: orderIdArr } });
  check('no order _id exists in prod', oidClash === 0, oidClash ? `${oidClash}` : '');

  const numbers = orders.map((o) => o.orderNumber);
  const numClash = await P.collection('orders')
    .find({ orderNumber: { $in: numbers } }).project({ orderNumber: 1 }).toArray();
  check('no orderNumber exists in prod', numClash.length === 0,
    numClash.length ? `${numClash.length} e.g. ${numClash[0].orderNumber}` : '');

  const revIdArr = reviews.map((r) => r._id);
  const ridClash = await P.collection('reviews').countDocuments({ _id: { $in: revIdArr } });
  check('no review _id exists in prod', ridClash === 0, ridClash ? `${ridClash}` : '');

  const dupNumbers = numbers.length - new Set(numbers).size;
  check('orderNumbers unique within the seed set', dupNumbers === 0,
    dupNumbers ? `${dupNumbers} duplicates` : '');

  // ── Catalog references must resolve in PRODUCTION ─────────────────────────
  console.log('');
  console.log('   catalog references resolve in prod');
  const refs = { products: new Set(), subproducts: new Set(), sizes: new Set(), tenants: new Set() };
  for (const o of orders) {
    for (const it of o.items || []) {
      if (it.product) refs.products.add(String(it.product));
      if (it.subproduct) refs.subproducts.add(String(it.subproduct));
      if (it.size) refs.sizes.add(String(it.size));
      if (it.tenant) refs.tenants.add(String(it.tenant));
    }
  }
  for (const [col, set] of Object.entries(refs)) {
    const ids = [...set].map((x) => new mongoose.Types.ObjectId(x));
    const found = await P.collection(col).countDocuments({ _id: { $in: ids } });
    check(`${col} referenced by orders exist in prod`, found === set.size,
      `${found}/${set.size}`);
  }
  const revProdIds = [...new Set(reviews.map((r) => String(r.product)))]
    .map((x) => new mongoose.Types.ObjectId(x));
  const revProdFound = await P.collection('products').countDocuments({ _id: { $in: revProdIds } });
  check('products referenced by reviews exist in prod',
    revProdFound === revProdIds.length, `${revProdFound}/${revProdIds.length}`);

  // ── Order-number counter safety ───────────────────────────────────────────
  //
  // generateOrderNumber() = DH<yymmdd> + (count of orders created TODAY + 1).
  // Seeded orders are backdated, so they do not raise that count. Any seeded
  // number sitting on today's date therefore blocks the very sequence the next
  // real order will mint, and orderNumber is uniquely indexed — checkout fails
  // and, because failed inserts never persist, it never recovers.
  console.log('');
  console.log('   order-number counter safety');
  const now = new Date();
  const todayPrefix = 'DH' + String(now.getFullYear()).slice(-2)
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0');
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const prodToday = await P.collection('orders')
    .countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } });
  const nextNumber = `${todayPrefix}${String(prodToday + 1).padStart(4, '0')}`;
  const blocked = numbers.includes(nextNumber);
  check(`next prod number ${nextNumber} is free`, !blocked,
    blocked ? 'BLOCKED — run renumberSeedOrders.js' : '');

  const onToday = numbers.filter((n) => n.startsWith(todayPrefix)).length;
  check(`no seeded number uses today's prefix ${todayPrefix}`, onToday === 0,
    onToday ? `${onToday} do — run renumberSeedOrders.js` : '');

  // Per-day: a seeded number must never equal one production already holds.
  const prodNums = await P.collection('orders').distinct('orderNumber');
  const prodSet = new Set(prodNums);
  const perDayClash = numbers.filter((n) => prodSet.has(n)).length;
  check('no seeded number duplicates a prod number', perDayClash === 0,
    perDayClash ? `${perDayClash}` : '');

  // ── Outbound mail ─────────────────────────────────────────────────────────
  console.log('');
  console.log('   safety');
  const mailOff = (
    String(process.env.OUTBOUND_EMAIL || '').toLowerCase() === 'off' ||
    ['true', '1', 'yes'].includes(String(process.env.DISABLE_OUTBOUND_EMAIL || '').toLowerCase())
  );
  check('outbound email is disabled', mailOff,
    mailOff ? 'OUTBOUND_EMAIL=off' : 'SET OUTBOUND_EMAIL=off BEFORE MIGRATING');

  const seedAdminMigrating = customers.some((c) => c.email === SEED_ADMIN_EMAIL);
  check('seed admin is NOT in the migration set', !seedAdminMigrating);

  // ── Summary ───────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.pass);
  console.log('');
  console.log('─'.repeat(72));
  console.log(`   ${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('');
    console.log('   FAILED:');
    for (const f of failed) console.log(`     ✗ ${f.label} ${f.detail}`);
  }
  console.log('');
  console.log('   migration would move:');
  console.log(`     users   ${String(customers.length).padStart(5)}`);
  console.log(`     orders  ${String(orders.length).padStart(5)}`);
  console.log(`     reviews ${String(reviews.length).padStart(5)}`);

  await seedConn.close();
  await prodConn.close();
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('💥', err.message);
  process.exit(1);
});
