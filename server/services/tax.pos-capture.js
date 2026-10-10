// Immutable POS VAT snapshots: retries add missing rate groups, never rewrite history.
const TaxRecord = require('../models/TaxRecord');
const { round2 } = require('./tax.helpers');

async function capturePOSTax({ doc, groups, postedBy }) {
  if (!doc.tenant) throw new Error('POS tax capture requires a tenant');
  if (doc.linkedSalesOrder) throw new Error('Linked invoice owns VAT; capture its SalesOrder instead');
  if (doc.currency && doc.currency !== 'NGN') throw new Error('POS tax capture requires NGN');
  const amount = round2(groups.reduce((sum, group) => sum + group.taxAmount, 0));
  if (amount !== round2(doc.taxAmount)) throw new Error('POS line VAT does not reconcile with the receipt tax total');
  if (groups.some(group => group.taxAmount > 0 && !(group.taxRate > 0))) throw new Error('Positive POS VAT has no recorded tax rate');
  const filter = { tenant: doc.tenant, sourceType: 'pos', sourceId: doc._id, status: 'posted' };
  const existing = await TaxRecord.find(filter).lean();
  if (new Set(existing.map(row => row.taxRate)).size !== existing.length) throw new Error('Duplicate POS VAT rate groups require reconciliation');
  const payloads = groups.map(group => ({
    ...filter, tax: group.tax?._id || null, taxName: group.taxName, taxRate: group.taxRate,
    direction: 'collected', taxableBase: group.taxableBase, taxAmount: group.taxAmount,
    currency: 'NGN', sourceNumber: doc.receiptNumber || doc.orderNumber || '',
    postedAt: doc.paidAt || doc.placedAt || doc.createdAt,
    postedBy: postedBy || undefined,
  }));
  // Validate everything before the first write. Conflicting legacy rows require
  // explicit reconciliation; a retry must not erase a filed tax record.
  for (const prior of existing) {
    const target = payloads.find(row => row.taxRate === prior.taxRate);
    if (!target || round2(prior.taxAmount) !== target.taxAmount || round2(prior.taxableBase) !== target.taxableBase) {
      throw new Error('Existing POS tax record differs from receipt; reconcile before retrying');
    }
  }
  for (const row of payloads) await new TaxRecord(row).validate();
  const records = [];
  for (const row of payloads) {
    records.push(await TaxRecord.findOneAndUpdate(
      { ...filter, taxRate: row.taxRate }, { $setOnInsert: row },
      { upsert: true, new: true, runValidators: true }
    ));
  }
  return records;
}
module.exports = { capturePOSTax };
