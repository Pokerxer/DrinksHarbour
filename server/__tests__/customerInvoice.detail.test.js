const test = require('node:test');
const assert = require('node:assert/strict');
test('invoice activity reports the allocated amount, and bank instructions exclude incomplete/invalid accounts', () => {
  const { paymentActivity, issuerContext } = require('../services/customerInvoice/detail');
  const payment = { _id: 'pay', number: 'PAY-1', amount: 100, status: 'active',
    allocations: [{ salesOrder: 'source', amount: 25 }, { salesOrder: 'different', amount: 75 }] };
  assert.equal(paymentActivity(payment, { source: 'sales', sourceId: 'source' }).amount, 25);
  const shared = paymentActivity({ ...payment, allocations: [] }, { source: 'pos' });
  assert.equal(shared.scope, 'customer_account');
  const issuer = issuerContext({ name: 'Shop', bankName: 'Settlement bank', bankAccountNumber: '999',
    bankAccounts: [{ bankName: 'Good bank', accountNumber: '0123456789' }, { bankName: 'Bad bank', accountNumber: 'abc' }, { accountNumber: '123' }] });
  assert.deepEqual(issuer.bankAccounts, [{ bankName: 'Good bank', accountNumber: '0123456789', accountName: '' }]);
  assert.equal(issuer.bankName, undefined);
});
test('source refund activity includes older refund balances without counting them twice', () => {
  const { refundActivity } = require('../services/customerInvoice/detail');
  const receipt = { _id: 'pos', refundDetails: { amount: 30, createdAt: '2026-10-10' }, refunds: [{ _id: 'refund', totalRefunded: 10 }] };
  const rows = refundActivity(receipt);
  assert.equal(rows.reduce((sum, row) => sum + row.amount, 0), 30);
  assert.equal(rows.find(row => row.label === 'Earlier POS refund').date, '2026-10-10');
  assert.equal(refundActivity({ ...receipt, refundDetails: { amount: 10 } }).length, 1);
});
