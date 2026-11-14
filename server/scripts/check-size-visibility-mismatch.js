// One-off: find listings where a Size and its SubProduct disagree — sizes that
// would not show up in the UI. Read-only.
//   A) Size.subproduct -> live SubProduct, but SubProduct.sizes[] omits it
//   B) SubProduct.sizes[] -> Size doc missing (dangling ref)
//   C) Orphan sizes (parent deleted)
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // A) size backref present, parent list omits it
  const a = await db.collection('sizes').aggregate([
    { $match: { subproduct: { $exists: true, $ne: null } } },
    {
      $lookup: {
        from: 'subproducts', localField: 'subproduct', foreignField: '_id', as: 'sp',
      },
    },
    { $unwind: '$sp' },
    { $match: { $expr: { $not: { $in: ['$_id', { $ifNull: ['$sp.sizes', []] }] } } } },
    { $project: { _id: 1, subproduct: 1, size: 1, sku: 1, barcode: 1, 'sp.sku': 1, 'sp.status': 1 } },
  ]).toArray();
  console.log(`A) backref'd sizes missing from parent sizes[]: ${a.length}`);
  for (const x of a.slice(0, 20)) console.log('  ', JSON.stringify(x));

  // B) parent lists a size id that has no doc
  const b = await db.collection('subproducts').aggregate([
    { $unwind: { path: '$sizes', preserveNullAndEmptyArrays: false } },
    {
      $lookup: {
        from: 'sizes', localField: 'sizes', foreignField: '_id', as: 'sizeDoc',
      },
    },
    { $match: { sizeDoc: { $size: 0 } } },
    { $project: { _id: 1, sku: 1, status: 1, missingSize: '$sizes' } },
  ]).toArray();
  console.log(`B) dangling sizes[] refs (size doc missing): ${b.length}`);
  for (const x of b.slice(0, 20)) console.log('  ', JSON.stringify(x));

  // C) orphans
  const c = await db.collection('sizes').aggregate([
    { $lookup: { from: 'subproducts', localField: 'subproduct', foreignField: '_id', as: 'sp' } },
    { $match: { sp: { $size: 0 } } },
    { $count: 'n' },
  ]).toArray();
  console.log(`C) orphan sizes (parent deleted): ${c[0]?.n ?? 0}`);

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
