import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPaidPurchaseEvent } from './purchaseTracking.ts';

const order = {
  orderNumber: 'DH-123', status: 'processing', paymentStatus: 'paid',
  subtotal: 30000, discountTotal: 3000, shippingFee: 2500, taxAmount: 0, totalAmount: 29500,
  items: [{ product: { name: 'Test Gin', slug: 'test-gin' }, subproduct: { sku: 'GIN-70' }, size: { name: '70cl' }, priceAtPurchase: 15000, quantity: 2, itemSubtotal: 30000 }],
};

test('unpaid, cancelled and refunded orders never generate paid purchase payloads', () => {
  for (const paymentStatus of ['pending', 'failed', 'refunded', 'partially_refunded']) {
    assert.equal(buildPaidPurchaseEvent({ ...order, paymentStatus }), null);
  }
  for (const status of ['cancelled', 'refunded']) assert.equal(buildPaidPurchaseEvent({ ...order, status }), null);
});

test('paid purchase value excludes shipping and tax and reflects merchandise discount', () => {
  const payload = buildPaidPurchaseEvent({ ...order, taxAmount: 2025, totalAmount: 31525 });
  assert.equal(payload.transaction_id, 'DH-123');
  assert.equal(payload.value, 27000);
  assert.equal(payload.shipping, 2500);
  assert.equal(payload.tax, 2025);
  assert.equal(payload.currency, 'NGN');
  assert.equal(payload.items[0].price, 13500);
  assert.equal(payload.items[0].discount, 1500);
  assert.equal(payload.items[0].quantity, 2);
  assert.equal(payload.items[0].item_id, 'GIN-70');
});

test('mixed bottles use line subtotals and preserve paid currency', () => {
  const payload = buildPaidPurchaseEvent({ ...order, currency: 'USD', subtotal: 40000, discountTotal: 4000,
    items: [...order.items, { product: { name: 'Wine', slug: 'wine' }, quantity: 1, priceAtPurchase: 10000, itemSubtotal: 10000 }] });
  assert.equal(payload.value, 36000);
  assert.equal(payload.items[1].price, 9000);
  assert.equal(payload.currency, 'USD');
  assert.equal(payload.items.reduce((sum, item) => sum + item.price * item.quantity, 0), 36000);
});

test('malformed snapshots cannot produce NaN, negative revenue or identifier-free purchases', () => {
  for (const change of [{ orderNumber: '' }, { orderNumber: null }, { subtotal: NaN }, { subtotal: 40000 }, { discountTotal: 40000 }, { items: undefined }, { items: [] }, { items: [{ ...order.items[0], quantity: 0 }] }]) {
    assert.equal(buildPaidPurchaseEvent({ ...order, ...change }), null);
  }
});

test('current per-line discount snapshots take precedence over legacy proportional allocation', () => {
  const payload = buildPaidPurchaseEvent({ ...order, subtotal: 40000, discountTotal: 4000, items: [
    { ...order.items[0], discountAmount: 4000 },
    { product: { name: 'Wine', slug: 'wine' }, quantity: 1, priceAtPurchase: 10000, itemSubtotal: 10000, discountAmount: 0 },
  ] });
  assert.equal(payload.items[0].price, 13000);
  assert.equal(payload.items[1].price, 10000);
});
