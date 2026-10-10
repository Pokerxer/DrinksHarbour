'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const axios = require('axios');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const Order = require('../models/Order');
const Checkout = require('../models/IntegrationCheckout');
const service = require('../services/storefrontCheckout.service');
const gateway = require('../services/storefrontGateway');
const stock = require('../services/storefrontStock');
const cart = require('../services/storefrontCart.service');
const tenant = { _id: 'a'.repeat(24) }, key = { _id: 'b'.repeat(24) };
const input = { items: [{ subProductId: 'c'.repeat(24), quantity: 1 }], shippingMethod: 'pickup',
  customer: { firstName: 'Ada', lastName: 'O', email: 'ada@example.com', phone: '08012345678' },
  returnUrl: 'https://shop.example.com/thanks' };
function transaction(t) {
  t.mock.method(mongoose, 'startSession', async () => ({ withTransaction: async action => action(), endSession: async () => {} }));
}
const query = row => ({ select() { return this; }, session() { return this; }, lean: async () => row });
test('checkout validates customer, return URL and idempotency header before DB work', async () => {
  await assert.rejects(service.createCheckout(tenant, key, input, ''), /Idempotency/);
  await assert.rejects(service.createCheckout(tenant, key, { ...input, returnUrl: 'javascript:alert(1)' }, 'request-1'), /return URL/);
  await assert.rejects(service.createCheckout(tenant, key, { ...input, customer: { email: 'bad' } }, 'request-1'), /customer|Customer/);
});
test('checkout replays stored result and rejects a changed payload', async t => {
  transaction(t);
  const prepared = service.prepareCheckout(tenant, key, input, 'request-1');
  t.mock.method(Checkout, 'findOne', () => query({ ...prepared, state: 'ready', authorizationUrl: 'https://checkout.paystack.com/x', total: 5000 }));
  const result = await service.createCheckout(tenant, key, input, 'request-1');
  assert.equal(result.authorizationUrl, 'https://checkout.paystack.com/x');
  await assert.rejects(service.createCheckout(tenant, key, { ...input, ageVerified: true }, 'request-1'), e => e.statusCode === 409);
});
test('pending order and stock reserve precede gateway initialization using one reference', async t => {
  transaction(t);
  t.mock.method(gateway, 'assertConfigured', () => {});
  let saved, order, reserved = false;
  t.mock.method(Checkout, 'findOne', () => query(null));
  t.mock.method(cart, 'quoteCart', async () => ({ total: 5000, subtotal: 5000, shippingFee: 0,
    orderItems: [{ product: 'd'.repeat(24), subproduct: 'c'.repeat(24), tenant: tenant._id, quantity: 1,
      priceAtPurchase: 5000, itemSubtotal: 5000, platformCommission: 650 }] }));
  t.mock.method(stock, 'reserveStock', async () => { reserved = true; });
  t.mock.method(Order, 'insertMany', async rows => { order = rows[0]; return rows; });
  t.mock.method(Checkout, 'create', async rows => { saved = rows[0]; return rows; });
  t.mock.method(Checkout, 'findOneAndUpdate', () => query({ ...saved, state: 'initializing' }));
  t.mock.method(Checkout, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(gateway, 'initialize', async row => {
    assert.equal(reserved, true);
    assert.equal(order.paymentStatus, 'pending');
    assert.equal(order.paymentReference, row.reference);
    return { authorizationUrl: 'https://checkout.paystack.com/x', reference: row.reference };
  });
  const result = await service.createCheckout(tenant, key, { ...input, shippingMethod: 'standard', shipping: { address: '12 City Road', city: 'Abuja', state: 'FCT', lga: 'Municipal Area Council', coordinates: { latitude: 9.0765, longitude: 7.3986 } } }, 'request-2');
  assert.equal(result.total, 5000);
  assert.equal(result.authorizationUrl, 'https://checkout.paystack.com/x');
  assert.equal(order.totalAmount, 5000);
  assert.deepEqual(order.shippingAddress.coordinates, { latitude: 9.0765, longitude: 7.3986 });
  assert.equal(order.shippingAddress.lga, 'Municipal Area Council');
});
test('stock mutations scope both parent and size and reject variant shortages', async t => {
  const item = { tenant: tenant._id, subproduct: 'c'.repeat(24), size: 'd'.repeat(24), quantity: 2 };
  t.mock.method(SubProduct, 'updateOne', async filter => {
    assert.equal(filter.tenant, tenant._id);
    assert.equal(filter.isPublished, true);
    return { modifiedCount: 1 };
  });
  t.mock.method(Size, 'updateOne', async filter => {
    assert.equal(filter.subproduct, item.subproduct);
    assert.equal(filter.tenant, tenant._id);
    return { modifiedCount: 0 };
  });
  await assert.rejects(stock.reserveStock([item], {}), e => e.statusCode === 409);
});
test('checkout reads are scoped to both issuing key and tenant', async t => {
  t.mock.method(Checkout, 'findOne', filter => {
    assert.equal(filter.tenant, tenant._id); assert.equal(filter.apiKey, key._id);
    return query(null);
  });
  await assert.rejects(service.getCheckout(tenant, key, 'e'.repeat(64)), e => e.statusCode === 404);
});
test('Paystack initialization uses kobo, explicit NGN and bounded timeout', async t => {
  process.env.PAYSTACK_SECRET_KEY = 'test-only';
  t.mock.method(axios, 'post', async (url, body, options) => {
    assert.equal(body.amount, 10001); assert.equal(body.currency, 'NGN');
    assert.equal(options.timeout, 15000);
    return { data: { status: true, data: { authorization_url: 'https://checkout.paystack.com/x', reference: body.reference } } };
  });
  const result = await gateway.initialize({ reference: 'ref', amountKobo: 10001, email: 'x@example.com', returnUrl: 'https://shop.example.com' });
  assert.equal(result.reference, 'ref');
});
test('malformed address objects return a validation error instead of crashing', async () => {
  await assert.rejects(service.createCheckout(tenant, key, { ...input, shippingMethod: 'standard', shipping: { address: {}, city: 'Abuja' } }, 'request-3'), e => e.statusCode === 400);
});
