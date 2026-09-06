// scripts/inflateSeedStock.js
//
// Raise product quantities in the SEED database so the order book can actually
// reach the value Cloud Bay's report records.
//
// Why this exists: the PDF records real 8-month volumes — e.g. Jameson Triple
// Distilled sold 1,930 while the catalog carries 3 in stock. reserve() gates on
// SubProduct.availableStock (services/inventory.service.js), and the seeder's
// run-wide budget comes from match-file `stock`. With such low stock the seed
// book cannot fit the report's order values; this script orders them to.
//
// For every matched row it sets the checked Size's stock to
//   max(currentStock, ceil(soldQty × --factor))
// (default factor 1.0 → the DB supports selling the full reported volume of
// that SKU), then rescales the owning SubProduct's total/available stock to the
// sum of its sizes. All touched sizes get availability 'available'.
//
// It also rewrites `final[].stock` in cloudbay-product-match.json so the seeder
// budget follows the new quantities. Original values are kept as `stockBase`.
//
// Usage:
//   node -r dotenv/config scripts/inflateSeedStock.js                # factor 1.0
//   node -r dotenv/config scripts/inflateSeedStock.js --factor 1.5 --cap 500
//   node -r dotenv/config scripts/inflateSeedStock.js --dry-run
//
// Safety: refuses every database whose name does not end in `_seed`.

'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const flagsLib = require('./lib/flags');

const MATCH_FILE = path.resolve(__dirname, 'seed-output', 'cloudbay-product-match.json');
const SELLABLE = new Set(['available', 'low_stock', 'in_stock']);

async function main() {
  const args = flagsLib.parseArgv(process.argv.slice(2));
  const factor = Number(flagsLib.get(args, 'factor') ?? 1);
  const cap = flagsLib.get(args, 'cap') == null ? null : Number(flagsLib.get(args, 'cap'));
  const dryRun = flagsLib.bool(flagsLib.get(args, 'dry-run'));
  if (!(factor > 0)) throw new Error('--factor must be > 0');
  if (cap != null && cap <= 0) throw new Error('--cap must be > 0');

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
  const sizesCol = db.collection('sizes');
  const subproductsCol = db.collection('subproducts');

  const { final: rows } = JSON.parse(fs.readFileSync(MATCH_FILE, 'utf8'));

  // Pull every size of every matched subProduct in one round trip so sibling
  // sizes can be rescrored coherently (subproduct totals = Σ sizes).
  const spIds = [...new Set(rows.map((r) => r.subProductId))]
    .map((id) => new mongoose.Types.ObjectId(id));
  const spDocs = await subproductsCol
    .find({ _id: { $in: spIds } })
    .project({ sizes: 1, name: 1 })
    .toArray();
  const spById = new Map(spDocs.map((s) => [String(s._id), s]));

  const sizeIds = [...new Set(spDocs.flatMap((s) => (s.sizes || []).map(String)))]
    .map((id) => new mongoose.Types.ObjectId(id));
  const sizeDocs = await sizesCol
    .find({ _id: { $in: sizeIds } })
    .project({ size: 1, stock: 1, availableStock: 1, reservedStock: 1, availability: 1, subproduct: 1 })
    .toArray();
  const sizeBySp = new Map();
  for (const z of sizeDocs) {
    const k = String(z.subproduct);
    if (!sizeBySp.has(k)) sizeBySp.set(k, []);
    sizeBySp.get(k).push(z);
  }

  // target stock per sizeId
  const targets = new Map();
  for (const r of rows) {
    const saleTarget = Math.ceil((Number(r.soldQty) || 0) * factor);
    const cur = Number(r.stock) || 0;
    let target = Math.max(cur, saleTarget);
    if (cap != null) target = Math.min(target, cap);
    if (target > cur && !targets.has(String(r.sizeId))) {
      // only count a "raise" if it beats the current size doc stock as well
      const sizeDoc = sizeDocs.find((z) => String(z._id) === String(r.sizeId));
      const liveCur = Number(sizeDoc?.stock) || 0;
      if (target > liveCur) targets.set(String(r.sizeId), { target, liveCur, row: r });
    }
  }

  console.log(`▶ Inflating seed stock in "${dbName}"`);
  console.log(`   factor : ${factor}${cap != null ? `  cap: ${cap}` : ''}`);
  console.log(`   dry run: ${dryRun ? 'yes' : 'no'}`);
  console.log(`   sizes to raise: ${targets.size} of ${rows.length} matched rows`);
  console.log('');

  let raisedSizes = 0, raisedSub = 0;
  const totals = { before: 0, after: 0 };

  for (const [sizeId, { target, liveCur, row }] of targets) {
    totals.before += liveCur;
    totals.after += target;

    if (!dryRun) {
      await sizesCol.updateOne(
        { _id: new mongoose.Types.ObjectId(sizeId) },
        {
          $set: {
            stock: target, availableStock: target,
            availability: 'available',
            seedStockFit: true, seedStockFitFactor: factor,
          },
        },
      );
    }
    raisedSizes += 1;
  }

  // Rescale each touched subProduct to the sum of its sizes' stocks.
  const touchedSp = new Set(
    [...targets.keys()].map((sid) =>
      String(sizeDocs.find((z) => String(z._id) === sid)?.subproduct || '')),
  );
  touchedSp.delete('');

  for (const spIdStr of touchedSp) {
    const sizesHere = sizeBySp.get(spIdStr) || [];
    const sum = sizesHere.reduce((s, z) => {
      const t = targets.get(String(z._id));
      return s + (t ? t.target : Number(z.stock) || 0);
    }, 0);
    if (!dryRun) {
      await subproductsCol.updateOne(
        { _id: new mongoose.Types.ObjectId(spIdStr) },
        { $set: { totalStock: sum, availableStock: sum, seedStockFit: true } },
      );
    }
    raisedSub += 1;
  }

  console.log(`   ✓ sizes raised        : ${raisedSizes}`);
  console.log(`   ✓ subproducts rescaled: ${raisedSub}`);
  console.log(`   Σ matched stock       : ${totals.before.toLocaleString()} → ${totals.after.toLocaleString()}`);
  console.log('');

  const byRaise = [...targets.entries()]
    .map(([, t]) => ({ ...t }))
    .sort((a, b) => (b.target - b.liveCur) - (a.target - a.liveCur))
    .slice(0, 8);
  console.log('   biggest raises:');
  for (const t of byRaise) {
    console.log(`     ${t.row.productName.slice(0, 34).padEnd(36)} ` +
                `${t.liveCur} → ${t.target}  (sold ${t.row.soldQty})`);
  }

  // Keep the seeder's budget aligned with the new stock in the match file.
  if (!dryRun) {
    let n = 0;
    for (const r of rows) {
      const t = targets.get(String(r.sizeId));
      if (t) {
        if (!('stockBase' in r)) r.stockBase = r.stock;
        r.stock = t.target;
        n += 1;
      }
    }
    fs.writeFileSync(MATCH_FILE, JSON.stringify({ final: rows }, null, 1));
    console.log(`\n   ✓ match file stock updated for ${n} row(s) (original kept as stockBase)`);
  } else {
    console.log('\n   (dry run — nothing written)');
  }

  await conn.close();
}

main().catch((err) => {
  console.error('💥', err.message);
  process.exit(1);
});