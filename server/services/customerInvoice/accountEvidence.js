const Statement = require('../../models/CustomerAccountStatement');
const Payment = require('../../models/CustomerPayment');
const Journal = require('../../models/JournalEntry');
const { isBalanced } = require('../accounting.helpers');
async function accountEvidence(tenant, doc, session) {
  const customer = doc.paymentDetails?.customer?.customerId;
  if (!(doc.paymentDetails?.accountCharge > 0)) return { payments: [], statements: [], journals: [], issue: '' };
  if (!customer) return { payments: [], statements: [], journals: [], outstanding: doc.paymentDetails.accountCharge, issue: 'POS account customer is missing' };
  const rows = await Statement.find({ tenant, customer, voided: false }).session(session || null).lean();
  const result = { payments: [], statements: rows.map(r => r._id), journals: [], issue: '' };
  if (!rows.some(r => r.entryType === 'charge' && r.receiptNumber === doc.receiptNumber)) result.issue = 'POS account charge is missing from the customer ledger';
  const repayments = rows.filter(r => r.entryType === 'payment');
  const byReference = new Map();
  let verifiedPayments = 0;
  for (const row of repayments) byReference.set(row.reference, (byReference.get(row.reference) || 0) + row.amount);
  for (const [number, amount] of byReference) {
    const payment = number && await Payment.findOne({ tenant, customer, number, status: 'active' }).session(session || null).lean();
    const unallocated = payment ? payment.amount - (payment.allocations || []).reduce((s, a) => s + a.amount, 0) : 0;
    const journal = payment && await Journal.findOne({ tenant, refDoc: payment._id, entryType: 'customer_payment', status: 'posted' }).session(session || null).lean();
    const reversed = journal && await Journal.exists({ tenant, refDoc: journal._id, entryType: 'reversal' }).session(session || null);
    const receivableCredit = (journal?.lines || []).filter(l => l.account === '1300').reduce((n, l) => n + (l.credit || 0), 0);
    if (!journal || reversed || !isBalanced(journal.lines) || amount > unallocated + 0.01 || Math.abs(receivableCredit - payment.amount) > 0.01) result.issue = 'POS account repayments need payment/posting reconciliation';
    else { verifiedPayments += amount; result.payments.push(payment._id); result.journals.push(journal._id); }
  }
  const receipts = new Map();
  for (const row of rows.filter(r => r.entryType !== 'payment')) {
    const key = row.receiptNumber || '';
    const receipt = receipts.get(key) || { key, charges: 0, credits: 0, firstAt: new Date(row.occurredAt).getTime() };
    receipt[row.entryType === 'charge' ? 'charges' : 'credits'] += row.amount;
    receipt.firstAt = Math.min(receipt.firstAt, new Date(row.occurredAt).getTime()); receipts.set(key, receipt);
  }
  result.outstanding = doc.paymentDetails.accountCharge;
  for (const receipt of [...receipts.values()].sort((a, b) => a.firstAt - b.firstAt || a.key.localeCompare(b.key))) {
    const net = Math.max(0, receipt.charges - receipt.credits);
    const remaining = Math.max(0, net - verifiedPayments);
    verifiedPayments = Math.max(0, verifiedPayments - net);
    if (receipt.key === doc.receiptNumber && receipt.charges > 0) result.outstanding = remaining;
  }
  return result;
}
module.exports = { accountEvidence };
