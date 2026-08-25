#!/usr/bin/env node
// scripts/seed-chart-of-accounts.js
//
// Backfills the default Chart of Accounts for every tenant (idempotent —
// existing codes are skipped). Same conventions as backfill-tax-records.js.
//
// Usage (from server/):
//   node scripts/seed-chart-of-accounts.js            # dry run
//   node scripts/seed-chart-of-accounts.js --apply

require('dotenv').config();
const mongoose = require('mongoose');

const DRY_RUN = !process.argv.includes('--apply');
const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/drinksharbour';

async function main() {
  console.log(`Seed Chart of Accounts — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}\n`);
  await mongoose.connect(MONGO_URI);
  require('../models/Tenant');
  require('../models/User');
  const Tenant = mongoose.model('Tenant');
  const Account = require('../models/Account');
  const { DEFAULT_COA, ensureDefaultCOA } = require('../services/chartOfAccounts.service');

  const tenants = await Tenant.find({}).select('name').lean();
  let touched = 0;
  for (const tenant of tenants) {
    const existing = await Account.countDocuments({ tenant: tenant._id });
    if (existing > 0) {
      console.log(`tenant ${tenant.name || tenant._id}: ${existing} account(s) already present — skipped`);
      continue;
    }
    console.log(
      `tenant ${tenant.name || tenant._id}: ${DEFAULT_COA.length} default accounts would be seeded`
    );
    if (!DRY_RUN) {
      await ensureDefaultCOA(tenant._id);
    }
    touched++;
  }

  console.log(
    `\nDone. ${touched} tenant(s) ${DRY_RUN ? 'would receive' : 'received'} the default COA.` +
      (DRY_RUN ? ' (dry run — rerun with --apply)' : '')
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
