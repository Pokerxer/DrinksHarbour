'use strict';
// Gift checkout — order-route behaviour over a real (disposable) mongo:
// validation edges from the shared contract, the packaging-SKU cross-check
// (422s), and gift persistence on created orders.
// Contract: docs/superpowers/specs/2026-10-27-gift-checkout-design.md
// Run with: DRINKSHARBOUR_VENUE_TEST_MONGO_URI=mongodb://127.0.0.1:29127/drinks_venue_test_gift?replicaSet=venuePhase0

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');
const { clearGiftPackagingCache, lagosDayStart } = require('../config/giftPackaging');

const DAY_MS = 24 * 60 * 60 * 1000;
const lagosDate = (days) => new Date(lagosDayStart() + days * DAY_MS).toISOString().slice(0, 10);

test('gift checkout: validation edges, packaging cross-check and persistence', { skip: !uri }, async (t) => {
  await connectVenueMongo(t, 'gift_checkout');

  // Keep notification transports out of the network; every send* resolves ok.
  for (const name of ['email', 'sms', 'whatsapp']) {
    const transport = require(`../services/${name}.service`);
    for (const method of Object.keys(transport).filter(key => key.startsWith('send'))) {
      if (typeof transport[method] === 'function') t.mock.method(transport, method, async () => ({ success: true }));
    }
  }

  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'gift-checkout-fixture-only';
  t.after(() => { if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret; });

  const oid = () => new mongoose.Types.ObjectId();
  const tenant = oid();
  const packagingProduct = oid();
  const packagingSp = oid();
  const regularProduct = oid();
  const regularSp = oid();
  const warehouse = oid();
  const regularSize = oid();
  const packagingSize = oid();

  await require('../models/Tenant').collection.insertOne({
    _id: tenant, name: 'Gift fixture merchant', status: 'approved', isActive: true,
    subscriptionStatus: 'active', revenueModel: 'commission', markupPercentage: 25, commissionPercentage: 12,
  });
  await require('../models/Product').collection.insertOne({
    _id: packagingProduct, name: 'Gift packaging', slug: 'gift-packaging-fixture', type: 'accessory', tracksBatch: false,
    isAlcoholic: false, isGiftPackaging: true, status: 'pending', isPublished: false, platformMarkup: 15,
  });
  await require('../models/Product').collection.insertOne({
    _id: regularProduct, name: 'Fixture bottle', type: 'beer', tracksBatch: false, isAlcoholic: false,
    status: 'approved', isPublished: true, platformMarkup: 15,
  });
  const SP = require('../models/SubProduct');
  await SP.collection.insertOne({
    _id: packagingSp, tenant, product: packagingProduct, sku: 'GIFT_PACKAGING_FIXTURE', status: 'active',
    isPublished: true, visibleInOnlineStore: true, sellWithoutSizeVariants: true,
    baseSellingPrice: 5000, basePriceBeforePricelist: 5000, costPrice: 4000, platformMarkupOverridePct: 0,
    availableStock: 100, totalStock: 100, reservedStock: 0,
  });
  await SP.collection.insertOne({
    _id: regularSp, tenant, product: regularProduct, sku: 'FIXTURE_BOTTLE', status: 'active',
    isPublished: true, visibleInOnlineStore: true, sellWithoutSizeVariants: true,
    baseSellingPrice: 1000, basePriceBeforePricelist: 1000, costPrice: 400,
    availableStock: 50, totalStock: 50, reservedStock: 0,
  });

  await require('../models/Warehouse').create({
    _id: warehouse, tenant, name: 'Gift location', code: 'GIFT', isActive: true, isDefault: true,
  });
  for (const [subproduct, size, sellingPrice] of [[regularSp, regularSize, 1000], [packagingSp, packagingSize, 5000]]) {
    await require('../models/Size').collection.insertOne({
      _id: size, tenant, subproduct, size: 'Single', sellingPrice, stock: 100, availableStock: 100,
    });
    await require('../models/WarehouseStock').create({
      tenant, warehouse, subProduct: subproduct, size, currentQuantity: 100, reservedQuantity: 0,
    });
  }
  const app = require('express')();
  app.use(require('express').json());
  app.use('/orders', require('../routes/order.routes'));
  app.use((e, req, res, next) => res.status(e.statusCode || 500).json({ message: e.message }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));

  const customer = { firstName: 'Ada', lastName: 'Obi', email: 'ada@example.test', phone: '08000000001' };
  const shipping = { address: '1 Harbour Way', city: 'Abuja', state: 'FCT', zipCode: '900001', country: 'Nigeria' };
  const basePayload = {
    customer, shipping, paymentMethod: 'cash_on_delivery',
    items: [{ productId: String(regularProduct), subProductId: String(regularSp), sizeId: String(regularSize), quantity: 1, price: 600 }],
    subtotal: 600, shippingFee: 3000, total: 3600,
  };
  const call = async (body, key = `gift-key-${Math.random().toString(36).slice(2)}`) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const giftPayload = (gift, items) => ({
    ...basePayload, ...(items ? { items } : {}), gift,
    subtotal: 5600, total: 8600,
  });
  const packagingItem = { productId: String(packagingProduct), subProductId: String(packagingSp), sizeId: String(packagingSize), quantity: 1, price: 5000 };

  // ── SKU must be resolvable via the cache for most cases; case A first proves
  // the unconfigured-SKU rejection through a bogus tenant pin + cleared cache.
  const bogusTenant = process.env.GIFT_PACKAGING_TENANT_ID;
  process.env.GIFT_PACKAGING_TENANT_ID = String(oid());
  clearGiftPackagingCache();
  const unconfigured = await call(giftPayload({ isGift: true, from: 'Ada', to: 'Chinedu', requestedDeliveryDate: lagosDate(3), packagingRequested: true }));
  assert.equal(unconfigured.status, 422, JSON.stringify(unconfigured.body));
  assert.equal(unconfigured.body.message, 'Gift packaging is not available yet.');
  if (bogusTenant === undefined) delete process.env.GIFT_PACKAGING_TENANT_ID;
  else process.env.GIFT_PACKAGING_TENANT_ID = bogusTenant;
  clearGiftPackagingCache();

  // ── Validation edges (route-level, all 400) ───────────────────────────────
  const badCases = [
    ['bad date format', { isGift: true, from: 'Ada', to: 'Chinedu', requestedDeliveryDate: '01/02/2026', packagingRequested: false }],
    ['past date', { isGift: true, from: 'Ada', to: 'Chinedu', requestedDeliveryDate: lagosDate(-1), packagingRequested: false }],
    ['today is not allowed', { isGift: true, from: 'Ada', to: 'Chinedu', requestedDeliveryDate: lagosDate(0), packagingRequested: false }],
    ['date beyond 180 days', { isGift: true, from: 'Ada', to: 'Chinedu', requestedDeliveryDate: lagosDate(181), packagingRequested: false }],
    ['impossible calendar date', { isGift: true, from: 'Ada', to: 'Chinedu', requestedDeliveryDate: '2026-02-31', packagingRequested: false }],
    ['invalid recipient phone', { isGift: true, from: 'Ada', to: 'Chinedu', recipientPhone: 'call the office', requestedDeliveryDate: lagosDate(3), packagingRequested: false }],
    ['missing to', { isGift: true, from: 'Ada', to: '', requestedDeliveryDate: lagosDate(3), packagingRequested: false }],
    ['from over 80 chars', { isGift: true, from: 'x'.repeat(81), to: 'Chinedu', requestedDeliveryDate: lagosDate(3), packagingRequested: false }],
    ['message over 500 chars', { isGift: true, from: 'Ada', to: 'Chinedu', message: 'y'.repeat(501), requestedDeliveryDate: lagosDate(3), packagingRequested: false }],
    ['isGift not true', { isGift: false, from: 'Ada', to: 'Chinedu', requestedDeliveryDate: lagosDate(3), packagingRequested: false }],
    ['packagingRequested not boolean', { isGift: true, from: 'Ada', to: 'Chinedu', requestedDeliveryDate: lagosDate(3), packagingRequested: 'yes' }],
  ];
  for (const [label, gift] of badCases) {
    const result = await call(giftPayload(gift));
    assert.equal(result.status, 400, `${label}: ${JSON.stringify(result.body)}`);
  }

  // ── packagingRequested without the SKU cart line → 422 ────────────────────
  const withoutLine = await call(giftPayload({ isGift: true, from: 'Ada', to: 'Chinedu', requestedDeliveryDate: lagosDate(3), packagingRequested: true }));
  assert.equal(withoutLine.status, 422, JSON.stringify(withoutLine.body));
  assert.equal(withoutLine.body.message, 'Add the gift packaging item to your cart, or untick gift packaging.');

  // ── packagingRequested WITH the SKU cart line → 201, gift persisted ───────
  const withLine = await call(giftPayload(
    { isGift: true, from: '  Ada  ', to: 'Chinedu', recipientPhone: '+234 803 123 4567', message: 'Happy birthday!', requestedDeliveryDate: lagosDate(3), packagingRequested: true },
    [...basePayload.items, packagingItem],
  ));
  assert.equal(withLine.status, 201, JSON.stringify(withLine.body));
  const saved = await require('../models/Order').findById(withLine.body.data.order._id).lean();
  assert.deepEqual(saved.gift, {
    isGift: true,
    from: 'Ada',
    to: 'Chinedu',
    recipientPhone: '+2348031234567',
    message: 'Happy birthday!',
    requestedDeliveryDate: lagosDate(3),
    packagingRequested: true,
  });

  assert.equal(saved.shippingAddress.phone, customer.phone);
  const updates = await require('../utils/orderUtils').resolveOrderRecipient(saved);
  assert.equal(updates.phone, customer.phone);

  // ── Gift WITHOUT packaging → 201, packagingRequested false, no SKU needed ──
  const noPackaging = await call(giftPayload({ isGift: true, from: 'Ada', to: 'Chinedu', requestedDeliveryDate: lagosDate(3), packagingRequested: false }));
  assert.equal(noPackaging.status, 201, JSON.stringify(noPackaging.body));
  const noPackagingOrder = await require('../models/Order').findById(noPackaging.body.data.order._id).lean();
  assert.equal(noPackagingOrder.gift.packagingRequested, false);
  assert.equal(noPackagingOrder.gift.to, 'Chinedu');

  // ── Normal order (no gift block) → gift stays null ────────────────────────
  const normal = await call(basePayload);
  assert.equal(normal.status, 201, JSON.stringify(normal.body));
  const normalOrder = await require('../models/Order').findById(normal.body.data.order._id).lean();
  assert.equal(normalOrder.gift ?? null, null);
});
