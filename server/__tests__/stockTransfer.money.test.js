const test = require('node:test');
const assert = require('node:assert');
const { computeTransferMoney } = require('../services/stockTransfer.money');

test('no rates, no charges: net equals cost × qty', () => {
  const m = computeTransferMoney(
    [{ quantity: 10, costPrice: 500 }],
    0
  );
  assert.equal(m.lines[0].net, 5000);
  assert.equal(m.lines[0].tax, 0);
  assert.equal(m.lines[0].chargeShare, 0);
  assert.equal(m.lines[0].effectiveUnitCost, 500);
  assert.equal(m.total, 5000);
});

test('discount reduces net before tax', () => {
  // 1000 × 2 @ 10% discount = 1800 net; +7.5% tax = 135
  const m = computeTransferMoney(
    [{ quantity: 2, costPrice: 1000, discountRate: 10, taxRate: 7.5 }],
    0
  );
  assert.equal(m.lines[0].net, 1800);
  assert.equal(m.lines[0].tax, 135);
  assert.equal(m.lines[0].effectiveUnitCost, 967.5);
  assert.equal(m.total, 1935);
});

test('delivery charge apportioned by net weight', () => {
  const m = computeTransferMoney(
    [
      { quantity: 1, costPrice: 3000 },
      { quantity: 1, costPrice: 1000 },
    ],
    200
  );
  // nets 3000 / 1000 → shares 150 / 50
  assert.equal(m.lines[0].chargeShare, 150);
  assert.equal(m.lines[1].chargeShare, 50);
  assert.equal(m.total, 4200);
  assert.equal(m.subtotal, 4000);
});

test('zero Σnet swallows the charge instead of dividing by zero', () => {
  const m = computeTransferMoney([{ quantity: 4, costPrice: 0 }], 250);
  assert.equal(m.lines[0].chargeShare, 0);
  assert.equal(m.total, 0);
});

test('totals block aggregates discount and tax', () => {
  const m = computeTransferMoney(
    [
      { quantity: 1, costPrice: 1000, discountRate: 10, taxRate: 5 },
      { quantity: 3, costPrice: 200, taxRate: 5 },
    ],
    60
  );
  // line1: net 900, tax 45 | line2: net 600, tax 30 | shares 36 / 24
  assert.equal(m.subtotal, 1600);
  assert.equal(m.discountAmount, 100);
  assert.equal(m.taxAmount, 75);
  assert.equal(m.total, 1600 - 100 + 75 + 60);
});
