// server/scripts/backfillTracksBatch.js
// Migrate Product.tracksBatch to the "on by default for all products" model.
// Sets tracksBatch = true where unset, and flips alcoholic products that were
// auto-defaulted to false by the previous (alcoholic → false) backfill. A
// product whose tracksBatch is already true is left untouched.
// Usage: node scripts/backfillTracksBatch.js
require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/db');
const Product = require('../models/Product');

(async () => {
  await connectDB();
  // Every product that never had the flag persisted → track batches.
  const resUnset = await Product.updateMany(
    { tracksBatch: { $exists: false } },
    { $set: { tracksBatch: true } }
  );
  // Alcoholic products previously forced to false by the old default → on.
  const resAlcoholic = await Product.updateMany(
    { isAlcoholic: true, tracksBatch: false },
    { $set: { tracksBatch: true } }
  );
  console.log(
    `tracksBatch backfill: ${resUnset.modifiedCount} unset → true, ` +
      `${resAlcoholic.modifiedCount} alcoholic false → true`
  );
  await disconnectDB();
})().catch((e) => { console.error(e); process.exit(1); });
