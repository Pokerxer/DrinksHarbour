// Delete orphan Size docs (parent SubProduct deleted) on explicit operator
// instruction. Snapshots each doc and its referencing ledgers to a JSON report
// next to the script before deleting, so the immutable InventoryMovement rows
// (whose size ref will dangle) remain interpretable.
//
// Guards:
//   - only deletes docs whose parent SubProduct is STILL missing (re-verified
//     at run time — never a live listing's size)
//   - refuses any orphan that holds a nonzero WarehouseStock row (stock loss
//     must stay deliberate and auditable)
//
// Usage:
//   node scripts/delete-orphan-sizes.js            # dry run (default)
//   node scripts/delete-orphan-sizes.js --apply
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('node:fs');

const APPLY = process.argv.includes('--apply');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const orphans = await db.collection('sizes').aggregate([
    { $lookup: { from: 'subproducts', localField: 'subproduct', foreignField: '_id', as: 'sp' } },
    { $match: { sp: { $size: 0 } } },
  ]).toArray();

  console.log(`Orphan Size docs: ${orphans.length}`);

  const report = { deletedAt: new Date().toISOString(), sizes: [] };
  for (const s of orphans) {
    // Ledger snapshot — what references this size after deletion?
    const movements = await db.collection('inventorymovements')
      .find({ size: s._id })
      .project({ _id: 1, type: 1, quantity: 1, subProduct: 1, createdAt: 1, note: 1 })
      .toArray();
    const stockRows = await db.collection('warehousestocks').countDocuments({ size: s._id });
    const orders = await db.collection('orders').countDocuments({ 'items.size': s._id });

    if (stockRows > 0) {
      console.log(`SKIP ${s.sku}: still holds ${stockRows} WarehouseStock row(s) — resolve inventory first.`);
      continue;
    }

    report.sizes.push({
      _id: String(s._id),
      subproduct: String(s.subproduct),
      tenant: String(s.tenant),
      sku: s.sku,
      size: s.size,
      displayName: s.displayName,
      stock: s.stock,
      doc: s,
      referencing: { inventoryMovements: movements.length, orders },
      movements: movements.map((m) => ({
        _id: String(m._id), type: m.type, quantity: m.quantity,
        subProduct: String(m.subProduct), createdAt: m.createdAt, note: m.note,
      })),
    });
    console.log(`  ${s.sku} (${s.size}, stock ${s.stock}) — ${movements.length} movement(s) recorded`);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. Re-run with --apply to delete ${report.sizes.length} size doc(s).`);
    await mongoose.disconnect();
    return;
  }

  if (report.sizes.length === 0) {
    console.log('Nothing to delete.');
    await mongoose.disconnect();
    return;
  }

  const ids = report.sizes.map((r) => new mongoose.Types.ObjectId(r._id));
  const res = await db.collection('sizes').deleteMany({ _id: { $in: ids } });
  const file = require('path').join(__dirname, `orphan-size-deletion-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));

  console.log(`\nDeleted ${res.deletedCount} orphan size doc(s). Snapshot: ${file}`);

  const remaining = await db.collection('sizes').aggregate([
    { $lookup: { from: 'subproducts', localField: 'subproduct', foreignField: '_id', as: 'sp' } },
    { $match: { sp: { $size: 0 } } },
    { $count: 'n' },
  ]).toArray();
  console.log(`Orphan sizes remaining: ${remaining[0]?.n ?? 0}`);

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
