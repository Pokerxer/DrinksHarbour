#!/usr/bin/env node
// scripts/backfill-marketplace-sales.js
//
// Rebuilds Tenant.marketplaceSalesTotal / Tenant.marketplaceSalesOrders from
// the posted marketplace sales_revenue journals (the settlement authority).
// Always-from-scratch and idempotent: safe to re-run at any time, e.g. after
// accounting backfills or data migrations.
//
// Usage (from server/):
//   node scripts/backfill-marketplace-sales.js            # dry run
//   node scripts/backfill-marketplace-sales.js --apply

require('dotenv').config();
const mongoose = require('mongoose');

const DRY_RUN = !process.argv.includes('--apply');
const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/drinksharbour';

async function main() {
  console.log(`Backfill tenant marketplace sales — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}\n`);
  await mongoose.connect(MONGO_URI);
  require('../models/JournalEntry');
  require('../models/Tenant');

  const { salesRowsFor, recomputeMarketplaceSales } = require('../services/marketplaceSales.service');

  const rows = await salesRowsFor();
  if (!rows.length) {
    console.log('No posted marketplace sales journals found. Nothing to do.');
    return;
  }

  for (const row of rows) {
    console.log(`  tenant ${row._id}  →  ₦${Math.round(row.total).toLocaleString()} across ${row.orders} order(s)`);
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN — ${rows.length} tenant(s) would be updated. Re-run with --apply to write.`);
    return;
  }

  const { updated } = await recomputeMarketplaceSales();
  console.log(`\nDone. ${updated} tenant document(s) updated.`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
