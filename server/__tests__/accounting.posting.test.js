// __tests__/accounting.posting.test.js
//
// Pure line-builder coverage: every posting balances by construction and
// hits the seeded COA codes.
const test = require('node:test');
const assert = require('node:assert');
const {
  linesForSalesOrder,
  linesForPurchaseOrder,
  linesForVendorBill,
  linesForVendorReturn,
  BUILDERS,
} = require('../services/accounting.posting');
const { isBalanced } = require('../services/accounting.helpers');

test('sales order lines balance: Dr cash/receivable, Cr VAT + revenue', () => {
  const paid = { total: 1075, taxTotal: 75, paymentStatus: 'paid', orderNumber: 'SO-1' };
  const lines = linesForSalesOrder(paid);
  assert.equal(isBalanced(lines), true);
  assert.equal(lines[0].account, '1000'); // cash when paid
  const unpaid = linesForSalesOrder({ total: 500, taxTotal: 0, paymentStatus: 'unpaid' });
  assert.equal(unpaid[0].account, '1300'); // receivables
  assert.equal(linesForSalesOrder({ total: 0, taxTotal: 0 }).length, 0);
});

test('purchase order lines balance: Dr inventory + input VAT, Cr payables', () => {
  const po = {
    poNumber: 'PO-1',
    items: [
      { totalCost: 1000, quantity: 10, unitCost: 100, taxAmount: 75 },
      { totalCost: 500, quantity: 5, unitCost: 100, taxAmount: 0 },
    ],
  };
  const lines = linesForPurchaseOrder(po);
  assert.equal(isBalanced(lines), true);
  assert.equal(lines[0].debit, 1500); // inventory
  assert.equal(lines[1].debit, 75); // tax paid
  assert.equal(lines[2].credit, 1575); // payables
});

test('vendor bill lines mirror the accrual against OpEx', () => {
  const lines = linesForVendorBill({ subtotal: 2000, taxAmount: 150, billNumber: 'BILL-1' });
  assert.equal(isBalanced(lines), true);
  assert.equal(lines[0].account, '6000');
  assert.equal(lines[2].credit, 2150);
});

test('vendor return lines reverse the accrual', () => {
  const lines = linesForVendorReturn({ subtotal: 300, taxAmount: 22.5, returnNumber: 'RET-1' });
  assert.equal(isBalanced(lines), true);
  assert.equal(lines[0].account, '2000'); // Dr payables
  assert.equal(lines[1].credit, 300); // Cr inventory back
});

test('builders registry covers every postable source', () => {
  assert.deepEqual(Object.keys(BUILDERS).sort(), [
    'purchase_order',
    'sales_order',
    'vendor_bill',
    'vendor_return',
  ]);
});

test('bank-paid and partially paid sales separate tender from receivables', () => {
  const bank = linesForSalesOrder({ total: 100, paymentStatus: 'paid', paymentMethod: 'bank_transfer' });
  assert.equal(bank[0].account, '1100');
  const partial = linesForSalesOrder({ total: 100, amountPaid: 40, paymentStatus: 'partial', paymentMethod: 'cash' });
  assert.ok(partial.some(l => l.account === '1000' && l.debit === 40));
  assert.ok(partial.some(l => l.account === '1300' && l.debit === 60));
  assert.ok(isBalanced(partial));
});

test('product vendor bills capitalize stock rather than duplicate operating expense', () => {
  const lines = linesForVendorBill({ subtotal: 100, taxAmount: 0, purchaseOrder: 'po', items: [{ subProductId: 'sp', amount: 100 }] });
  assert.equal(lines[0].account, '1200');
});

test('mixed vendor bills split stock purchases from operating expenses', () => {
  const lines = linesForVendorBill({ subtotal: 120, taxAmount: 9, billNumber: 'B1', items: [{ subProductId: 'stock', amount: 100 }, { amount: 20 }] });
  assert.equal(lines.find(l => l.account === '1200').debit, 100);
  assert.equal(lines.find(l => l.account === '6000').debit, 20);
  assert.ok(isBalanced(lines));
});
