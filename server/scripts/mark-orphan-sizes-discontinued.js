// Mark orphan Size docs (whose parent SubProduct no longer exists) as
// discontinued so they stop surfacing as sellable/available data.
//
// WHY THEY EXIST
// --------------
// A handful of SubProduct deletions (bulk-import rows from 2026-07-17) removed
// the SubProduct without removing its Size docs — the sizes were left pointing
// at a dead parent. Since 2026-11-13 deleteSubProduct refuses any listing with
// transactional history, so new orphans should not appear; this script cleans
// the historical residue.
//
// The docs are MARKED, not deleted: InventoryMovement rows reference their ids
// and stay resolvable only while the Size doc exists.
//
// Usage:
//   node scripts/mark-orphan-sizes-discontinued.js            # dry run (default)
//   node scripts/mark-orphan-sizes-discontinued.js --apply    # apply
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const orphans = await db.collection('sizes').aggregate([
    { $lookup: { from: 'subproducts', localField: 'subproduct', foreignField: '_id', as: 'sp' } },
    { $match: { sp: { $size: 0 } } },
  ]).toArray();

  console.log(`Orphan Size docs: ${orphans.length}`);
  for (const s of orphans) {
    console.log(`  ${s._id} sku=${s.sku} size=${s.size} stock=${s.stock} status=${s.status}`);
  }

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply.');
    await mongoose.disconnect();
    return;
  }

  for (const s of orphans) {
    await db.collection('sizes').updateOne(
      { _id: s._id },
      {
        $set: {
          status: 'discontinued',
          availability: 'discontinued',
          'metadata.orphanCleanup': {
            at: new Date(),
            reason: 'parent SubProduct deleted; marked discontinued to keep movement history resolvable',
          },
        },
      }
    );
  }
  console.log(`\nMarked ${orphans.length} orphan size(s) discontinued.`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
