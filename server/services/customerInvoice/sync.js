const mongoose = require('mongoose');
const Invoice = require('../../models/CustomerInvoice');
const Counter = require('../../models/InvoiceCounter');
const Sales = require('../../models/SalesOrder');
const Order = require('../../models/Order');
const { eligible, snapshot } = require('./snapshot');
const { reconcile } = require('./reconcile');
async function syncSource({ tenantId, source, sourceId, forceDraft = false, session }) {
  if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(sourceId) || !['sales', 'pos'].includes(source)) return null;
  const Model = source === 'sales' ? Sales : Order;
  const doc = await Model.findOne({ _id: sourceId, tenant: tenantId }).session(session || null).lean();
  if (!doc || source === 'pos' && (doc.source !== 'pos' || doc.tableServiceBooking)) return null;
  if (source === 'pos' && doc.linkedSalesOrder) {
    let sales = await Sales.findOne({ _id: doc.linkedSalesOrder, tenant: tenantId }).session(session || null).lean();
    if (sales?.docType === 'quotation' && sales.convertedTo) sales = await Sales.findOne({ _id: sales.convertedTo, tenant: tenantId }).session(session || null).lean();
    if (!sales) return null; // Never silently invent a standalone invoice for a broken link.
    return syncSource({ tenantId, source: 'sales', sourceId: sales._id, forceDraft: true, session });
  }
  const filter = { tenant: tenantId, source, sourceId: doc._id };
  let existing = await Invoice.findOne(filter).session(session || null).lean();
  if (!existing && !eligible(source, doc) && !forceDraft && !doc.invoiceDraft) return null;
  // Snapshot names once; central Product is the only catalog owner.
  if (source === 'pos') {
    const Product = require('../../models/Product');
    const products = await Product.find({ _id: { $in: (doc.items || []).map(i => i.product).filter(Boolean) } }).select('name').session(session || null).lean();
    const names = new Map(products.map(p => [String(p._id), p.name]));
    doc.items = doc.items.map((i, index) => ({ ...i, name: i.name ||
      (existing?.state !== 'draft' && String(existing?.items[index]?.product) === String(i.product)
        ? existing?.items[index]?.name : names.get(String(i.product))) }));
  }
  const details = snapshot(source, doc);
  const balances = await reconcile(tenantId, source, doc, existing?.state !== 'draft' && existing ? existing.total : details.total, session);
  let issue = balances.issue;
  if (existing && existing.state !== 'draft' && existing.snapshotHash !== details.snapshotHash)
    issue = ['Source details changed after invoice posting', issue].filter(Boolean).join('; ');
  const canPost = eligible(source, doc) && details.total > 0 && details.currency === 'NGN' && !issue;
  if (!eligible(source, doc)) issue ||= 'Source is not fully fulfilled, paid, or issued';
  if (details.currency !== 'NGN') issue ||= 'Currency conversion needs review';
  if (!existing) {
    const year = new Date(details.date).getUTCFullYear();
    const next = () => Counter.findOneAndUpdate({ tenant: tenantId, year }, { $inc: { seq: 1 } }, { upsert: true, new: true, session });
    let counter;
    try { counter = await next(); }
    catch (err) { if (err.code !== 11000 || session) throw err; counter = await next(); }
    try {
      existing = await Invoice.findOneAndUpdate(filter, { $setOnInsert: { ...filter, ...details,
        number: `INV-${year}-${String(counter.seq).padStart(6, '0')}`, state: 'draft' } }, { upsert: true, new: true, runValidators: true, session }).lean();
    } catch (err) {
      if (err.code !== 11000 || session) throw err;
      existing = await Invoice.findOne(filter).lean();
      if (!existing) throw err;
    }
  }
  const { issue: unusedIssue, cancelled, ...financials } = balances;
  const state = cancelled || existing.state === 'cancelled' ? 'cancelled' : existing.state === 'posted' || canPost ? 'posted' : 'draft';
  const update = { ...financials, state, reconciliationIssue: issue, checkedAt: new Date() };
  if (state === 'cancelled') update.outstanding = 0;
  if (state === 'posted' && !existing.postedAt) update.postedAt = new Date();
  if (state === 'cancelled' && !existing.cancelledAt) update.cancelledAt = new Date();
  if (existing.state === 'draft') Object.assign(update, details);
  // Compare-and-set prevents a concurrent refresh from overwriting a posted snapshot.
  let saved;
  try { saved = await Invoice.findOneAndUpdate({ ...filter, state: existing.state, updatedAt: existing.updatedAt }, { $set: update }, { new: true, runValidators: true, session }); }
  catch (err) { if (!/Issued invoice details cannot be changed/.test(err.message)) throw err; }
  return saved || Invoice.findOne(filter).session(session || null);
}
async function safelySync(args) {
  if (mongoose.connection.readyState !== 1) return null;
  try { return await syncSource(args); }
  catch (err) {
    // Never roll back a saved checkout because its repairable invoice view failed.
    console.error('invoiceSyncFailed', { source: args.source, sourceId: String(args.sourceId), message: err.message });
    return null;
  }
}
module.exports = { syncSource, safelySync };
