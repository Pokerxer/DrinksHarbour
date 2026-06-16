// server/scripts/backfillTracksBatch.js
// One-time: set Product.tracksBatch = !isAlcoholic where currently unset.
// Usage: node scripts/backfillTracksBatch.js
require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/db');
const Product = require('../models/Product');

(async () => {
  await connectDB();
  const resTrue = await Product.updateMany(
    { tracksBatch: { $exists: false }, isAlcoholic: false },
    { $set: { tracksBatch: true } }
  );
  const resFalse = await Product.updateMany(
    { tracksBatch: { $exists: false }, isAlcoholic: true },
    { $set: { tracksBatch: false } }
  );
  console.log(
    `tracksBatch backfill: ${resTrue.modifiedCount} non-alcoholic → true, ${resFalse.modifiedCount} alcoholic → false`
  );
  await disconnectDB();
})().catch((e) => { console.error(e); process.exit(1); });
