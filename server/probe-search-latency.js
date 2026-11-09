/* Escape-hatch: measure search pipeline stages against the live DB. */
process.env.NODE_ENV = 'probe';
require('dotenv')?.config?.();
require('dotenv').config({ path: require('path').join(__dirname, 'server/.env') });
const mongoose = require('mongoose');

(async () => {
  const t0 = Date.now();
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('connect (incl TLS):', Date.now() - t0, 'ms');
  const db = mongoose.connection.db;
  const products = db.collection('products');

  const t1 = Date.now();
  await products.findOne({}, { projection: { name: 1 } });
  console.log('findOne baseline:', Date.now() - t1, 'ms');

  const t2 = Date.now();
  const pat = new RegExp('jameson', 'i');
  const n = await products.countDocuments({ status: { $in: ['approved', 'pending'] }, $or: [{ name: pat }, { barcode: 'jameson' }] });
  console.log('regex-or count matching:', n, '→', Date.now() - t2, 'ms');

  const t3 = Date.now();
  const rows = await products.find({ status: { $in: ['approved', 'pending'] } }, { projection: { name: 1, barcode: 1 } }).limit(2000).toArray();
  console.log('fetch 2000 minimal rows:', rows.length, '→', Date.now() - t3, 'ms');

  const t4 = Date.now();
  const agg = await products.aggregate([
    { $match: { status: { $in: ['approved', 'pending'] }, $or: [{ name: pat }, { barcode: 'jameson' }] } },
    { $addFields: { _cs: { $cond: [{ $regexMatch: { input: '$name', regex: pat } }, 100, 0] } } },
    { $sort: { _cs: -1 } }, { $limit: 300 },
    { $project: { name: 1, barcode: 1 } },
  ]).toArray();
  console.log('aggregation pipeline (as in smart search):', agg.length, '→', Date.now() - t4, 'ms');

  const t5 = Date.now();
  await products.aggregate([{ $match: {} }, { $project: { name: 1 } }, { $limit: 5 }]).toArray();
  console.log('trivial agg roundtrip:', Date.now() - t5, 'ms');

  const t6 = Date.now();
  await Promise.all([
    db.collection('brands').find({}).limit(5).toArray(),
    db.collection('categories').find({}).limit(5).toArray(),
  ]);
  console.log('parallel tax lists 5:', Date.now() - t6, 'ms');

  const idx = await products.indexes();
  console.log('existing indexes on products:', idx.map(i => i.name).join(', '));
  await mongoose.disconnect();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
