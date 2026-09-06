// scripts/dropSeedAnomalies.js
//
// Remove the two seeded orders that must not reach production:
//
//   * an order with `user: null` — the customer session failed mid-run, so it
//     belongs to nobody. Migrated as-is it would be invisible in "my orders",
//     count towards revenue, and break any join that assumes a user.
//   * an order with no `seedSource` marker — its delivery/backdate step failed,
//     so it is still `pending`/unpaid. Being unmarked it is also invisible to
//     every cleanup and rollback query, which makes it unremovable later.
//
// Both are verified to have no dependent reviews before deletion.
//
// Safety: refuses any database whose name does not end in `_seed`.
//
// Usage:
//   node -r dotenv/config scripts/dropSeedAnomalies.js --dry-run
//   node -r dotenv/config scripts/dropSeedAnomalies.js

'use strict';

const mongoose = require('mongoose');
const flagsLib = require('./lib/flags');

const SEED_MARKER = 'seed-script';

async function main() {
  const args = flagsLib.parseArgv(process.argv.slice(2));
  const dryRun = flagsLib.bool(flagsLib.get(args, 'dry-run'));

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  const conn = await mongoose.createConnection(uri).asPromise();
  const dbName = conn.db.databaseName;
  if (!/_seed$/.test(dbName)) {
    console.error(`✋ Refusing to modify "${dbName}" — name must end in "_seed".`);
    await conn.close();
    process.exit(1);
  }

  const db = conn.db;
  const orders = db.collection('orders');
  const reviews = db.collection('reviews');

  const nullUser = await orders.find({ $or: [{ user: null }, { user: { $exists: false } }] })
    .project({ orderNumber: 1, totalAmount: 1, status: 1, seedSource: 1 }).toArray();
  const unmarked = await orders.find({ seedSource: { $exists: false } })
    .project({ orderNumber: 1, totalAmount: 1, status: 1, seedSource: 1 }).toArray();

  const byId = new Map();
  for (const o of [...nullUser, ...unmarked]) byId.set(String(o._id), o);
  const targets = [...byId.values()];

  console.log(`▶ Dropping seed anomalies in "${dbName}"`);
  console.log(`   orders before : ${await orders.countDocuments()}`);
  console.log(`   dry run       : ${dryRun ? 'yes' : 'no'}`);
  console.log('');

  if (targets.length === 0) {
    console.log('   nothing to drop.');
    await conn.close();
    return;
  }

  let blocked = 0;
  for (const o of targets) {
    const deps = await reviews.countDocuments({ order: o._id });
    const why = [];
    if (!o.user) why.push('null user');
    if (!o.seedSource) why.push('unmarked');
    console.log(`   ${o.orderNumber}  ₦${Number(o.totalAmount || 0).toLocaleString()}  ` +
                `${o.status}  [${why.join(', ')}]  dependent reviews: ${deps}`);
    if (deps > 0) blocked += 1;
  }

  if (blocked) {
    throw new Error(`${blocked} order(s) have dependent reviews — refusing to drop`);
  }

  if (dryRun) {
    console.log('\n   (dry run — nothing deleted)');
    await conn.close();
    return;
  }

  const res = await orders.deleteMany({ _id: { $in: targets.map((o) => o._id) } });
  console.log('');
  console.log(`   ✓ ${res.deletedCount} order(s) deleted`);
  console.log(`   orders after : ${await orders.countDocuments()}`);
  console.log(`   marked       : ${await orders.countDocuments({ seedSource: SEED_MARKER })}`);

  await conn.close();
}

main().catch((err) => {
  console.error('💥', err.message);
  process.exit(1);
});
