// server/__tests__/order.manualOrigin.test.js
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const Order = require('../models/Order');

const oid = () => new mongoose.Types.ObjectId();

// Schema-only test (no DB): the manual-origin fields must exist, default to
// null, and accept a well-formed invoice subdoc. The docs below carry the
// header fields Order already requires (orderNumber, subtotal, totalAmount,
// paymentMethod) so validation errors can only come from the new fields.
const baseOrder = () => ({
  orderNumber: 'DH-TEST-1',
  subtotal: 0,
  totalAmount: 0,
  paymentMethod: 'bank_transfer',
  items: [],
});

test('Order schema carries manual-origin fields defaulting to null', () => {
  const doc = new Order({ items: [] }); // defaults are readable without validation
  assert.strictEqual(doc.originChannel, null);
  assert.strictEqual(doc.placedBy, null);
  assert.strictEqual(doc.invoice, undefined);
  assert.strictEqual(doc.source, 'web'); // manual mode is opt-in
});

test('Order schema accepts an invoice subdoc and whatsapp origin', () => {
  const issuedBy = oid();
  const doc = new Order({
    ...baseOrder(),
    source: 'manual',
    originChannel: 'whatsapp',
    placedBy: issuedBy,
    invoice: {
      token: 'a'.repeat(48),
      issuedAt: new Date(),
      issuedBy,
      provider: 'korapay',
      paymentReference: 'dhm-abc',
      attempt: 1,
    },
  });
  const err = doc.validateSync();
  assert.strictEqual(err, undefined);
  assert.strictEqual(doc.invoice.provider, 'korapay');
});

test('Order schema rejects an unknown originChannel', () => {
  const doc = new Order({ ...baseOrder(), originChannel: 'telegram' });
  const err = doc.validateSync();
  assert.ok(err && err.errors.originChannel, 'originChannel must be enum-guarded');
});
