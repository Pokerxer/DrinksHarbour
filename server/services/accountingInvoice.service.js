// Issue the existing sales draft as an unpaid invoice, without a payment or stock move.
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const { bad, dateRange } = require('./accounting.query');
const journal = require('./journalEntry.service');
const { linesForSalesOrder } = require('./accounting.posting');

async function issueInvoice({ tenantId, id, dueDate, userId }) {
  if (dueDate) dateRange({ from: dueDate });
  await require('./chartOfAccounts.service').ensureDefaultCOA(tenantId);
  return mongoose.connection.transaction(async session => {
    const doc = await SalesOrder.findOne({ _id: id, tenant: tenantId }).session(session);
    if (!doc) throw bad('Invoice draft not found');
    if (doc.invoiceIssuedAt) {
      await require('./customerInvoice/sync').syncSource({ tenantId, source: 'sales', sourceId: doc._id, session });
      return doc;
    }
    const draft = doc.docType === 'quotation'
      ? ['draft', 'sent', 'accepted'].includes(doc.quoteStatus)
      : doc.docType === 'order' && doc.orderStatus === 'draft';
    if (!draft) throw bad('Only an active draft can be issued as an invoice');
    if ((doc.currency && doc.currency !== 'NGN') || !(doc.total > 0)) throw bad('Invoice must have a positive NGN total');
    if (doc.amountPaid > 0 || doc.creditedAmount > 0) throw bad('Reconcile existing payments or credits before issuing');
    if (!(doc.items || []).some(item => item.lineType === 'product' && item.subproduct && item.quantity > 0)) throw bad('Add at least one product');
    doc.docType = 'order';
    doc.orderStatus = 'confirmed';
    doc.quoteStatus = 'converted';
    doc.paymentStatus = 'unpaid';
    doc.amountPaid = 0;
    doc.invoiceIssuedAt = new Date();
    if (dueDate) doc.dueDate = new Date(dueDate);
    await doc.save({ session });
    await journal.postJournalEntry({ tenantId, refDoc: doc._id, refDocType: 'SalesOrder', entryType: 'sales_revenue',
      source: 'sales_order', date: doc.invoiceIssuedAt, lines: linesForSalesOrder(doc), memo: `Invoice ${doc.soNumber}`, postedBy: userId, session });
    const saved = await require('./customerInvoice/sync').syncSource({ tenantId, source: 'sales', sourceId: doc._id, session });
    if (!saved || saved.state !== 'posted') throw bad(saved?.reconciliationIssue || 'Invoice could not be saved');
    return doc;
  });
}
async function saveDraft({ tenantId, id }) {
  if (!mongoose.isValidObjectId(id)) throw bad('Invalid invoice draft');
  const doc = await SalesOrder.findOne({ _id: id, tenant: tenantId });
  if (!doc || doc.invoiceIssuedAt || !((doc.docType === 'quotation' && ['draft', 'sent', 'accepted'].includes(doc.quoteStatus)) ||
    doc.docType === 'order' && doc.orderStatus === 'draft')) throw bad('Only an active draft can be saved');
  doc.invoiceDraft = true;
  await doc.save();
  return require('./customerInvoice/sync').syncSource({ tenantId, source: 'sales', sourceId: doc._id, forceDraft: true });
}
module.exports = { issueInvoice, saveDraft };
