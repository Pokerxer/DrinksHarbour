#!/usr/bin/env node
// scripts/backfill-journal-entries.js
//
// Replays the auto-postings (accounting.posting.js) for historical documents
// that reached their posting status before the accounting module existed.
// Idempotent via the unique {tenant, refDoc, entryType} index — documents that
// already have their entry are skipped, so re-runs are no-ops.
//
// Stock transfers are intentionally excluded: an internal move posts no entry
// (no value change) — see RESUME-accounting-module.md.
//
// Usage (from server/):
//   node scripts/backfill-journal-entries.js            # dry run
//   node scripts/backfill-journal-entries.js --apply

require('dotenv').config();
const mongoose = require('mongoose');

const DRY_RUN = !process.argv.includes('--apply');
const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/drinksharbour';

// sourceType → model + "at-or-beyond posting status" filter + entryType used
// for the already-present check (must match accounting.posting.js).
const SOURCES = [
  ['sales_order', 'SalesOrder', { docType: 'order', orderStatus: { $in: ['confirmed', 'partially_fulfilled', 'fulfilled'] } }, 'sales_revenue'],
  ['purchase_order', 'PurchaseOrder', { status: 'confirmed', approvalStatus: 'approved' }, 'expense_accrual'],
  ['vendor_bill', 'VendorBill', { status: { $in: ['confirmed', 'paid', 'partial', 'overdue'] } }, 'expense_accrual'],
  ['vendor_return', 'VendorReturn', { status: 'refunded' }, 'refund'],
];

const ENTRY_TYPE_FOR = Object.fromEntries(SOURCES.map(([s, , , t]) => [s, t]));

async function main() {
  console.log(`Backfill JournalEntries — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}\n`);
  await mongoose.connect(MONGO_URI);
  require('../models/Tenant');
  require('../models/User');
  require('../models/Account');
  require('../models/JournalEntry');
  SOURCES.forEach(([, modelName]) => require(`../models/${modelName}`));

  const JournalEntry = mongoose.model('JournalEntry');
  const { postDocumentEntry } = require('../services/accounting.posting');

  const perTenant = {};
  for (const [sourceType, modelName, filter] of SOURCES) {
    const Model = mongoose.model(modelName);
    const docs = await Model.find(filter).lean();
    let written = 0;
    let skipped = 0;
    for (const lean of docs) {
      // Re-fetch as a real document so virtuals/defaults behave like live traffic.
      const doc = await Model.findById(lean._id);
      const already = await JournalEntry.countDocuments({
        tenant: doc.tenant,
        refDoc: doc._id,
        entryType: ENTRY_TYPE_FOR[sourceType],
      });
      if (already > 0) {
        skipped++;
        continue;
      }
      if (!DRY_RUN) {
        await postDocumentEntry({ sourceType, doc, postedBy: null });
      }
      written++;
      const key = String(doc.tenant);
      perTenant[key] = perTenant[key] || {};
      perTenant[key][sourceType] = (perTenant[key][sourceType] || 0) + 1;
    }
    console.log(
      `${sourceType}: ${docs.length} scanned, ${written} ${DRY_RUN ? 'would post' : 'posted'}, ${skipped} already present`
    );
  }

  if (!DRY_RUN && Object.keys(perTenant).length) {
    console.log('\nPer-tenant postings:');
    for (const [tenantId, types] of Object.entries(perTenant)) {
      console.log(`  tenant ${tenantId}: ${JSON.stringify(types)}`);
    }
  }

  console.log('\nDone.', DRY_RUN ? '(dry run — rerun with --apply)' : '');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
