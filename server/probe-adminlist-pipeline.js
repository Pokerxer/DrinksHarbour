require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const term = 'jameson';
  const rx = { $regex: esc(term), $options: 'i' };
  const query = { $or: [{ name: rx }, { slug: rx }, { description: rx }] };
  const t0 = Date.now();

  const pipeline = [
    { $match: query },
    { $lookup: { from: 'brands', localField: 'brand', foreignField: '_id', as: 'brand', pipeline: [{ $project: { name: 1, slug: 1 } }] } },
    { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'category', pipeline: [{ $project: { name: 1, slug: 1 } }] } },
    { $lookup: { from: 'subcategories', localField: 'subCategory', foreignField: '_id', as: 'subCategory', pipeline: [{ $project: { name: 1, slug: 1 } }] } },
    { $lookup: { from: 'tenants', localField: 'owningTenant', foreignField: '_id', as: 'owningTenant', pipeline: [{ $project: { name: 1, slug: 1 } }] } },
    { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$subCategory', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$owningTenant', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'subproducts', localField: '_id', foreignField: 'product', as: '_statsSubs', pipeline: [
      { $project: { _id: 1, baseSellingPrice: 1, currency: 1 } },
      { $lookup: { from: 'sizes', localField: '_id', foreignField: 'subproduct', as: '_sizes', pipeline: [
        { $match: { sellingPrice: { $gt: 0 } } },
        { $project: { sellingPrice: 1, currency: 1 } },
      ] } },
    ] } },
    { $set: { subProductCount: { $size: '$_statsSubs' } } },
    { $sort: { createdAt: -1 } },
    { $skip: 0 }, { $limit: 50 },
    { $project: { name: 1 } },
  ];
  const rows = await db.collection('products').aggregate(pipeline, { maxTimeMS: 12000 }).toArray();
  console.log('full pipeline rows:', rows.length, '→', Date.now() - t0, 'ms');

  // Stage isolation: match+identity only vs with stats
  const identityOnly = pipeline.slice(0, 9).concat([{ $sort: { createdAt: -1 } }, { $limit: 50 }, { $project: { name: 1 } }]);
  const t1 = Date.now();
  await db.collection('products').aggregate(identityOnly, { maxTimeMS: 12000 }).toArray();
  console.log('identity-only pipeline:', Date.now() - t1, 'ms');

  const t2 = Date.now();
  const c = await db.collection('products').countDocuments(query);
  console.log('count:', c, '→', Date.now() - t2, 'ms');
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
