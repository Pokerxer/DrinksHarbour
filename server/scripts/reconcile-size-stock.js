'use strict';

// Reconcile Size.stock with the WarehouseStock ledger.
//
// The bulk importer used to write opening stock to Size.stock twice — once as an
// absolute $set and once via recordReceiptMovement's $inc — so every imported
// size ended up holding exactly double its real on-hand quantity while
// WarehouseStock, SubProduct.totalStock and the InventoryMovement ledger all
// held the correct figure. The importer is fixed (see
// services/subProductImport.service.js); this script repairs the rows written
// before the fix.
//
// Truth used: SUM(WarehouseStock.currentQuantity) for the size, which is what the
// InventoryMovement ledger and the SubProduct rollup already agree on. Sizes with
// no WarehouseStock row at all are reported and left untouched — there is no
// ledger to reconcile them against.
//
// Usage:
//   DRY_RUN=true node scripts/reconcile-size-stock.js   # preview (default)
//   DRY_RUN=false node scripts/reconcile-size-stock.js  # apply
//   ONLY_EXACT_DOUBLES=true ...                         # touch only stock === 2 * ledger

const mongoose = require('mongoose');

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://jrwaldehzx:NWXdpyCMP7yB7a4N@cluster0.ukrr40p.mongodb.net/drinksharbour';

// Safe by default: only DRY_RUN=false writes.
const DRY_RUN = String(process.env.DRY_RUN || 'true').toLowerCase() !== 'false';
const ONLY_EXACT_DOUBLES = String(process.env.ONLY_EXACT_DOUBLES || '').toLowerCase() === 'true';

function availabilityFor(available, threshold) {
  if (available <= 0) return 'out_of_stock';
  if (threshold > 0 && available <= threshold) return 'low_stock';
  return 'in_stock';
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const sizes = await db.collection('sizes')
    .find({}, { projection: { stock: 1, availableStock: 1, reservedStock: 1, lowStockThreshold: 1, sku: 1 } })
    .toArray();

  const ledger = await db.collection('warehousestocks').aggregate([
    { $group: { _id: '$size', qty: { $sum: '$currentQuantity' } } },
  ]).toArray();
  const ledgerBySize = new Map(ledger.map((l) => [String(l._id), l.qty]));

  const ops = [];
  const stats = { total: sizes.length, alreadyCorrect: 0, exactDoubles: 0, otherMismatch: 0, noLedger: 0, skipped: 0 };
  const samples = [];

  for (const s of sizes) {
    const key = String(s._id);
    if (!ledgerBySize.has(key)) { stats.noLedger++; continue; }

    const onHand = ledgerBySize.get(key);
    const reserved = Number(s.reservedStock) || 0;
    const available = Math.max(0, onHand - reserved);
    const currentStock = Number(s.stock) || 0;
    const currentAvailable = Number(s.availableStock) || 0;

    if (currentStock === onHand && currentAvailable === available) { stats.alreadyCorrect++; continue; }

    const isExactDouble = onHand > 0 && currentStock === onHand * 2;
    if (isExactDouble) stats.exactDoubles++; else stats.otherMismatch++;

    if (ONLY_EXACT_DOUBLES && !isExactDouble) { stats.skipped++; continue; }

    if (samples.length < 15) {
      samples.push(`  ${s.sku || key}: stock ${currentStock} → ${onHand}, available ${currentAvailable} → ${available}`);
    }

    ops.push({
      updateOne: {
        filter: { _id: s._id },
        update: {
          $set: {
            stock: onHand,
            availableStock: available,
            availability: availabilityFor(available, Number(s.lowStockThreshold) || 0),
          },
        },
      },
    });
  }

  console.log(`Sizes scanned:            ${stats.total}`);
  console.log(`  already correct:        ${stats.alreadyCorrect}`);
  console.log(`  exactly double ledger:  ${stats.exactDoubles}`);
  console.log(`  other mismatch:         ${stats.otherMismatch}`);
  console.log(`  no WarehouseStock row:  ${stats.noLedger} (left untouched)`);
  if (ONLY_EXACT_DOUBLES) console.log(`  skipped (not doubles):  ${stats.skipped}`);
  console.log(`\nRows to update:           ${ops.length}`);
  if (samples.length) console.log(`Sample corrections:\n${samples.join('\n')}`);

  if (DRY_RUN) {
    console.log('\nDRY RUN — nothing written. Re-run with DRY_RUN=false to apply.');
  } else if (ops.length) {
    const res = await db.collection('sizes').bulkWrite(ops, { ordered: false });
    console.log(`\nApplied. Modified ${res.modifiedCount} size documents.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
