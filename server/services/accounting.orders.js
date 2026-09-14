// Paid operational Orders feed the tenant journal from stored financial snapshots.
const { round2 } = require('./accounting.helpers');
const tenderAccount = method => method === 'cash' ? '1000' : method === 'wallet' ? '2200' : '1100';
const line = (account, debit = 0, credit = 0) => ({ account, debit: round2(debit), credit: round2(credit) });

function orderPostings(order) {
  const groups = new Map();
  for (const item of order.items || []) {
    const tenantId = String(item.tenant?._id || item.tenant || order.tenant || '');
    if (!tenantId) continue;
    if (!groups.has(tenantId)) groups.set(tenantId, []);
    groups.get(tenantId).push(item);
  }
  const entries = [];
  for (const [tenantId, items] of groups) {
    let lines;
    if (order.source === 'pos') {
      if (groups.size !== 1) throw new Error('POS accounting requires one tenant per receipt');
      const total = round2(order.totalAmount);
      const tax = round2(order.taxAmount);
      const tip = round2(order.tipAmount);
      if (total <= 0) continue;
      lines = [];
      let remaining = total;
      const tenders = order.paymentMethod === 'split' ? order.paymentDetails?.splitPayments || [] : [{ method: order.paymentMethod, amount: total }];
      for (const tender of tenders) {
        const amount = Math.min(remaining, Math.max(0, round2(tender.amount)));
        if (amount) lines.push(line(tenderAccount(tender.method), amount));
        remaining = round2(remaining - amount);
      }
      if (remaining > 0) throw new Error('Receipt tenders do not cover the sale');
      if (order.linkedSalesOrder) lines.push(line('1300', 0, total - tip));
      else {
        lines.push(line('4000', 0, total - tax - tip));
        if (tax) lines.push(line('2100', 0, tax));
      }
      if (tip) lines.push(line('2300', 0, tip));
    } else {
      // Marketplace settlements are amounts due from the platform, not cash
      // in the tenant's bank. Use snapshotted shares, never today's commission.
      const due = round2(items.reduce((sum, i) => sum + (Number(i.tenantRevenueShare) || 0), 0));
      const fee = round2(items.reduce((sum, i) => sum + (Number(i.platformCommission) || 0), 0));
      const revenue = round2(due + fee);
      if (revenue <= 0) continue;
      lines = [line('1300', due), line('6500', fee), line('4000', 0, revenue)];
    }
    entries.push({ tenantId, lines, entryType: order.linkedSalesOrder ? 'customer_payment' : 'sales_revenue' });
    const cost = round2(items.reduce((sum, i) => sum + (Number(i.vendorPriceAtPurchase) || 0) * (Number(i.quantity) || 0), 0));
    if (cost > 0) entries.push({ tenantId, lines: [line('5000', cost), line('1200', 0, cost)], entryType: 'cogs' });
  }
  return entries;
}

async function captureOrderAccounting(order) {
  if (order.tableServiceBooking || !['paid', 'partially_refunded', 'refunded'].includes(order.paymentStatus)) return;

  const journal = require('./journalEntry.service');
  const { ensureDefaultCOA } = require('./chartOfAccounts.service');
  try {
    if (order.currency && order.currency !== 'NGN') throw new Error('Foreign currency requires conversion before posting to the NGN ledger');
    const entries = orderPostings(order);
    for (const tenantId of new Set(entries.map(e => e.tenantId))) await ensureDefaultCOA(tenantId);
    if (order.linkedSalesOrder) {
      let so = await require('../models/SalesOrder').findOne({ _id: order.linkedSalesOrder, tenant: order.tenant });
      if (!so) throw new Error('Linked sales order is not in this tenant');
      if (so.docType === 'quotation' && so.convertedTo) so = await require('../models/SalesOrder').findOne({ _id: so.convertedTo, tenant: order.tenant });
      if (!so || so.docType !== 'order' || so.orderStatus === 'cancelled') throw new Error('Linked quotation must be converted and reconciled before accounting can post');
      const entry = await journal.findEntry({ tenantId: so.tenant, refDoc: so._id, entryType: 'sales_revenue' });
      if (!entry) {
        await journal.postJournalEntry({ tenantId: so.tenant, refDoc: so._id, refDocType: 'SalesOrder', entryType: 'sales_revenue', source: 'sales_order',
          date: so.createdAt, lines: require('./accounting.posting').linesForSalesOrder({ ...so.toObject(), paymentStatus: 'unpaid', amountPaid: 0 }), memo: `Sales order ${so.soNumber}` });
      }
    }
    for (const entry of entries) {
      await journal.postJournalEntry({ ...entry, refDoc: order._id, refDocType: 'Order', source: order.source === 'pos' ? 'pos' : 'marketplace',
        date: order.paidAt || order.placedAt || order.createdAt, postedBy: order.posStaff,
        memo: `${order.source === 'pos' ? 'POS receipt' : 'Marketplace order'} ${order.receiptNumber || order.orderNumber}` });
    }
    // Full voids reverse the original entries, including inventory/COGS. A
    // partial refund is posted separately by its immutable refund document id.
    if (order.isVoided) {
      for (const refund of order.refunds || []) {
        const priorRefund = await journal.findEntry({ tenantId: order.tenant, refDoc: refund._id, entryType: 'refund' });
        if (priorRefund) await journal.reverseEntry({ tenantId: order.tenant, entryId: priorRefund._id, userId: order.voidedBy });
      }
      for (const entry of entries) {
        const original = await journal.findEntry({ tenantId: entry.tenantId, refDoc: order._id, entryType: entry.entryType });
        if (original) await journal.reverseEntry({ tenantId: entry.tenantId, entryId: original._id, userId: order.voidedBy });
      }
    } else if (order.source === 'pos') {
      if ((order.refunds || []).length && (order.taxAmount > 0 || order.paymentMethod === 'split' && order.refunds.some(r => !r.paymentMethod))) throw new Error('Refund needs a verified VAT breakdown and refund tender before posting');
      for (const refund of order.refunds || []) {
        if (!refund._id || !(refund.totalRefunded > 0)) continue;
        const lines = [line(order.linkedSalesOrder ? '1300' : '4000', refund.totalRefunded), line(tenderAccount(refund.paymentMethod || order.paymentMethod), 0, refund.totalRefunded)];
        const cost = round2((refund.items || []).reduce((sum, r) => sum + (r.restock === false ? 0 : (Number(order.items[r.orderItemIndex]?.vendorPriceAtPurchase) || 0) * r.quantity), 0));
        if (cost) lines.push(line('1200', cost), line('5000', 0, cost));
        await journal.postJournalEntry({ tenantId: order.tenant, refDoc: refund._id, refDocType: 'OrderRefund', entryType: 'refund', source: 'pos', lines, date: refund.refundedAt, memo: `Refund ${refund.receiptNumber}`, postedBy: refund.refundedBy });
      }
    } else if (['partially_refunded', 'refunded'].includes(order.paymentStatus)) {
      throw new Error('Marketplace refund requires a tenant settlement breakdown before reversal');
    }
    if (!entries.length) throw new Error('No accounting amounts found in order snapshots');
    await order.constructor.updateOne({ _id: order._id }, { $set: { accountingStatus: 'posted', accountingIssue: '', accountingCheckedAt: new Date() } });
  } catch (err) {
    await order.constructor.updateOne({ _id: order._id }, { $set: { accountingStatus: 'needs_review', accountingIssue: err.message, accountingCheckedAt: new Date() } }).catch(() => {});
    console.error('journalPostFailed', { sourceType: order.source, sourceId: String(order._id), message: err.message });
  }
}
module.exports = { orderPostings, captureOrderAccounting };
