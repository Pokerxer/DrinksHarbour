#!/usr/bin/env node
'use strict';
const mongoose = require('mongoose');
async function main() {
  const uri = process.env.VENUE_MONEY_INDEX_MONGO_URI;
  if (!uri) throw new Error('Explicit target VENUE_MONEY_INDEX_MONGO_URI is required; no application fallback');
  const apply = process.argv.includes('--apply');
  if (apply && !process.argv.includes('--backup-and-index-change-reviewed')) throw new Error('Apply requires explicit backup and index-change review');
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  const service = require('../services/venue/money-indexes');
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', plan: await service.previewMoneyIndexes(mongoose.connection.db) }, null, 2));
  if (apply) console.log(JSON.stringify(await service.applyMoneyIndexes(mongoose.connection.db), null, 2));
}
if (require.main === module) main().catch(() => { console.error('Venue money index preparation failed; URI withheld. Review target access, duplicate/link preview and backup.'); process.exitCode = 1; }).finally(() => mongoose.disconnect());
module.exports = { main };
