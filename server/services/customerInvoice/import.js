const mongoose = require('mongoose');
const Invoice = require('../../models/CustomerInvoice');
const Sales = require('../../models/SalesOrder');
const Order = require('../../models/Order');
const { syncSource } = require('./sync');
const { snapshot, eligible } = require('./snapshot');
const { reconcile } = require('./reconcile');
const { bad } = require('../accounting.query');
async function importInvoices({ tenantId, apply = false, after, limit = 5000 }) {
  if (!mongoose.isValidObjectId(tenantId)) throw bad('A single tenant ID is required');
  if (after && !mongoose.isValidObjectId(after)) throw bad('Invalid resume cursor');
  limit = Math.min(10000, Math.max(1, Number(limit) || 5000));
  const result = { tenant: String(tenantId), mode: apply ? 'apply' : 'dry-run', scanned: 0,
    existing: 0, linked: 0, created: 0, wouldCreate: 0, posted: 0, draft: 0, cancelled: 0, errors: [], cursor: null, hasMore: false };
  const seen = new Set();
  // One globally sorted cursor permits restarting a failed/limited import.
  const candidates = [
    { source: 'sales', docs: await Sales.find({ tenant: tenantId,
      ...(after ? { _id: { $gt: after } } : {}), $or: [{ invoiceIssuedAt: { $ne: null } },
        { invoiceDraft: true }, { docType: 'order', orderStatus: 'fulfilled' },
        { docType: 'order', paymentStatus: 'paid' }] }).sort({ _id: 1 }).limit(limit + 1).lean() },
    { source: 'pos', docs: await Order.find({ tenant: tenantId, source: 'pos', tableServiceBooking: null,
      ...(after ? { _id: { $gt: after } } : {}), status: { $ne: 'hold' },
      $or: [{ paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] } }, { status: 'delivered' }] }).sort({ _id: 1 }).limit(limit + 1).lean() },
  ].flatMap(({ source, docs }) => docs.map(doc => ({ source, doc })));
  candidates.sort((a, b) => String(a.doc._id).localeCompare(String(b.doc._id)));
  result.hasMore = candidates.length > limit;
  for (const { source, doc } of candidates.slice(0, limit)) {
    result.scanned++; result.cursor = String(doc._id);
    let canonical = doc, canonicalSource = source;
    if (source === 'pos' && doc.linkedSalesOrder) {
      canonical = await Sales.findOne({ _id: doc.linkedSalesOrder, tenant: tenantId }).lean(); canonicalSource = 'sales';
      if (canonical?.docType === 'quotation' && canonical.convertedTo) canonical = await Sales.findOne({ _id: canonical.convertedTo, tenant: tenantId }).lean();
    }
    if (!canonical) { result.errors.push({ sourceId: String(doc._id), message: 'Linked Sales order is missing in this tenant' }); continue; }
    const key = `${canonicalSource}:${canonical._id}`;
    if (seen.has(key)) { result.linked++; continue; }
    seen.add(key);
    try {
      const prior = await Invoice.findOne({ tenant: tenantId, source: canonicalSource, sourceId: canonical._id }).lean();
      if (prior) result.existing++; else result.wouldCreate++;
      if (apply) {
        const saved = await syncSource({ tenantId, source, sourceId: doc._id, forceDraft: true });
        if (saved) { if (!prior) result.created++; result[saved.state]++; }
      } else {
        const details = snapshot(canonicalSource, canonical);
        const balance = await reconcile(tenantId, canonicalSource, canonical, prior?.total || details.total);
        result[balance.cancelled ? 'cancelled' : eligible(canonicalSource, canonical) && details.currency === 'NGN' && details.total > 0 && !balance.issue ? 'posted' : 'draft']++;
      }
    } catch (err) { result.errors.push({ sourceId: String(doc._id), message: err.message }); }
  }
  return result;
}
module.exports = { importInvoices };
