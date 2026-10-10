'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const { ensurePerformanceIndexes } = require('../config/performanceIndexes');
async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  // Connect directly rather than loading models: never trigger unrelated schema
  // index builds or startup reconciliation on the target database.
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, maxPoolSize: 2, serverSelectionTimeoutMS: 10000 });
  try {
    await ensurePerformanceIndexes(mongoose.connection);
    console.log('Created/verified tenant catalogue, marketplace offer and Size indexes.');
  } finally {
    await mongoose.disconnect();
  }
}
if (require.main === module) main().catch(err => {
  console.error('Performance index rollout failed:', err.message);
  process.exitCode = 1;
});
module.exports = { main };
