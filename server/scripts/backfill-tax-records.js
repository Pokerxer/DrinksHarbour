#!/usr/bin/env node
// scripts/backfill-tax-records.js
//
// One-time repair: writes TaxRecords for documents that reached their capture
// status before the tax module existed (and any missed since). Uses the same
// captureDocumentTax path as live traffic, so records are identical.
//
// Usage (from server/):
//   node scripts/backfill-tax-records.js            # dry run
//   node scripts/backfill-tax-records.js --apply

require('dotenv').config();
const mongoose = require('mongoose');

const DRY_RUN = !process.argv.includes('--apply');
const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/drinksharbour';

// sourceType → model + "at-or-beyond capture status" filter
const SOURCES = [
  ['sales_order', 'SalesOrder', { docType: 'order', orderStatus: { $in: ['confirmed', 'partially_fulfilled', 'fulfilled', 'cancelled'] } }, 'orderStatus'],
  ['purchase_order', 'PurchaseOrder', { approvalStatus: 'approved' }],
  ['vendor_bill', 'VendorBill', { status: { $in: ['confirmed', 'paid', 'partial', 'overdue'] } }],
  ['stock_transfer', 'StockTransfer', { status: 'completed' }],
  ['vendor_return', 'VendorReturn', { status: { $in: ['refunded'] } }],
];

async function main() {
  console.log(`Backfill TaxRecords — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}\n`);
  await mongoose.connect(MONGO_URI);
  require('../models/Tenant');
  require('../models/User');
  require('../models/Tax');
  require('../models/TaxRecord');
  SOURCES.forEach(([, modelName]) => require(`../models/${modelName}`));

  const TaxRecord = mongoose.model('TaxRecord');
  const { captureDocumentTax } = require('../services/tax.service');
  const existingFilterSources = SOURCES.map(([s]) => s);

  const counts = {};
  for (const [sourceType, modelName, filter] of SOURCES) {
    const Model = mongoose.model(modelName);
    const docs = await Model.find(filter).lean();
    let written = 0;
    let skipped = 0;
    for (const lean of docs) {
      // Re-fetch as a real document so virtuals/defaults behave like live traffic.
      const doc = await Model.findById(lean._id);
      const already = await TaxRecord.countDocuments({
        tenant: doc.tenant,
        sourceType,
        sourceId: doc._id,
      });
      if (already > 0) { skipped++; continue; }
      if (!DRY_RUN) {
        await captureDocumentTax({ sourceType, doc, postedBy: null });
      }
      written++;
    }
    counts[sourceType] = { scanned: docs.length, written, skipped };
    console.log(`${sourceType}: ${docs.length} scanned, ${written} ${DRY_RUN ? 'would capture' : 'captured'}, ${skipped} already present`);
  }

  if (existingFilterSources.length !== SOURCES.length) throw new Error('source table changed');
  console.log('\nDone.', DRY_RUN ? '(dry run — rerun with --apply)' : '');
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
