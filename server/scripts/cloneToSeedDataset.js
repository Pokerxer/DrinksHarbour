#!/usr/bin/env node
// scripts/cloneToSeedDataset.js
//
// Copy the CATALOG collections from the live database into an isolated seed
// database so the purchase seeder can write orders, deliveries and reviews
// without touching production.
//
// What is copied (read-only from source, catalog + config only):
//   products, subproducts, sizes, tenants, brands, categories, subcategories,
//   tags, flavors, warehouses
//
// What is NOT copied (the seeder creates these fresh):
//   users, orders, reviews, carts, inventorymovements, loyalty*, audit logs
//
// Usage:
//   node scripts/cloneToSeedDataset.js --target drinksharbour_seed
//   node scripts/cloneToSeedDataset.js --target drinksharbour_seed --drop
//
// Safety:
//   * The SOURCE connection is only ever read from.
//   * Refuses to run if target === source database name.
//   * Refuses to run when NODE_ENV=production unless --force is passed.

'use strict';

const mongoose = require('mongoose');
const { parseArgv, get, bool } = require('./lib/flags');

// Catalog collections the storefront needs to render and sell.
const CATALOG_COLLECTIONS = [
  'products',
  'subproducts',
  'sizes',
  'tenants',
  'brands',
  'categories',
  'subcategories',
  'tags',
  'flavors',
  'warehouses',
];

// Collections the seeder will populate itself — never cloned, so the seed
// dataset starts with zero customers, orders and reviews.
const EXCLUDED = [
  'users', 'orders', 'reviews', 'carts', 'refreshtokens', 'auditlogs',
  'inventorymovements', 'stockmovements', 'warehousemovements',
  'loyaltytransactions', 'platformloyaltytransactions', 'notifications',
];

async function main() {
  const args = parseArgv(process.argv.slice(2));
  const targetDbName = String(get(args, 'target') || 'drinksharbour_seed');
  const drop = bool(get(args, 'drop'));
  const force = bool(get(args, 'force'));
  const batchSize = 1000;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  if (process.env.NODE_ENV === 'production' && !force) {
    console.error('✋ NODE_ENV=production. Re-run with --force if you are certain.');
    process.exit(1);
  }

  const conn = await mongoose.createConnection(uri).asPromise();
  const sourceDbName = conn.db.databaseName;

  if (sourceDbName === targetDbName) {
    console.error(`✋ Target database "${targetDbName}" is the same as the source. Refusing.`);
    await conn.close();
    process.exit(1);
  }

  console.log(`▶ Cloning catalog`);
  console.log(`   source : ${sourceDbName}  (read-only)`);
  console.log(`   target : ${targetDbName}`);
  console.log(`   drop   : ${drop ? 'yes — target collections will be emptied first' : 'no'}`);
  console.log('');

  const targetDb = conn.useDb(targetDbName, { useCache: true });

  let grandTotal = 0;
  for (const name of CATALOG_COLLECTIONS) {
    if (EXCLUDED.includes(name)) continue;

    const src = conn.db.collection(name);
    const dst = targetDb.db.collection(name);

    const count = await src.countDocuments();
    if (count === 0) {
      console.log(`   · ${name.padEnd(16)} 0 docs — skipped`);
      continue;
    }

    if (drop) {
      await dst.deleteMany({});
    }

    // Stream in batches so a large `sizes`/`products` collection does not
    // materialise entirely in memory.
    const cursor = src.find({});
    let buffer = [];
    let copied = 0;

    while (await cursor.hasNext()) {
      buffer.push(await cursor.next());
      if (buffer.length >= batchSize) {
        await dst.insertMany(buffer, { ordered: false }).catch((e) => {
          // Duplicate-key on re-run without --drop is expected and harmless.
          if (e.code !== 11000) throw e;
        });
        copied += buffer.length;
        buffer = [];
      }
    }
    if (buffer.length) {
      await dst.insertMany(buffer, { ordered: false }).catch((e) => {
        if (e.code !== 11000) throw e;
      });
      copied += buffer.length;
    }

    grandTotal += copied;
    console.log(`   ✓ ${name.padEnd(16)} ${String(copied).padStart(6)} docs`);
  }

  // Report what the seed DB will start with on the write-side collections.
  console.log('');
  console.log('   seed-side collections (should be empty or absent):');
  for (const name of ['users', 'orders', 'reviews']) {
    const n = await targetDb.db.collection(name).countDocuments().catch(() => 0);
    console.log(`   · ${name.padEnd(16)} ${n}`);
  }

  console.log('');
  console.log(`✅ Cloned ${grandTotal.toLocaleString()} documents into "${targetDbName}".`);
  console.log('');
  console.log('Next: point the API at the seed DB and restart it, e.g.');
  console.log(`   MONGODB_URI="<same-cluster-uri-with-/${targetDbName}>" npm run dev`);

  await conn.close();
}

main().catch((err) => {
  console.error('💥', err.message);
  process.exit(1);
});
