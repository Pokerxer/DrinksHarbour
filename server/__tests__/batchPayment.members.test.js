const test = require('node:test');
const assert = require('node:assert/strict');
const { sourceRow } = require('../services/accountingPayment/sourceRows');
const journalId = '507f1f77bcf86cd799439011';
test('verified split receipt exposes separate cash and wallet tender portions', () => {
  const row = sourceRow({ _id: journalId, refDocType: 'Order', lines: [{ account: '1000', debit: 40 }, { account: '2200', debit: 60 }, { account: '4000', credit: 100 }] }, { _id: 'order', totalAmount: 100 });
  assert.deepEqual(row.tenders, { '1000': 40, '1100': 0, '2200': 60 });
});
test('source membership uses net amount and distinct account identities', () => {
  const { sourceMember } = require('../services/batchPayment/members');
  const row = { _id: `source:${journalId}`, status: 'active', source: 'pos', tenders: { '1000': 40, '2200': 60 }, refundsByAccount: { '2200': 10 } };
  assert.equal(sourceMember(row, '1000').amount, 40);
  assert.equal(sourceMember(row, '2200').amount, 50);
  assert.notEqual(sourceMember(row, '1000').key, sourceMember(row, '2200').key);
});
test('refund review, cross-account refunds, nonfinite, full refund and reversal block membership', () => {
  const { sourceMember } = require('../services/batchPayment/members');
  const row = { _id: `source:${journalId}`, status: 'active', source: 'pos', tenders: { '1000': 100 }, refundsByAccount: {} };
  for (const extra of [{ status: 'cancelled' }, { refundIssue: 'Missing posting' }, { refundsByAccount: { '1100': 5 } }, { refundsByAccount: { '1000': 100 } }, { tenders: { '1000': Infinity } }, { tenders: { '1000': Number.MAX_VALUE } }]) assert.equal(sourceMember({ ...row, ...extra }, '1000'), null);
});
