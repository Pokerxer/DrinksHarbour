// server/__tests__/purchaseOrderLines.test.js
// Purchase-order lines may be presentation lines — "section" headers and
// "note" free-text — alongside product lines (the create form's
// Add a section / Add a note actions and their persistence).
const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitizePurchaseOrderLines } = require('../utils/purchaseOrderItems');
const PurchaseOrder = require('../models/PurchaseOrder');

const product = (over = {}) => ({
  subProductId: '507f1f77bcf86cd799439011',
  subProductName: 'Hennessy',
  quantity: 10,
  unitPrice: 100,
  packSize: 12,
  taxRate: 0,
  ...over,
});

test('product lines keep the existing normalisation', () => {
  const out = sanitizePurchaseOrderLines([
    product({ productName: 'Hennessy' }),
  ]);
  // wire aliases are folded into schema names (productName → subProductName,
  // unitPrice → unitCost, packSize → packagingQty)
  assert.equal(out[0].subProductName, 'Hennessy');
  assert.equal(out[0].unitCost, 100);
  assert.equal(out[0].packagingQty, 12);
});

test('product line without subProductId is rejected', () => {
  assert.throws(
    () => sanitizePurchaseOrderLines([product({ subProductId: '' })]),
    /subProductId/,
  );
});

test('section line without subProductId is accepted and zeroed', () => {
  const out = sanitizePurchaseOrderLines([
    product({ lineType: 'section', name: 'Beer crates', subProductId: '' }),
  ]);
  assert.equal(out[0].lineType, 'section');
  assert.equal(out[0].name, 'Beer crates');
  assert.equal(out[0].quantity, 0);
  assert.equal(out[0].unitCost, 0);
  assert.equal(out[0].totalCost, 0);
  assert.equal(out[0].packagingQty, 1);
  assert.equal(out[0].receivedQty, 0);
  assert.equal('subProductId' in out[0], false);
});

test('section line without a title is rejected', () => {
  assert.throws(
    () => sanitizePurchaseOrderLines([{ lineType: 'section', name: '' }]),
    /Section line(s)? (must|require)/,
  );
});

test('note line without subProductId is accepted and keeps its text', () => {
  const out = sanitizePurchaseOrderLines([
    product({ lineType: 'note', description: 'Deliver before Friday', subProductId: '' }),
  ]);
  assert.equal(out[0].lineType, 'note');
  assert.equal(out[0].description, 'Deliver before Friday');
  assert.equal(out[0].quantity, 0);
  assert.equal('subProductId' in out[0], false);
});

test('note line without text is rejected', () => {
  assert.throws(
    () => sanitizePurchaseOrderLines([{ lineType: 'note', description: '   ' }]),
    /Note line(s)? (must|require)/,
  );
});

test('model accepts section and note lines without a subProductId', () => {
  const doc = new PurchaseOrder({
    tenant: '507f1f77bcf86cd799439012',
    poNumber: 'RFQ-000001',
    vendorName: 'Vendor',
    createdBy: '507f1f77bcf86cd799439013',
    items: [
      { lineType: 'section', name: 'Beer crates', quantity: 0, unitCost: 0 },
      { lineType: 'note', description: 'Deliver before Friday' },
      { lineType: 'product', subProductId: '507f1f77bcf86cd799439011', subProductName: 'Hennessy', quantity: 10 },
    ],
  });
  const err = doc.validateSync();
  assert.equal(err, undefined);
});

test('product lines still require a subProductId at model level', () => {
  const doc = new PurchaseOrder({
    tenant: '507f1f77bcf86cd799439012',
    poNumber: 'RFQ-000002',
    vendorName: 'Vendor',
    createdBy: '507f1f77bcf86cd799439013',
    items: [
      { lineType: 'product', subProductName: 'No catalog ref', quantity: 5 },
    ],
  });
  const err = doc.validateSync();
  assert.ok(err && err.errors['items.0.subProductId']);
});

test('sections and notes are excluded from zero-line catalog heuristics via lineType', () => {
  // Contract used by validateSubProducts: presentation lines never carry a
  // catalog reference, so only product lines count toward catalog validation.
  const out = sanitizePurchaseOrderLines([
    { lineType: 'section', name: 'A' },
    product(),
  ]);
  assert.deepEqual(
    out.filter((it) => (it.lineType || 'product') === 'product').length,
    1,
  );
});
