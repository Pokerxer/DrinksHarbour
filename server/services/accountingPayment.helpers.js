const { round2 } = require('./accounting.helpers');
const { bad } = require('./accounting.query');
function validatePayment(data, direction) {
  if (!['customer', 'vendor'].includes(direction)) throw bad('Invalid payment direction');
  if (!Number.isFinite(Number(data.amount)) || round2(data.amount) <= 0) throw bad('Payment amount must be positive and finite');
  const method = data.method || (direction === 'customer' ? 'cash' : 'bank_transfer');
  if (!['cash', 'bank_transfer', 'card', 'pos', 'wallet', 'cheque', 'other'].includes(method)) throw bad('Invalid payment method');
  const key = direction === 'customer' ? 'salesOrder' : 'vendorBill';
  const seen = new Set();
  if (data.allocations !== undefined && !Array.isArray(data.allocations)) throw bad('Invalid allocations');
  const allocations = (data.allocations || []).map(a => {
    const id = String(a[key] || '');
    if (!id || !Number.isFinite(Number(a.amount)) || round2(a.amount) <= 0) throw bad('Allocation amount and document are required');
    if (seen.has(id)) throw bad('Allocate each document only once');
    seen.add(id);
    return { [key]: id, amount: round2(a.amount) };
  });
  if (round2(allocations.reduce((sum, a) => sum + a.amount, 0)) > round2(data.amount)) throw bad('Allocations exceed payment amount');
  return { amount: round2(data.amount), method, allocations };
}
function paymentLines(payment, direction) {
  const cash = payment.method === 'cash' ? '1000' : payment.method === 'wallet' ? '2200' : '1100';
  return direction === 'customer'
    ? [{ account: cash, debit: payment.amount, credit: 0 }, { account: '1300', debit: 0, credit: payment.amount }]
    : [{ account: '2000', debit: payment.amount, credit: 0 }, { account: cash, debit: 0, credit: payment.amount }];
}
module.exports = { validatePayment, paymentLines };
