#!/usr/bin/env node
// Usage from server/: node scripts/reconcile-pos-tax.js --tenant SLUG --order RECEIPT_OR_ID
// Add --apply only after reviewing the dry-run. No journals or payments are rewritten.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Tenant = require('../models/Tenant');
const Order = require('../models/Order');
const JournalEntry = require('../models/JournalEntry');
const TaxRecord = require('../models/TaxRecord');
const Tax = require('../models/Tax');
const { _buildRecordGroups, captureDocumentTax } = require('../services/tax.service');
const { round2 } = require('../services/tax.helpers');

async function main() {
  const args = process.argv.slice(2);
  const value = flag => args[args.indexOf(flag) + 1];
  if (!args.includes('--tenant') || !args.includes('--order') || !value('--tenant') || !value('--order')) {
    throw new Error('Specify --tenant SLUG and --order RECEIPT_OR_ID (or latest). Dry-run is the default.');
  }
  await connectDB();
  const tenantKey = value('--tenant');
  const tenant = await Tenant.findOne(mongoose.isValidObjectId(tenantKey) ? { _id: tenantKey } : { slug: tenantKey }).select('_id name slug').lean();
  if (!tenant) throw new Error('Tenant not found');
  const key = value('--order');
  const identity = key === 'latest' ? {} : mongoose.isValidObjectId(key) ? { _id: key } : { $or: [{ receiptNumber: key }, { orderNumber: key }] };
  const order = await Order.findOne({ ...identity, 'items.tenant': tenant._id, source: 'pos' }).sort({ createdAt: -1 }).lean();
  if (!order) throw new Error('POS receipt not found in this tenant');
  const tenantIds = new Set((order.items || []).map(item => String(item.tenant || order.tenant)));
  if (tenantIds.size !== 1 || !tenantIds.has(String(tenant._id))) throw new Error('Receipt tenant snapshots are inconsistent');
  const [entries, records, taxes] = await Promise.all([
    JournalEntry.find({ tenant: tenant._id, refDoc: order._id, status: 'posted' }).lean(),
    TaxRecord.find({ tenant: tenant._id, sourceType: 'pos', sourceId: order._id }).lean(),
    Tax.find({ tenant: tenant._id }).lean(),
  ]);
  const reversals = await JournalEntry.countDocuments({ tenant: tenant._id, entryType: 'reversal', refDoc: { $in: entries.map(entry => entry._id) } });
  const journalVAT = round2(entries.flatMap(entry => entry.lines).reduce((sum, line) => sum + (line.account === '2100' ? (line.credit || 0) - (line.debit || 0) : 0), 0));
  const blockers = [];
  if (order.linkedSalesOrder) blockers.push('Linked SalesOrder owns VAT; reconcile its invoice instead.');
  if (order.isVoided || order.paymentStatus !== 'paid' || order.refunds?.length || order.salesReturns?.length || reversals) blockers.push('Returns/voids/reversals require review; this command repairs only settled, unreturned receipts.');
  if (order.currency && order.currency !== 'NGN') blockers.push('Non-NGN receipt.');
  if (!(order.taxAmount > 0)) blockers.push('Receipt has no VAT to capture.');
  if (journalVAT !== round2(order.taxAmount)) blockers.push('Journal VAT does not match receipt VAT; journal reconciliation is required first.');
  const doc = { ...order, tenant: tenant._id };
  const groups = _buildRecordGroups({ sourceType: 'pos', doc, taxes });
  const lineVAT = round2(groups.reduce((sum, row) => sum + row.taxAmount, 0));
  if (lineVAT !== round2(order.taxAmount)) blockers.push('Line tax snapshots do not reconcile with the header.');
  const posted = records.filter(row => row.status === 'posted');
  if (new Set(posted.map(row => row.taxRate)).size !== posted.length) blockers.push('Duplicate VAT rate groups exist.');
  if (posted.some(row => {
    const target = groups.find(group => group.taxRate === row.taxRate);
    return !target || round2(row.taxAmount) !== target.taxAmount || round2(row.taxableBase) !== target.taxableBase;
  })) blockers.push('Existing VAT records conflict with receipt snapshots.');
  if (records.some(row => row.status === 'reversed')) blockers.push('Reversed VAT exists; review its history before recapturing.');
  console.log(JSON.stringify({ mode: args.includes('--apply') ? 'apply' : 'dry-run', tenant: tenant.slug,
    orderId: String(order._id), receipt: order.receiptNumber || order.orderNumber,
    sourceDate: order.paidAt || order.placedAt || order.createdAt,
    receiptVAT: order.taxAmount, journalVAT, lineVAT,
    ledgerVAT: round2(records.filter(row => row.status === 'posted').reduce((sum, row) => sum + row.taxAmount, 0)),
    accountingStatus: order.accountingStatus, blockers,
  }, null, 2));
  if (args.includes('--apply')) {
    if (blockers.length) throw new Error('Repair refused: resolve the reported blockers first.');
    await captureDocumentTax({ sourceType: 'pos', doc, strict: true });
    console.log('VAT capture completed idempotently. Journal entries, payments and order review flags were not changed.');
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
