const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeSessionOrders } = require('../services/posSessionTotals.service');
test('split tender and refunds reconcile the drawer without counting held or voided orders', () => {
  const stats = summarizeSessionOrders([
    { totalAmount: 1000, paymentStatus: 'paid', paymentMethod: 'split', paymentDetails: { splitPayments: [{ method: 'cash', amount: 400 }, { method: 'card', amount: 600 }] }, refunds: [{ totalRefunded: 100, paymentMethod: 'cash' }], tipAmount: 20 },
    { totalAmount: 500, paymentStatus: 'paid', paymentMethod: 'cash' },
    { totalAmount: 800, paymentStatus: 'pending', status: 'hold' },
    { totalAmount: 300, paymentStatus: 'paid', isVoided: true, paymentMethod: 'cash' },
  ]);
  assert.equal(stats.totalSales, 1400);
  assert.equal(stats.orderCount, 2);
  assert.equal(stats.breakdown.cash.total, 800);
  assert.equal(stats.breakdown.card.total, 600);
  assert.equal(stats.totalTips, 20);
});
