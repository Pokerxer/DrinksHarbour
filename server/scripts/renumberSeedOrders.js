// scripts/renumberSeedOrders.js
//
// Rewrite seeded order numbers so they agree with the dates the orders claim.
//
// THE PROBLEM
// Every seeded order was minted today and backdated afterwards, so all 434 carry
// today's prefix (DH260905) and occupy sequences 1–435 for that single date.
//
// utils/orderUtils.generateOrderNumber() builds:
//     DH<yymmdd> + (count of orders whose createdAt is TODAY) + 1
//
// After migration the seeded orders have backdated createdAt values, so they do
// NOT raise that count — the next real order mints DH2609050001, which already
// exists. orderNumber carries a unique index, so the insert throws. Failed
// inserts never persist, so the counter never advances: checkout and POS stay
// broken for that date, permanently.
//
// THE FIX
// Renumber every seeded order from its own createdAt, skipping any sequence
// production already holds for that day. Production owns orders on 9 of the same
// days (e.g. DH2607260001-0006), so starting each day at 0001 would collide.
//
// orderNumber is stored in exactly one field — no receipts, movements, reviews or
// notifications denormalise it — so this rewrite is self-contained.
//
// Safety: writes only to the *_seed database, and asserts global uniqueness
// against production BEFORE any write.
//
// Usage:
//   node -r dotenv/config scripts/renumberSeedOrders.js --dry-run
//   node -r dotenv/config scripts/renumberSeedOrders.js

'use strict';

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const flagsLib = require('./lib/flags');

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
  throw new Error('Cannot resolve the production URI — pass --prod-uri or set PROD_MONGODB_URI');
}

/** DH + yymmdd for a date, matching utils/orderUtils.generateOrderNumber(). */
function dayKey(date) {
  const d = new Date(date);
  return String(d.getFullYear()).slice(-2)
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0');
}

async function main() {
  const args = flagsLib.parseArgv(process.argv.slice(2));
  const dryRun = flagsLib.bool(flagsLib.get(args, 'dry-run'));

  const seedUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!seedUri) throw new Error('MONGODB_URI is not set');
  const prodUri = resolveProdUri(args);

  const seedConn = await mongoose.createConnection(seedUri).asPromise();
  const dbName = seedConn.db.databaseName;
  if (!/_seed$/.test(dbName)) {
    console.error(`✋ Refusing to modify "${dbName}" — name must end in "_seed".`);
    await seedConn.close();
    process.exit(1);
  }
  const prodConn = await mongoose.createConnection(prodUri).asPromise();

  const S = seedConn.db;
  const P = prodConn.db;

  // Sequences production already occupies, per day.
  const prodNumbers = await P.collection('orders').distinct('orderNumber');
  const occupied = new Map();          // 'yymmdd' -> Set(seq)
  for (const n of prodNumbers) {
    const m = /^DH(\d{6})(\d{4,})$/.exec(String(n));
    if (!m) continue;
    if (!occupied.has(m[1])) occupied.set(m[1], new Set());
    occupied.get(m[1]).add(parseInt(m[2], 10));
  }

  // Oldest first, so sequence order matches chronological order within a day.
  const orders = await S.collection('orders')
    .find({ seedSource: SEED_MARKER })
    .project({ orderNumber: 1, createdAt: 1, placedAt: 1 })
    .sort({ createdAt: 1 })
    .toArray();

  console.log(`▶ Renumbering seeded orders in "${dbName}"`);
  console.log(`   orders          : ${orders.length}`);
  console.log(`   prod days w/ orders: ${occupied.size}`);
  console.log(`   dry run         : ${dryRun ? 'yes' : 'no'}`);
  console.log('');

  const counters = new Map();          // 'yymmdd' -> last seq used
  const assigned = new Set();
  const plan = [];

  for (const o of orders) {
    const key = dayKey(o.createdAt);
    let seq = (counters.get(key) || 0) + 1;
    const taken = occupied.get(key);
    while ((taken && taken.has(seq)) || assigned.has(`DH${key}${String(seq).padStart(4, '0')}`)) {
      seq += 1;
    }
    counters.set(key, seq);
    const next = `DH${key}${String(seq).padStart(4, '0')}`;
    assigned.add(next);
    plan.push({ _id: o._id, from: o.orderNumber, to: next, day: key, seq });
  }

  // ── Assertions before any write ───────────────────────────────────────────
  const uniques = new Set(plan.map((p) => p.to));
  if (uniques.size !== plan.length) {
    throw new Error(`renumber produced duplicates: ${plan.length - uniques.size}`);
  }
  const prodSet = new Set(prodNumbers.map(String));
  const clash = plan.filter((p) => prodSet.has(p.to));
  if (clash.length) {
    throw new Error(`renumber collides with production on ${clash.length} number(s), ` +
      `e.g. ${clash[0].to}`);
  }

  // The whole point of the exercise: today's next sequence must come free.
  const now = new Date();
  const todayKey = dayKey(now);
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const prodToday = await P.collection('orders')
    .countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } });
  const nextLive = `DH${todayKey}${String(prodToday + 1).padStart(4, '0')}`;
  if (uniques.has(nextLive)) {
    throw new Error(`renumber still blocks the next live number ${nextLive}`);
  }

  const maxSeq = Math.max(...plan.map((p) => p.seq));
  const days = new Set(plan.map((p) => p.day)).size;
  console.log(`   ✓ ${plan.length} unique numbers across ${days} day(s), max seq ${maxSeq}/day`);
  console.log(`   ✓ 0 collisions with production`);
  console.log(`   ✓ next live number ${nextLive} is free`);
  console.log('');
  console.log('   sample:');
  for (const p of plan.slice(0, 6)) {
    console.log(`     ${p.from} → ${p.to}   (${p.day})`);
  }
  const changed = plan.filter((p) => p.from !== p.to).length;
  console.log(`   … ${changed} of ${plan.length} change`);

  if (dryRun) {
    console.log('\n   (dry run — nothing written)');
    await seedConn.close();
    await prodConn.close();
    return;
  }

  // Two-phase write: the unique index would reject an in-place swap whenever a
  // target number is still held by another row, so park every document on a
  // temporary value first, then apply the finals.
  console.log('\n   writing (two-phase, unique index safe)…');
  let n = 0;
  const bulkTmp = orders.map((o, i) => ({
    updateOne: { filter: { _id: o._id }, update: { $set: { orderNumber: `TMP-${i}-${o._id}` } } },
  }));
  await S.collection('orders').bulkWrite(bulkTmp, { ordered: false });

  const bulkFinal = plan.map((p) => ({
    updateOne: { filter: { _id: p._id }, update: { $set: { orderNumber: p.to } } },
  }));
  const res = await S.collection('orders').bulkWrite(bulkFinal, { ordered: false });
  n = res.modifiedCount;

  const leftover = await S.collection('orders').countDocuments({ orderNumber: /^TMP-/ });
  if (leftover) throw new Error(`${leftover} order(s) stuck on a temporary number`);

  console.log(`   ✓ ${n} order(s) renumbered`);
  console.log(`   ✓ 0 temporary numbers left behind`);

  await seedConn.close();
  await prodConn.close();
}

main().catch((err) => {
  console.error('💥', err.message);
  process.exit(1);
});
