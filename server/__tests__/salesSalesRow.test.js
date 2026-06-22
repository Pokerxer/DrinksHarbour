// server/__tests__/salesSalesRow.test.js
//
// Regression guard for C1: fulfillOrder previously built Sales rows missing
// finalItemPrice / revenueModelUsed / platformAmount / tenantAmount /
// paymentMethod — every test mocked SalesModel so this never surfaced, and in
// production Sales.create() would throw AFTER stock had already been
// decremented (lost revenue + stuck postedQty). This file imports the REAL
// Sales model and the REAL buildSalesRow helper and asserts the payload
// satisfies every `required: true` field via Mongoose's own validateSync().
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const Sales = require('../models/Sales');
const { buildSalesRow, mapPaymentMethod } = require('../services/salesFulfill.helpers');

const oid = () => new mongoose.Types.ObjectId();

function baseItem() {
  return {
    product: oid(),
    subproduct: oid(),
    size: oid(),
    unitPrice: 500,
    discount: 0,
  };
}

test('buildSalesRow (commission model): satisfies the real Sales schema and splits revenue correctly', () => {
  const tenantId = oid();
  const item = baseItem();
  const qty = 4; // 500 * 4 = 2000 itemSubtotal

  const payload = buildSalesRow({
    tenantId,
    item,
    qty,
    paymentMethod: 'card',
    unitCost: 0, // irrelevant for commission model
    revenue: { revenueModel: 'commission', commissionPct: 10 },
  });

  // Arithmetic: itemSubtotal=2000, 10% commission -> tenantAmount=1800, platformAmount=200
  assert.strictEqual(payload.itemSubtotal, 2000);
  assert.strictEqual(payload.tenantAmount, 1800);
  assert.strictEqual(payload.platformAmount, 200);
  assert.strictEqual(payload.revenueModelUsed, 'commission');
  assert.strictEqual(payload.finalItemPrice, 500);
  assert.strictEqual(payload.paymentMethod, 'card');

  // This is the regression guard: every `required: true` field on the REAL
  // Sales schema must be present and valid. validateSync() === undefined
  // means no validation errors.
  const doc = new Sales(payload);
  const err = doc.validateSync();
  assert.strictEqual(err, undefined, err ? err.message : undefined);
});

test('buildSalesRow (markup model): satisfies the real Sales schema and splits revenue correctly', () => {
  const tenantId = oid();
  const item = baseItem();
  const qty = 4; // 500 * 4 = 2000 itemSubtotal
  const unitCost = 300; // 300 * 4 = 1200 cost

  const payload = buildSalesRow({
    tenantId,
    item,
    qty,
    paymentMethod: 'bank_transfer',
    unitCost,
    revenue: { revenueModel: 'markup' },
  });

  // Arithmetic: tenantAmount = min(unitCost*qty, itemSubtotal) = min(1200, 2000) = 1200
  // platformAmount = itemSubtotal - tenantAmount = 800
  assert.strictEqual(payload.itemSubtotal, 2000);
  assert.strictEqual(payload.tenantAmount, 1200);
  assert.strictEqual(payload.platformAmount, 800);
  assert.strictEqual(payload.revenueModelUsed, 'markup');
  assert.strictEqual(payload.finalItemPrice, 500);
  assert.strictEqual(payload.paymentMethod, 'bank_transfer');

  const doc = new Sales(payload);
  const err = doc.validateSync();
  assert.strictEqual(err, undefined, err ? err.message : undefined);
});

test('buildSalesRow: markup tenantAmount is clamped to itemSubtotal when unitCost exceeds price (never negative platformAmount)', () => {
  const tenantId = oid();
  const item = baseItem();
  const qty = 2; // itemSubtotal = 1000
  const unitCost = 900; // 900*2 = 1800 > itemSubtotal

  const payload = buildSalesRow({
    tenantId, item, qty, paymentMethod: 'cash', unitCost, revenue: { revenueModel: 'markup' },
  });

  assert.strictEqual(payload.itemSubtotal, 1000);
  assert.strictEqual(payload.tenantAmount, 1000); // clamped
  assert.strictEqual(payload.platformAmount, 0);
  assert.ok(payload.tenantAmount >= 0);
  assert.ok(payload.platformAmount >= 0);

  const doc = new Sales(payload);
  assert.strictEqual(doc.validateSync(), undefined);
});

test("buildSalesRow: paymentMethod 'split' maps to 'other' (Sales enum has no 'split' member)", () => {
  const tenantId = oid();
  const item = baseItem();
  const payload = buildSalesRow({
    tenantId, item, qty: 1, paymentMethod: 'split', unitCost: 0, revenue: { revenueModel: 'markup' },
  });
  assert.strictEqual(payload.paymentMethod, 'other');

  const doc = new Sales(payload);
  assert.strictEqual(doc.validateSync(), undefined);
});

test('mapPaymentMethod: passes through valid enum members, maps everything else (incl. split/undefined/unknown) to other', () => {
  assert.strictEqual(mapPaymentMethod('card'), 'card');
  assert.strictEqual(mapPaymentMethod('cash'), 'cash');
  assert.strictEqual(mapPaymentMethod('wallet'), 'wallet');
  assert.strictEqual(mapPaymentMethod('split'), 'other');
  assert.strictEqual(mapPaymentMethod(undefined), 'other');
  assert.strictEqual(mapPaymentMethod('bogus'), 'other');
});

test('buildSalesRow: required-field regression guard fails loudly if a field is dropped (sanity check on the test itself)', () => {
  const tenantId = oid();
  const item = baseItem();
  const payload = buildSalesRow({
    tenantId, item, qty: 1, paymentMethod: 'cash', unitCost: 0, revenue: { revenueModel: 'markup' },
  });
  delete payload.revenueModelUsed; // simulate the old, broken payload
  const doc = new Sales(payload);
  const err = doc.validateSync();
  assert.ok(err, 'expected validateSync to report missing revenueModelUsed');
  assert.ok(err.errors.revenueModelUsed, 'revenueModelUsed should be flagged as required');
});
