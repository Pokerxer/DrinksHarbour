require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;
  const q = { status: { $in: ['approved', 'pending'] } };
  const times = [];
  for (let i = 0; i < 10; i++) {
    const t = Date.now();
    await db.collection('products').findOne(q, { projection: { _id: 1 } });
    times.push(Date.now() - t);
  }
  console.log('warm findOne RTTs (ms):', times.join(', '));
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  console.log('avg warm roundtrip:', avg, 'ms — per-query floor for every sequential DB call inside a request');
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
