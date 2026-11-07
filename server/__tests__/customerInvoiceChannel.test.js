// server/__tests__/customerInvoiceChannel.test.js
//
// Invoices born from marketplace-bridged SalesOrders must say they are
// ONLINE sales — the tenant's invoice list, document view and printout all
// label the channel. `salesChannel` is deliberately NOT the immutable
// `source` field: `source` is the sync dispatcher ('sales' | 'pos') and
// dozens of branches depend on it staying 'sales' for bridged SOs.

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId();
const { snapshot, eligible } = require('../services/customerInvoice/snapshot');

const baseSalesDoc = {
  docType: 'order',
  soNumber: 'SO00018',
  orderStatus: 'draft',
  paymentStatus: 'paid',
  currency: 'NGN',
  total: 24063.75,
  subtotal: 24063.75,
  items: [{ name: 'Kopke Fine Tawny Porto', lineType: 'product', quantity: 1, unitPrice: 24063.75, lineTotal: 24063.75 }],
  customerSnapshot: { name: 'Ruth Bojie' },
};

test('a marketplace-bridged SalesOrder snapshots as an online sale', () => {
  const doc = { ...baseSalesDoc, marketplaceOrderId: oid() };
  const s = snapshot('sales', doc);
  assert.equal(s.salesChannel, 'online');
});

test('a hand-created SalesOrder snapshots as a store sale', () => {
  const s = snapshot('sales', { ...baseSalesDoc });
  assert.equal(s.salesChannel, 'store');
});

test('POS receipts always snapshot as store sales', () => {
  const s = snapshot('pos', {
    orderNumber: 'R-1',
    paymentStatus: 'paid',
    status: 'delivered',
    paymentDetails: { customer: { firstName: 'Walk-in', lastName: 'customer' } },
    items: [],
  });
  assert.equal(s.salesChannel, 'store');
});

test('bridged drafts are invoice-eligible via the paid branch', () => {
  // orderStatus draft + paymentStatus paid → the payment branch admits it.
  const doc = { ...baseSalesDoc, marketplaceOrderId: oid() };
  assert.equal(eligible('sales', doc), true);
});
