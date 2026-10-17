// Pure display projection of posted source tenders, never an accounting mutation.
const { round2 } = require('../accounting.helpers');
const tenderAccounts = ['1000', '1100', '2200'];
const sum = (lines, side, accounts) => round2((lines || []).reduce((n, l) => n + (!accounts || accounts.includes(l.account) ? Number(l[side] || 0) : 0), 0));
function sourceRow(entry, source, { invoice, reversed = false, refund = 0, refundIssue = '' } = {}) {
  if (!source || source.currency && source.currency !== 'NGN') return null;
  const lines = entry.lines || [];
  if (!lines.length || lines.some((l) => !Number.isFinite(Number(l.debit || 0)) || !Number.isFinite(Number(l.credit || 0)) || l.debit < 0 || l.credit < 0)) return null;
  if (Math.abs(sum(lines, 'debit') - sum(lines, 'credit')) > 0.01) return null;
  const amount = sum(lines, 'debit', tenderAccounts);
  const pos = entry.refDocType === 'Order';
  const total = Number(pos ? source.totalAmount : source.total);
  // Rounding can add a separate debit; validate tender plus receivable against the source total.
  if (!(amount > 0) || !Number.isFinite(total) || Math.abs(sum(lines, 'debit', [...tenderAccounts, '1300']) - total) > 0.01) return null;
  const accounts = new Set(lines.filter((l) => tenderAccounts.includes(l.account) && l.debit > 0).map((l) => l.account));
  const storedMethod = source.paymentMethod;
  const method = accounts.size > 1 || storedMethod === 'split' ? 'split' : accounts.has('1000') ? 'cash' : accounts.has('2200') ? 'wallet' : ['card', 'pos', 'cheque', 'other', 'bank_transfer'].includes(storedMethod) ? storedMethod : 'bank_transfer';
  return { _id: `source:${entry._id}`, number: pos ? source.receiptNumber || source.orderNumber : source.soNumber,
    date: entry.date || source.paidAt || source.createdAt, amount, method,
    customerName: source.customerSnapshot?.name || [source.paymentDetails?.customer?.firstName, source.paymentDetails?.customer?.lastName].filter(Boolean).join(' ') || source.customerInfo?.name || source.customerName || source.deliveryAddress?.name || 'Walk-in customer',
    reference: pos ? source.orderNumber : source.soNumber, allocations: [],
    status: reversed ? 'cancelled' : 'active', readOnly: true, source: pos ? 'pos' : 'sales',
    sourceHref: `${pos ? '/ecommerce/orders' : '/sales'}/${source._id}`, sourceId: String(source._id),
    customer: (source.paymentDetails?.customer?.customerId || source.customerSnapshot?.customerId || (!pos && source.customer)) ? { _id: String(source.paymentDetails?.customer?.customerId || source.customerSnapshot?.customerId || source.customer) } : null,
    invoice: invoice ? { id: String(invoice._id), label: invoice.number, href: `/accounting/invoices/${invoice._id}` } : undefined,
    tenders: Object.fromEntries(tenderAccounts.map((account) => [account, sum(lines, 'debit', [account])])),
    refundsByAccount: {},
    refundedAmount: round2(refund), refundIssue,
  };
}
function sourceSummary(rows) {
  const summary = { activeAmount: 0, allocated: 0, unallocated: 0, cancelledAmount: 0, sourceAmount: 0, refundedAmount: 0 };
  for (const row of rows) {
    if (row.status === 'cancelled') { summary.cancelledAmount += Number(row.amount); continue; }
    summary.activeAmount += Number(row.amount);
    if (row.readOnly) { summary.sourceAmount += Number(row.amount); summary.refundedAmount += Number(row.refundedAmount || 0); }
    else { const allocated = (row.allocations || []).reduce((n, a) => n + Number(a.amount), 0); summary.allocated += allocated; summary.unallocated += Math.max(0, row.amount - allocated); }
  }
  return Object.fromEntries(Object.entries(summary).map(([key, amount]) => [key, round2(amount)]));
}
module.exports = { sourceRow, sourceSummary, sum, tenderAccounts };
