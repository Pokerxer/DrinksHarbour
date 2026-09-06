// scripts/migrateSeedToProduction.js
//
// The ONLY script in this set that writes to production.
//
// Copies three selections from the seed database into production:
//   users    role:'customer', createdBy:<seedAdminId>
//   orders   seedSource:'seed-script'
//   reviews  seedSource:'seed-script'
//
// Deliberately NOT copied, and why:
//   sizes / subproducts   stock was inflated 3,025 → 25,956 units so the seeded
//                         order values could match the Cloud Bay report. Those
//                         numbers are fiction; copying them would oversell real
//                         customers.
//   inventorymovements    4,663 rows carrying no seedSource marker — once merged
//   auditlogs             807   they cannot be told apart from real ledger and
//   notifications         575   audit history, so they could never be removed.
//   refreshtokens         55    session material, worthless and risky to move.
//   seed admin            a super_admin with a known password.
//
// Both databases live on the same cluster, so documents are copied in-process
// rather than through BSON files — no dump/restore, no type-fidelity risk.
//
// Writes are INSERT-ONLY (ordered:false, no upsert, no drop). Any duplicate key
// is a bug in the pre-flight assumptions, so the run aborts and reports rather
// than overwriting anything that already exists in production.
//
// Usage:
//   node -r dotenv/config scripts/migrateSeedToProduction.js --dry-run
//   node -r dotenv/config scripts/migrateSeedToProduction.js --i-understand-this-writes-to-production

'use strict';

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const flagsLib = require('./lib/flags');

const SEED_ADMIN_EMAIL = 'seed-admin@drinksharbour.test';
const SEED_MARKER = 'seed-script';
const BATCH = 200;

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

/** Insert in batches, surfacing duplicate-key failures instead of hiding them. */
async function insertAll(collection, docs, label) {
  let inserted = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const slice = docs.slice(i, i + BATCH);
    try {
      const res = await collection.insertMany(slice, { ordered: false });
      inserted += res.insertedCount;
    } catch (err) {
      const dupes = (err.writeErrors || []).filter((e) => e.code === 11000);
      inserted += err.result?.nInserted || 0;
      if (dupes.length) {
        throw new Error(
          `${label}: ${dupes.length} duplicate key error(s) — production already ` +
          `holds some of these documents. First: ${dupes[0].errmsg}`,
        );
      }
      throw err;
    }
    process.stdout.write(`\r   ${label}: ${inserted}/${docs.length}`);
  }
  process.stdout.write('\n');
  return inserted;
}

async function main() {
  const args = flagsLib.parseArgv(process.argv.slice(2));
  const dryRun = flagsLib.bool(flagsLib.get(args, 'dry-run'));
  const confirmed = flagsLib.bool(flagsLib.get(args, 'i-understand-this-writes-to-production'));

  if (!dryRun && !confirmed) {
    console.error('✋ This writes to PRODUCTION.');
    console.error('   Re-run with --dry-run first, then');
    console.error('   --i-understand-this-writes-to-production to proceed.');
    process.exit(1);
  }

  // Outbound mail must be off: these customers carry real gmail/yahoo addresses
  // and order.controller.js mails a confirmation per order.
  const mailOff = (
    String(process.env.OUTBOUND_EMAIL || '').toLowerCase() === 'off' ||
    ['true', '1', 'yes'].includes(String(process.env.DISABLE_OUTBOUND_EMAIL || '').toLowerCase())
  );
  if (!mailOff) {
    console.error('✋ OUTBOUND_EMAIL is not off. Refusing to migrate consumer addresses.');
    process.exit(1);
  }

  const seedUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!seedUri) throw new Error('MONGODB_URI is not set');
  const prodUri = resolveProdUri(args);

  const seedConn = await mongoose.createConnection(seedUri).asPromise();
  const prodConn = await mongoose.createConnection(prodUri).asPromise();
  const S = seedConn.db;
  const P = prodConn.db;

  if (!/_seed$/.test(S.databaseName)) {
    throw new Error(`source "${S.databaseName}" is not a _seed database`);
  }
  if (S.databaseName === P.databaseName) {
    throw new Error('source and target are the same database');
  }

  console.log('▶ Migrating seed → production');
  console.log(`   from    : ${S.databaseName}`);
  console.log(`   to      : ${P.databaseName}   ← PRODUCTION`);
  console.log(`   dry run : ${dryRun ? 'yes' : 'NO — THIS WILL WRITE'}`);
  console.log('');

  const admin = await S.collection('users').findOne({ email: SEED_ADMIN_EMAIL });
  if (!admin) throw new Error('seed admin not found');

  const users = await S.collection('users')
    .find({ role: 'customer', createdBy: admin._id }).toArray();
  const orders = await S.collection('orders').find({ seedSource: SEED_MARKER }).toArray();
  const reviews = await S.collection('reviews').find({ seedSource: SEED_MARKER }).toArray();

  // Last-line assertions — pre-flight ran earlier, but the data may have moved.
  const strayOrder = orders.find((o) => !o.user);
  if (strayOrder) throw new Error(`order ${strayOrder.orderNumber} has a null user`);
  const custIds = new Set(users.map((u) => String(u._id)));
  const outside = orders.filter((o) => !custIds.has(String(o.user)));
  if (outside.length) throw new Error(`${outside.length} order(s) reference a user outside the set`);
  if (users.some((u) => u.email === SEED_ADMIN_EMAIL)) {
    throw new Error('seed admin is inside the migration set');
  }

  const before = {
    users: await P.collection('users').countDocuments(),
    orders: await P.collection('orders').countDocuments(),
    reviews: await P.collection('reviews').countDocuments(),
  };

  console.log('   production before:');
  console.log(`     users ${before.users} · orders ${before.orders} · reviews ${before.reviews}`);
  console.log('');
  console.log('   to migrate:');
  console.log(`     users ${users.length} · orders ${orders.length} · reviews ${reviews.length}`);
  console.log('');

  if (dryRun) {
    console.log('   (dry run — nothing written)');
    console.log('   expected after: ' +
      `users ${before.users + users.length} · ` +
      `orders ${before.orders + orders.length} · ` +
      `reviews ${before.reviews + reviews.length}`);
    await seedConn.close();
    await prodConn.close();
    return;
  }

  // Order matters: users first so orders/reviews never reference a missing user.
  console.log('   writing…');
  const nu = await insertAll(P.collection('users'), users, 'users  ');
  const no = await insertAll(P.collection('orders'), orders, 'orders ');
  const nr = await insertAll(P.collection('reviews'), reviews, 'reviews');

  const after = {
    users: await P.collection('users').countDocuments(),
    orders: await P.collection('orders').countDocuments(),
    reviews: await P.collection('reviews').countDocuments(),
  };

  console.log('');
  console.log(`   ✓ inserted: users ${nu} · orders ${no} · reviews ${nr}`);
  console.log('   production after:');
  console.log(`     users ${before.users} → ${after.users}`);
  console.log(`     orders ${before.orders} → ${after.orders}`);
  console.log(`     reviews ${before.reviews} → ${after.reviews}`);
  console.log('');
  console.log('   rollback:');
  console.log(`     db.orders.deleteMany({ seedSource: "${SEED_MARKER}" })`);
  console.log(`     db.reviews.deleteMany({ seedSource: "${SEED_MARKER}" })`);
  console.log(`     db.users.deleteMany({ role: "customer", createdBy: ObjectId("${admin._id}") })`);

  await seedConn.close();
  await prodConn.close();
}

main().catch((err) => {
  console.error('\n💥', err.message);
  process.exit(1);
});
