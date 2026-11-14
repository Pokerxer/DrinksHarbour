// Diagnostic: trace every Size carrying a given barcode (or every orphan Size
// whose parent SubProduct no longer exists) across the catalogue, its parent
// SubProduct, and its transactional history. Read-only.
//
// Background (2026-11-13, barcode 6009803813156 investigation): deleting a
// SubProduct did not always remove its Size docs, leaving orphans that kept
// barcodes/SKUs reserved and surfaced stale data. deleteSubProduct now refuses
// listings with transactional history (archive instead) and clean listings are
// deleted together with their sizes — see services/subproduct-deletion.js.
//
// Usage:
//   node scripts/trace-orphan-sizes.js                 # all orphan sizes
//   BARCODE=6009803813156 node scripts/trace-orphan-sizes.js   # one barcode
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const BARCODE = process.env.BARCODE;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  let sizes;
  if (BARCODE) {
    sizes = await db.collection('sizes').find({
      $or: [{ barcode: BARCODE }, { archivedBarcode: BARCODE }],
    }).toArray();
    console.log(`Sizes carrying barcode ${BARCODE}: ${sizes.length}`);
  } else {
    sizes = await db.collection('sizes').aggregate([
      { $lookup: { from: 'subproducts', localField: 'subproduct', foreignField: '_id', as: 'sp' } },
      { $match: { sp: { $size: 0 } } },
    ]).toArray();
    console.log(`Orphan Size docs (parent SubProduct deleted): ${sizes.length}`);
  }

  for (const s of sizes) {
    const subId = String(s.subproduct);
    let parent = null;
    try { parent = await db.collection('subproducts').findOne({ _id: new mongoose.Types.ObjectId(subId) }); } catch { /* dead id */ }
    const history = {};
    for (const [coll, field] of [
      ['warehousestocks', 'size'], ['inventorymovements', 'size'], ['orders', 'items.size'],
    ]) {
      history[coll] = await db.collection(coll).countDocuments({ [field]: s._id });
    }
    console.log(JSON.stringify({
      sizeId: s._id, subproduct: subId,
      parentState: parent ? `EXISTS (${parent.status}, sku=${parent.sku})` : 'MISSING (deleted)',
      tenant: String(s.tenant), size: s.size, sku: s.sku,
      barcode: s.barcode, archivedBarcode: s.archivedBarcode,
      stock: s.stock, totalSold: s.totalSold, status: s.status,
      createdAt: s.createdAt, updatedAt: s.updatedAt,
      history,
    }));
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
