#!/usr/bin/env node
'use strict';
// Creates required indexes; never drops existing indexes or rewrites secrets.
async function main() {
  if (!process.argv.includes('--apply')) {
    console.log('Required indexes: ApiKey.hash unique; BillingTransition.tenant unique; Order.tableServiceBooking partial unique. Pass --apply with MONGODB_URI to create them.');
    return;
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    for (const name of ['ApiKey', 'BillingTransition', 'Order', 'JournalEntry']) {
      await require(`../models/${name}`).createIndexes();
      console.log(`${name}: indexes created`);
    }
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
