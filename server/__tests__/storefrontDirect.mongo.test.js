'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const uri = process.env.DRINKSHARBOUR_DIRECT_TEST_MONGO_URI;
test('separate website shares physical stock and preserves its own payment and customer authority', { skip: !uri }, async t => {
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:29128\/drinks_direct_test_[\w]+\?replicaSet=storefrontDirect$/);
  const ownUri = uri.replace('?', `_${process.pid}?`);
  await mongoose.connect(ownUri, { serverSelectionTimeoutMS: 10000 });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const Tenant = require('../models/Tenant'), Warehouse = require('../models/Warehouse');
  const Product = require('../models/Product'), SubProduct = require('../models/SubProduct'), Size = require('../models/Size');
  const Stock = require('../models/WarehouseStock'), Order = require('../models/Order');
  const Channel = require('../models/StorefrontChannel'), Hold = require('../models/OnlineStockReservation');
  const Checkout = require('../models/IntegrationCheckout'), keys = require('../services/apiKey.service');
  const catalog = require('../services/storefrontCatalog.service'), checkout = require('../services/storefrontCheckout.service');
  const settle = require('../services/storefrontSettlement'), gateway = require('../services/storefrontGateway');
  const oid = () => new mongoose.Types.ObjectId();
  const tenantId = oid(), warehouse = oid(), foreign = oid(), customer = oid(), otherCustomer = oid(), p = oid(), sp = oid(), sz = oid();
  await Promise.all([Channel.init(), Hold.init(), Checkout.init(), Order.init(), Stock.init()]);
  await Tenant.collection.insertOne({ _id: tenantId, name: 'Separate Website', slug: 'direct-test', status: 'approved',
    subscriptionStatus: 'active', plan: 'pro', revenueModel: 'commission', commissionPercentage: 13, storefrontIntegrationEnabled: true });
  await Warehouse.create({ _id: warehouse, tenant: tenantId, name: 'Shop', code: 'SHOP', isActive: true });
  const tenant = await Tenant.findById(tenantId).lean();
  const issued = await keys.issueKey(tenant, oid(), { name: 'Separate website', scopes: ['storefront:read', 'checkout:write'] });
  await Channel.create({ tenant: tenantId, apiKey: issued.key._id, warehouse, code: 'WYN_WEBSITE', paymentAccount: 'DIRECT_TEST',
    returnOrigins: ['https://website.example.test'], enabled: true, configuredBy: oid() });
  await Product.collection.insertOne({ _id: p, name: 'Bottle', slug: 'direct-bottle', tracksBatch: false, status: 'approved', isPublished: true });
  await SubProduct.collection.insertOne({ _id: sp, tenant: tenantId, product: p, sku: 'DIRECT', status: 'active', isPublished: true,
    visibleInOnlineStore: true, availableStock: 100, totalStock: 100, baseSellingPrice: 1200, costPrice: 500 });
  await Size.collection.insertOne({ _id: sz, subproduct: sp, tenant: tenantId, status: 'active', availability: 'available', stock: 100,
    availableStock: 100, size: '75cl', sellingPrice: 1200, costPrice: 500 });
  await Stock.create({ tenant: tenantId, warehouse, subProduct: sp, size: sz, currentQuantity: 2, reservedQuantity: 0 });
  process.env.STOREFRONT_PAYSTACK_DIRECT_TEST_SECRET_KEY = 'test-only';
  t.after(() => { delete process.env.STOREFRONT_PAYSTACK_DIRECT_TEST_SECRET_KEY; });
  t.mock.method(gateway, 'initialize', async row => ({ reference: row.reference, authorizationUrl: 'https://checkout.paystack.com/test' }));
  t.mock.method(require('../services/accounting.orders'), 'captureOrderAccounting', async () => {});
  const trusted = await require('../services/storefrontChannels').attachChannel(tenant, issued.key);
  const body = { items: [{ subProductId: String(sp), sizeId: String(sz), quantity: 1 }], shippingMethod: 'pickup',
    customer: { firstName: 'Buyer', lastName: 'One', email: 'buyer@example.test', phone: '08000000000' },
    returnUrl: 'https://website.example.test/thanks' };
  let made;
  await t.test('catalogue ignores aggregate stock in favor of configured location', async () => {
    assert.equal((await catalog.getProduct(trusted, String(sp))).variants[0].availableStock, 2);
  });
  await t.test('checkout snapshots channel/account/customer and reserves without reducing physical stock', async () => {
    made = await checkout.createCheckout(trusted, issued.key, body, 'direct-request-1', { customerId: customer });
    const row = await Checkout.findById(made.id).lean(), order = await Order.findById(made.orderId).lean();
    assert.equal(row.paymentAccount, 'DIRECT_TEST'); assert.equal(order.salesChannel, 'WYN_WEBSITE');
    assert.equal(order.settlementOwner, 'tenant'); assert.equal(String(order.user), String(customer));
    assert.equal(order.platformCommissionTotal, 0); assert.equal(order.items[0].tenantRevenueShare, 1200);
    const balance = await Stock.findOne({ tenant: tenantId }).lean();
    assert.equal(balance.currentQuantity, 2); assert.equal(balance.reservedQuantity, 1);
    assert.equal(await Hold.countDocuments({ order: order._id, state: 'reserved' }), 1);
  });
  await t.test('retries preserve checkout and authenticated customer identity', async () => {
    assert.equal((await checkout.createCheckout(trusted, issued.key, body, 'direct-request-1', { customerId: customer })).id, made.id);
    await assert.rejects(checkout.createCheckout(trusted, issued.key, body, 'direct-request-1', { customerId: otherCustomer }), e => e.statusCode === 409);
    assert.equal(await Order.countDocuments(), 1);
  });
  await t.test('wrong payment account cannot settle even when amount and reference match', async () => {
    await assert.rejects(settle.settlePayment(made.reference, { reference: made.reference, status: 'success', amount: 1200, currency: 'NGN', paymentAccount: 'FOREIGN' }), e => e.statusCode === 409);
    await settle.settlePayment(made.reference, { reference: made.reference, status: 'success', amount: 1200, currency: 'NGN', paymentAccount: 'DIRECT_TEST' });
  });
  await t.test('another location consumer cannot issue a website-reserved final unit', async () => {
    const sale = { warehouseId: warehouse, subProduct: sp, size: sz, quantity: 1 };
    await require('../services/warehouse.service').sellStock(sale, customer, tenantId);
    await assert.rejects(require('../services/warehouse.service').sellStock(sale, customer, tenantId), /reserved stock/i);
    const attempts = await Promise.allSettled([2, 3].map(n => checkout.createCheckout(trusted, issued.key, body, `direct-request-${n}`)));
    assert.equal(attempts.filter(x => x.status === 'fulfilled').length, 0);
  });
  await t.test('fulfillment consumes its own hold once with movement evidence', async () => {
    const service = require('../services/storefrontLocationOrders');
    const order = await Order.findById(made.orderId);
    await service.applyStatus(order, 'shipped', { tenantId: String(tenantId), actorId: customer });
    await service.applyStatus(await Order.findById(made.orderId), 'shipped', { tenantId: String(tenantId), actorId: customer });
    const balance = await Stock.findOne({ tenant: tenantId }).lean();
    assert.equal(balance.currentQuantity, 0); assert.equal(balance.reservedQuantity, 0);
    assert.equal(await require('../models/WarehouseMovement').countDocuments({ tenant: tenantId, reference: /^online:/ }), 1);
    await assert.rejects(service.applyStatus(await Order.findById(made.orderId), 'cancelled'), /return|refund/i);
  });
  await t.test('order history cannot cross key, tenant or customer boundaries', async () => {
    const service = require('../services/storefrontOrders');
    assert.equal((await service.listOrders(trusted, issued.key, {}, customer)).data.length, 1);
    assert.equal((await service.listOrders(trusted, issued.key, {}, otherCustomer)).data.length, 0);
    assert.equal((await service.listOrders({ _id: foreign }, issued.key, {}, customer)).data.length, 0);
    assert.equal((await service.listOrders(trusted, { _id: oid() }, {}, customer)).data.length, 0);
  });
  await t.test('marketplace and website race for the same last location unit, and cancellation releases only its hold', async () => {
    await Stock.updateOne({ tenant: tenantId }, { $set: { currentQuantity: 1 } });
    const data = { orderNumber: 'MARKET-TEST', tenant: tenantId, currency: 'NGN', paymentMethod: 'card', subtotal: 1200, totalAmount: 1200,
      items: [{ tenant: tenantId, product: p, subproduct: sp, size: sz, quantity: 1, priceAtPurchase: 1200, itemSubtotal: 1200,
        tenantRevenueShare: 1044, platformCommission: 156 }], paymentStatus: 'pending', status: 'pending' };
    const service = require('../services/storefrontLocationOrders');
    const results = await Promise.allSettled([service.createMappedOrder(data), checkout.createCheckout(trusted, issued.key, body, 'race-with-marketplace')]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const market = results[0].status === 'fulfilled' ? results[0].value : null;
    if (market) {
      assert.equal(market.salesChannel, 'DRINKSHARBOUR_NG'); assert.equal(market.paymentStatus, 'pending');
      assert.equal(market.items[0].platformCommission, 156);
      await service.applyStatus(market, 'cancelled');
    } else {
      const website = results[1].value;
      t.mock.method(gateway, 'verify', async reference => ({ reference, status: 'failed', paymentAccount: 'DIRECT_TEST' }));
      await settle.cancelCheckout(trusted, issued.key, website.id);
      await settle.cancelCheckout(trusted, issued.key, website.id);
    }
    const balance = await Stock.findOne({ tenant: tenantId }).lean();
    assert.equal(balance.currentQuantity, 1); assert.equal(balance.reservedQuantity, 0);
  });
  await t.test('real customer order endpoints require website identity and never expose costs or other customer orders', async () => {
    const express = require('express'), crypto = require('crypto');
    const identity = require('../utils/customerIdentity').customerIdentity(tenant);
    await require('../models/User').collection.insertOne({ _id: customer, ...identity, status: 'active', firstName: 'Buyer', email: 'buyer@example.test' });
    const session = await require('../services/tenantCustomer.sessions').issue(tenant, { _id: customer, tenant: tenantId, ...identity, firstName: 'Buyer', email: 'buyer@example.test' });
    const app = express(); app.use(express.json({ verify: (req, res, bytes) => { req.rawBody = bytes; } }));
    app.use('/api/integrations/v1', require('../routes/storefrontIntegration.routes'));
    const server = await new Promise((resolve, reject) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); s.on('error', reject); });
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}/api/integrations/v1`;
    const call = (path, extra = {}) => fetch(base + path, { ...extra, headers: { Authorization: `Bearer ${issued.secret}`, ...extra.headers } });
    assert.equal((await call('/customers/orders')).status, 401);
    const response = await call('/customers/orders', { headers: { 'x-customer-token': session.token } });
    assert.equal(response.status, 200); const result = await response.json();
    assert.equal(result.data.length, 1); assert.doesNotMatch(JSON.stringify(result), /costPrice|vendorPrice|tenantRevenueShare|paymentAccount/);
    const one = await call(`/customers/orders/${made.orderId}`, { headers: { 'x-customer-token': session.token } });
    assert.equal(one.status, 200);
    const event = JSON.stringify({ event: 'charge.success', data: { reference: made.reference } });
    const signature = crypto.createHmac('sha512', 'test-only').update(event).digest('hex');
    t.mock.method(gateway, 'verify', async reference => ({ reference, status: 'success', amount: 1200, currency: 'NGN', paymentAccount: 'DIRECT_TEST' }));
    const callback = await call('/webhooks/paystack/DIRECT_TEST', { method: 'POST', body: event,
      headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature } });
    assert.equal(callback.status, 200);
  });
  await t.test('tracked batches and stock release once, and late payment cannot reacquire cancelled stock', async () => {
    const p2 = oid(), sp2 = oid(), sz2 = oid(), batch = oid();
    await Product.collection.insertOne({ _id: p2, name: 'Tracked bottle', tracksBatch: true, status: 'approved', isPublished: true });
    await SubProduct.collection.insertOne({ _id: sp2, tenant: tenantId, product: p2, status: 'active', isPublished: true, baseSellingPrice: 1200 });
    await Size.collection.insertOne({ _id: sz2, tenant: tenantId, subproduct: sp2, status: 'active', availability: 'available', sellingPrice: 1200 });
    await Stock.create({ tenant: tenantId, warehouse, subProduct: sp2, size: sz2, currentQuantity: 2, reservedQuantity: 0 });
    const Batch = require('../models/WarehouseBatch');
    await Batch.collection.insertOne({ _id: batch, tenant: tenantId, warehouse, subProduct: sp2, size: sz2, quantity: 2,
      batchNumber: 'DIRECT-LOT', receivedDate: new Date(), expiryDate: new Date(Date.now() + 86400000) });
    const tracked = await checkout.createCheckout(trusted, issued.key, { ...body, items: [{ subProductId: String(sp2), sizeId: String(sz2), quantity: 1 }] }, 'tracked-lot-request');
    assert.equal((await Batch.findById(batch).lean()).quantity, 1);
    t.mock.method(gateway, 'verify', async reference => ({ reference, status: 'failed', paymentAccount: 'DIRECT_TEST' }));
    await settle.cancelCheckout(trusted, issued.key, tracked.id);
    await settle.cancelCheckout(trusted, issued.key, tracked.id);
    assert.equal((await Batch.findById(batch).lean()).quantity, 2);
    await settle.settlePayment(tracked.reference, { reference: tracked.reference, status: 'success', amount: 1200, currency: 'NGN', paymentAccount: 'DIRECT_TEST' });
    assert.equal((await Checkout.findById(tracked.id).lean()).state, 'needs_review');
    assert.equal((await Stock.findOne({ subProduct: sp2 }).lean()).reservedQuantity, 0);
  });
  await t.test('channel report includes only this website key verified payments, excluding late-payment review and marketplace orders', async () => {
    const rows = await require('../services/storefrontOrders').salesReport(trusted, issued.key);
    assert.equal(rows.length, 1); assert.equal(rows[0].salesChannel, 'WYN_WEBSITE');
    assert.equal(rows[0].currency, 'NGN'); assert.equal(rows[0].paidOrderCount, 1);
    assert.equal(rows[0].paidOrderTotal, 1200); assert.equal(rows[0].platformCommission, 0);
  });
  await t.test('operator preview does not mutate mapping and apply records reviewed changes', async () => {
    const actorId = oid();
    await require('../models/User').collection.insertOne({ _id: actorId, role: 'super_admin', status: 'active' });
    const config = { tenant: String(tenantId), apiKey: String(issued.key._id), warehouse: String(warehouse), code: 'WYN_WEBSITE',
      paymentAccount: 'DIRECT_TEST', returnOrigins: ['https://website.example.test'], enabled: false };
    const service = require('../services/storefrontConfiguration');
    await service.configure(config, { actorId: String(actorId) });
    assert.equal((await Channel.findOne({ tenant: tenantId }).lean()).enabled, true);
    await service.configure(config, { actorId: String(actorId), apply: true });
    assert.equal((await Channel.findOne({ tenant: tenantId }).lean()).enabled, false);
    assert.equal(await require('../models/AuditLog').countDocuments({ action: 'STOREFRONT_CHANNEL_CONFIGURE', targetTenantId: tenantId }), 1);
    await assert.rejects(require('../services/storefrontChannels').attachChannel(tenant, issued.key), e => e.statusCode === 403);
  });
});
