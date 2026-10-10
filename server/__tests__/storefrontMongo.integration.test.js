'use strict';
// Opt-in test against an isolated LOCAL replica set. Never uses MONGODB_URI.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const Order = require('../models/Order');
const Checkout = require('../models/IntegrationCheckout');
const catalog = require('../services/storefrontCatalog.service');
const checkout = require('../services/storefrontCheckout.service');
const settlement = require('../services/storefrontSettlement');
const gateway = require('../services/storefrontGateway');
const stock = require('../services/storefrontStock');
const uri = process.env.DRINKSHARBOUR_TEST_MONGO_URI;
test('real MongoDB transactions isolate tenants, prevent duplicate orders and roll back stock', { skip: !uri }, async t => {
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\/drinks_rest_test_[\w]+\?/);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  await Checkout.init(); await Order.init();
  const oid = () => new mongoose.Types.ObjectId();
  const tenant = { _id: oid(), revenueModel: 'commission', commissionPercentage: 13 }, key = { _id: oid() };
  const foreign = oid(), p = oid(), sp = oid(), sz = oid(), otherSp = oid(), otherSize = oid();
  await Product.collection.insertOne({ _id: p, name: 'Test wine', slug: 'test-wine', status: 'approved', isPublished: true, isAlcoholic: true, costPrice: 1 });
  await SubProduct.collection.insertMany([
    { _id: sp, sku: 'TEST-OWN', tenant: tenant._id, product: p, isPublished: true, status: 'active', baseSellingPrice: 5000, costPrice: 1000, totalStock: 10, availableStock: 10, reservedStock: 0 },
    { _id: otherSp, sku: 'TEST-FOREIGN', tenant: foreign, product: p, isPublished: true, status: 'active', baseSellingPrice: 1, totalStock: 100, availableStock: 100 },
  ]);
  await Size.collection.insertMany([
    { _id: sz, sku: 'TEST-SIZE-OWN', tenant: tenant._id, subproduct: sp, status: 'active', availability: 'available', size: '75cl', sellingPrice: 5000, costPrice: 1000, stock: 10, availableStock: 10, reservedStock: 0 },
    { _id: otherSize, sku: 'TEST-SIZE-FOREIGN', tenant: foreign, subproduct: otherSp, status: 'active', availability: 'available', size: '75cl', sellingPrice: 1, stock: 100, availableStock: 100 },
  ]);
  t.mock.method(gateway, 'assertConfigured', () => {});
  let initialized = 0;
  t.mock.method(gateway, 'initialize', async row => { initialized++; return { reference: row.reference, authorizationUrl: 'https://checkout.paystack.com/test' }; });
  t.mock.method(require('../services/accounting.orders'), 'captureOrderAccounting', async order => {
    assert.ok(order instanceof Order, 'Accounting receives a Mongoose order document');
  });
  const input = { items: [{ subProductId: String(sp), sizeId: String(sz), quantity: 2 }], shippingMethod: 'pickup', ageVerified: true,
    customer: { firstName: 'Test', lastName: 'Buyer', email: 'test@example.com', phone: '08012345678' }, returnUrl: 'https://example.com/return' };
  await t.test('public queries exclude foreign tenant documents and private fields', async () => {
    const list = await catalog.listProducts(tenant, {});
    assert.equal(list.data.length, 1); assert.equal(list.pagination.total, 1);
    assert.doesNotMatch(JSON.stringify(list), /costPrice|reservedStock/);
    await assert.rejects(catalog.getProduct(tenant, String(otherSp)), e => e.statusCode === 404);
  });
  await t.test('pending central products are visible only to their submitting tenant', async () => {
    const ownPending = oid(), foreignPending = oid(), ownOffer = oid(), foreignOffer = oid();
    await Product.collection.insertMany([
      { _id: ownPending, name: 'My pending drink', status: 'pending', isPublished: false, submittingTenant: tenant._id },
      { _id: foreignPending, name: 'Foreign pending drink', status: 'pending', isPublished: false, submittingTenant: foreign },
    ]);
    await SubProduct.collection.insertMany([
      { _id: ownOffer, sku: 'OWN-PENDING', tenant: tenant._id, product: ownPending, isPublished: true, status: 'active', baseSellingPrice: 100, sellWithoutSizeVariants: true },
      { _id: foreignOffer, sku: 'FOREIGN-PENDING', tenant: tenant._id, product: foreignPending, isPublished: true, status: 'active', baseSellingPrice: 100, sellWithoutSizeVariants: true },
    ]);
    assert.equal((await catalog.getProduct(tenant, String(ownOffer))).name, 'My pending drink');
    await assert.rejects(catalog.getProduct(tenant, String(foreignOffer)), e => e.statusCode === 404);
  });
  let created;
  await t.test('concurrent retries produce one order, one payment reference and one reservation', async () => {
    const results = await Promise.all([checkout.createCheckout(tenant, key, input, 'same-attempt'), checkout.createCheckout(tenant, key, input, 'same-attempt')]);
    assert.equal(results[0].id, results[1].id);
    assert.equal(await Checkout.countDocuments(), 1); assert.equal(await Order.countDocuments(), 1); assert.equal(initialized, 1);
    const item = await SubProduct.findById(sp).lean();
    assert.equal(item.availableStock, 8); assert.equal(item.reservedStock, 2);
    created = results[0];
  });
  await t.test('verified payment settles once and status remains restricted to its key', async () => {
    const payment = { reference: created.reference, status: 'success', amount: 10000, currency: 'NGN' };
    await Promise.all([settlement.settlePayment(created.reference, payment), settlement.settlePayment(created.reference, payment)]);
    const result = await checkout.getCheckout(tenant, key, created.id);
    assert.equal(result.status, 'paid'); assert.equal(result.paymentStatus, 'paid'); assert.equal(result.orderStatus, 'confirmed');
    await assert.rejects(checkout.getCheckout(tenant, { _id: oid() }, created.id), e => e.statusCode === 404);
  });
  await t.test('variant shortage rolls back its already updated parent in a transaction', async () => {
    await Size.updateOne({ _id: sz }, { $set: { availableStock: 0 } });
    const session = await mongoose.startSession();
    try {
      await assert.rejects(session.withTransaction(() => stock.reserveStock([{ tenant: tenant._id, subproduct: sp, size: sz, quantity: 1 }], session)), e => e.statusCode === 409);
    } finally { await session.endSession(); }
    assert.equal((await SubProduct.findById(sp).lean()).availableStock, 8);
    await Size.updateOne({ _id: sz }, { $set: { availableStock: 8 } });
  });
  await t.test('concurrent different carts cannot oversell shared parent or variant stock', async () => {
    const larger = { ...input, items: [{ ...input.items[0], quantity: 6 }] };
    const attempts = await Promise.allSettled([checkout.createCheckout(tenant, key, larger, 'attempt-a'), checkout.createCheckout(tenant, key, larger, 'attempt-b')]);
    assert.equal(attempts.filter(row => row.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter(row => row.status === 'rejected').length, 1);
    assert.equal((await SubProduct.findById(sp).lean()).availableStock, 2);
    const ready = attempts.find(row => row.status === 'fulfilled').value;
    t.mock.method(gateway, 'verify', async reference => ({ reference, status: 'failed' }));
    await Promise.all([settlement.cancelCheckout(tenant, key, ready.id), settlement.cancelCheckout(tenant, key, ready.id)]);
    assert.equal((await SubProduct.findById(sp).lean()).availableStock, 8);
    assert.equal((await SubProduct.findById(sp).lean()).reservedStock, 2);
  });
  await t.test('real HTTP website journey authenticates keys, quotes, pays and cancels', async () => {
    const express = require('express');
    const Tenant = require('../models/Tenant'), ApiKey = require('../models/ApiKey');
    const keys = require('../services/apiKey.service');
    await Tenant.collection.insertOne({ ...tenant, name: 'REST test store', slug: 'rest-test',
      status: 'approved', subscriptionStatus: 'active', plan: 'pro' });
    const issued = await keys.issueKey(tenant, oid(), { name: 'Website', scopes: ['storefront:read', 'checkout:write'] });
    const readOnly = await keys.issueKey(tenant, oid(), { name: 'Catalogue', scopes: ['storefront:read'] });
    const app = express(); app.use(express.json());
    app.use('/api/integrations/v1', require('../routes/storefrontIntegration.routes'));
    const server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    t.after(() => new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())));
    const base = `http://127.0.0.1:${server.address().port}/api/integrations/v1`;
    const call = async (path, { method = 'GET', body, secret = issued.secret, attempt } = {}) => {
      const response = await fetch(base + path, { method,
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json',
          ...(attempt ? { 'Idempotency-Key': attempt } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, headers: response.headers, result: await response.json() };
    };
    const store = await call('/store');
    assert.equal(store.status, 200); assert.equal(store.result.data.name, 'REST test store');
    assert.equal(store.headers.get('cache-control'), 'private, no-store');
    assert.equal((await call('/store', { secret: 'invalid' })).status, 401);
    const list = await call('/products?limit=1');
    assert.equal(list.status, 200); assert.equal(list.result.data.length, 1);
    assert.equal((await call(`/products/${sp}`)).status, 200);
    assert.equal((await call(`/products/${otherSp}`)).status, 404);
    const cart = { items: [{ subProductId: String(sp), sizeId: String(sz), quantity: 1 }], shippingMethod: 'pickup', ageVerified: true };
    const quote = await call('/cart/quote', { method: 'POST', body: cart });
    assert.equal(quote.status, 200); assert.equal(quote.result.data.total, 5000);
    assert.doesNotMatch(JSON.stringify(quote.result), /costPrice|commissionPercentage/);
    assert.equal((await call('/cart/quote', { method: 'POST', body: cart, secret: readOnly.secret })).status, 403);
    const body = { ...input, items: cart.items };
    const made = await call('/checkout', { method: 'POST', body, attempt: 'http-attempt-paid' });
    assert.equal(made.status, 201);
    const handle = made.result.data;
    assert.equal(made.headers.get('location'), `/api/integrations/v1/checkout/${handle.id}`);
    assert.equal((await call('/checkout', { method: 'POST', body, attempt: 'http-attempt-paid' })).result.data.id, handle.id);
    assert.equal((await call(`/checkout/${handle.id}`)).result.data.status, 'ready');
    t.mock.method(gateway, 'verify', async reference => ({ reference, status: 'success', amount: 5000, currency: 'NGN' }));
    const paid = await call(`/checkout/${handle.id}/verify`, { method: 'POST' });
    assert.equal(paid.status, 200); assert.equal(paid.result.data.status, 'paid');
    assert.equal((await call(`/checkout/${handle.id}`)).result.data.paymentStatus, 'paid');
    assert.equal((await call(`/checkout/${handle.id}/cancel`, { method: 'POST' })).status, 409);
    const abandoned = (await call('/checkout', { method: 'POST', body, attempt: 'http-attempt-cancel' })).result.data;
    t.mock.method(gateway, 'verify', async reference => ({ reference, status: 'failed' }));
    assert.equal((await call(`/checkout/${abandoned.id}/cancel`, { method: 'POST' })).result.data.status, 'cancelled');
    assert.equal((await call(`/checkout/${abandoned.id}/cancel`, { method: 'POST' })).result.data.status, 'cancelled');
    assert.equal((await SubProduct.findById(sp).lean()).availableStock, 7);
    assert.ok((await ApiKey.findById(issued.key._id).lean()).lastUsedAt);
    await ApiKey.updateOne({ _id: issued.key._id }, { $set: { revokedAt: new Date() } });
    assert.equal((await call('/store')).status, 401);
    await ApiKey.updateOne({ _id: readOnly.key._id }, { $set: { expiresAt: new Date(0) } });
    assert.equal((await call('/store', { secret: readOnly.secret })).status, 401);
  });

});
