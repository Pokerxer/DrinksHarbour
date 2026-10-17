const Tenant = require('../../models/Tenant');
const Payment = require('../../models/CustomerPayment');
const Credit = require('../../models/CreditNote');
const Order = require('../../models/Order');
const Statement = require('../../models/CustomerAccountStatement');
const Journal = require('../../models/JournalEntry');
const { printableBankAccounts, MAX_ACCOUNT_NUMBER } = require('../../utils/bankAccounts');
const { round2 } = require('../accounting.helpers');
function issuerContext(tenant) {
  return { name: tenant?.name || '', address: tenant?.address,
    bankAccounts: printableBankAccounts(tenant?.bankAccounts).filter(a => /^\d+$/.test(a.accountNumber) && a.accountNumber.length <= MAX_ACCOUNT_NUMBER) };
}
function paymentActivity(payment, invoice) {
  const allocated = (payment.allocations || []).filter(a => String(a.salesOrder) === String(invoice.sourceId));
  const amount = allocated.reduce((n, a) => n + a.amount, 0);
  return { id: `payment:${payment._id}`, kind: 'receipt', label: payment.number,
    date: payment.date, amount: round2(allocated.length ? amount : payment.amount),
    status: payment.status, scope: allocated.length ? 'invoice' : 'customer_account',
    method: payment.method, reference: payment.reference };
}
function refundActivity(receipt) {
  const rows = (receipt.refunds || []).map(refund => ({ id: `refund:${refund._id}`, kind: 'refund', label: refund.receiptNumber || 'POS refund',
    date: refund.refundedAt, amount: round2(refund.totalRefunded), status: receipt.isVoided ? 'cancelled' : 'recorded', scope: 'source_document', reference: refund.reason }));
  const older = round2(Math.max(0, (receipt.refundDetails?.amount || 0) - rows.reduce((sum, row) => sum + row.amount, 0)));
  if (older > 0) rows.push({ id: `legacy-refund:${receipt._id}`, kind: 'refund', label: 'Earlier POS refund',
    date: receipt.refundDetails?.createdAt, amount: older, status: receipt.isVoided ? 'cancelled' : 'recorded', scope: 'source_document', reference: receipt.refundDetails?.reason });
  return rows;
}
async function detailContext(tenantId, invoice) {
  const customer = invoice.customer || invoice.customerSnapshot?.customerId;
  const statements = customer ? await Statement.find({ tenant: tenantId, customer,
    _id: { $in: invoice.statements || [] }, entryType: 'payment' }).select('reference').lean() : [];
  const paymentFilter = [{ _id: { $in: invoice.payments || [] } }];
  if (invoice.source === 'sales') paymentFilter.push({ 'allocations.salesOrder': invoice.sourceId });
  if (customer && statements.length) paymentFilter.push({ customer, number: { $in: statements.map(s => s.reference).filter(Boolean) } });
  const [tenant, payments, credits, receipts, journals] = await Promise.all([
    Tenant.findOne({ _id: tenantId }).select('name address bankAccounts').lean(),
    Payment.find({ tenant: tenantId, $or: paymentFilter }).select('number date amount status method reference allocations').lean(),
    invoice.source === 'sales' ? Credit.find({ tenant: tenantId, 'allocations.salesOrder': invoice.sourceId, postedAt: { $ne: null } }).select('number date allocations status reason').lean() : [],
    Order.find({ tenant: tenantId, source: 'pos', _id: { $in: invoice.receipts || [] } }).select('receiptNumber orderNumber createdAt paidAt totalAmount paymentMethod paymentDetails.accountCharge refunds refundDetails isVoided').lean(),
    Journal.find({ tenant: tenantId, _id: { $in: invoice.journalEntries || [] }, status: 'posted' }).select('date entryType lines refDoc').lean(),
  ]);
  const activity = payments.map(p => paymentActivity(p, invoice));
  for (const credit of credits) activity.push({ id: `credit:${credit._id}`, kind: 'credit', label: credit.number,
    date: credit.date, amount: round2(credit.allocations.filter(a => String(a.salesOrder) === String(invoice.sourceId)).reduce((n, a) => n + a.amount, 0)),
    status: credit.status, scope: 'invoice', reference: credit.reason });
  for (const entry of journals.filter(j => j.entryType === 'sales_revenue')) {
    const amount = round2(entry.lines.filter(l => ['1000', '1100', '2200'].includes(l.account)).reduce((n, l) => n + (l.debit || 0), 0));
    if (amount > 0) activity.push({ id: `initial:${entry._id}`, kind: 'receipt', label: 'Payment recorded with sale',
      date: entry.date || invoice.date, amount, status: 'recorded', scope: 'invoice' });
  }
  for (const receipt of receipts) {
    if (invoice.source === 'sales') activity.push({ id: `pos:${receipt._id}`, kind: 'pos_receipt', label: receipt.receiptNumber || receipt.orderNumber || 'POS receipt',
      date: receipt.paidAt || receipt.createdAt, amount: receipt.totalAmount, scope: 'source_document',
      status: receipt.isVoided ? 'cancelled' : 'recorded', method: receipt.paymentMethod });
    activity.push(...refundActivity(receipt));
  }
  activity.sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0) || a.id.localeCompare(b.id));
  return { issuer: issuerContext(tenant), activity };
}
module.exports = { detailContext, paymentActivity, issuerContext, refundActivity };
