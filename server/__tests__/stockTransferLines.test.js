// server/__tests__/stockTransferLines.test.js
// Stock-transfer lines may be presentation lines — "section" headers and
// "note" free-text — alongside product lines (the transfer form's
// Add a section / Add a note actions and their persistence).
const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeStockTransferLines } = require('../utils/stockTransferItems');
const StockTransfer = require('../models/StockTransfer');

const product = (over = {}) => ({
  subProductId: '507f1f77bcf86cd799439011',
  subProductName: 'Hennessy',
  quantity: 10,
  costPrice: 100,
  packSize: 12,
  taxRate: 0,
  ...over,
});

test('product lines keep the legacy shape untouched', () => {
  const out = sanitizeStockTransferLines([product()]);
  assert.deepEqual(out, [product()]);
});

test('product line without subProductId is rejected', () => {
  assert.throws(
    () => sanitizeStockTransferLines([product({ subProductId: '' })]),
    /subProductId/,
  );
});

test('product line with zero quantity is rejected', () => {
  assert.throws(
    () => sanitizeStockTransferLines([product({ quantity: 0 })]),
    /Quantity/,
  );
});

test('section line without subProductId is accepted and zeroed', () => {
  const out = sanitizeStockTransferLines([
    product({ lineType: 'section', name: 'Beer crates', subProductId: '' }),
  ]);
  assert.equal(out[0].lineType, 'section');
  assert.equal(out[0].name, 'Beer crates');
  assert.equal(out[0].quantity, 0);
  assert.equal(out[0].costPrice, 0);
  assert.equal(out[0].discountRate, 0);
  assert.equal(out[0].taxRate, 0);
  assert.equal(out[0].packSize, 1);
  assert.equal('subProductId' in out[0], false);
});

test('section line without a title is rejected', () => {
  assert.throws(
    () => sanitizeStockTransferLines([{ lineType: 'section', name: '  ' }]),
    /Section line/,
  );
});

test('note line without subProductId is accepted and keeps its text', () => {
  const out = sanitizeStockTransferLines([
    product({
      lineType: 'note',
      description: 'Seal crates before dispatch',
      subProductId: '',
    }),
  ]);
  assert.equal(out[0].lineType, 'note');
  assert.equal(out[0].description, 'Seal crates before dispatch');
  assert.equal(out[0].quantity, 0);
  assert.equal('subProductId' in out[0], false);
});

test('note line without text is rejected', () => {
  assert.throws(
    () => sanitizeStockTransferLines([{ lineType: 'note', description: '' }]),
    /Note line/,
  );
});

test('model accepts section and note lines without a subProductId', () => {
  const doc = new StockTransfer({
    tenant: '507f1f77bcf86cd799439012',
    transferNumber: 'TRF-2026-000001',
    sourceWarehouse: '507f1f77bcf86cd799439014',
    destinationWarehouse: '507f1f77bcf86cd799439015',
    items: [
      { lineType: 'section', name: 'Beer crates', quantity: 0, costPrice: 0 },
      { lineType: 'note', description: 'Seal crates' },
      {
        lineType: 'product',
        subProductId: '507f1f77bcf86cd799439011',
        subProductName: 'Hennessy',
        quantity: 10,
      },
    ],
  });
  const err = doc.validateSync();
  assert.equal(err, undefined);
});

test('product lines still require a subProductId at model level', () => {
  const doc = new StockTransfer({
    tenant: '507f1f77bcf86cd799439012',
    transferNumber: 'TRF-2026-000002',
    sourceWarehouse: '507f1f77bcf86cd799439014',
    destinationWarehouse: '507f1f77bcf86cd799439015',
    items: [
      { lineType: 'product', subProductName: 'No ref', quantity: 5 },
    ],
  });
  const err = doc.validateSync();
  assert.ok(err && err.errors['items.0.subProductId']);
});
