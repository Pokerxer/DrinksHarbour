// server/__tests__/marketplaceSalesOrderBridge.test.js
//
// The marketplace → ERM bridge: when a customer checks out on the main
// platform, each tenant with lines in the cart gets ONE native SalesOrder
// (draft order) that flows through the standard confirm → fulfil pipeline.
//
// Contracts under test:
//   – pricing is FROZEN (frozenPricing → priceOverridden) — the customer
//     already paid the marketplace price; no pricelist/promo re-pricing
//   – payment state reflects money the platform already collected (prepaid
//     → paid with the merchant slice; COD → unpaid)
//   – shipping belongs to the merchant slice only on single-tenant orders
//   – idempotent: a bridged order never creates a second SalesOrder

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId();

const TENANT = oid();
const OTHER_TENANT = oid();
const PRODUCT = oid();
const SUBPRODUCT = oid();
const SIZE = oid();

function makeOrder(over = {}) {
  return {
    _id: oid(),
    orderNumber: 'DH2610280001',
    currency: 'NGN',
    paymentMethod: 'bank_transfer',
    paymentStatus: 'paid',
    shippingFee: 2000,
    taxAmount: 0,
    placedAt: new Date('2026-10-28T09:00:00Z'),
    shippingAddress: {
      fullName: 'Ada Obi', phone: '08030000000', addressLine1: '12 Wuse St',
      city: 'Abuja', state: 'FCT', country: 'Nigeria',
    },
    items: [
      { product: PRODUCT, subproduct: SUBPRODUCT, size: SIZE, tenant: TENANT,
        quantity: 2, priceAtPurchase: 10000, itemSubtotal: 20000, discountAmount: 0,
        // Revenue snapshot — per-LINE payout = what the tenant sold it to
        // the platform for (markup: cost×qty; commission: share of subtotal).
        tenantRevenueShare: 15000, vendorPriceAtPurchase: 7500, tenantRevenueModel: 'markup' },
      // another tenant's line — must never leak into this tenant's SalesOrder
      { product: oid(), subproduct: oid(), tenant: OTHER_TENANT,
        quantity: 5, priceAtPurchase: 500, itemSubtotal: 2500, discountAmount: 0,
        tenantRevenueShare: 1800, vendorPriceAtPurchase: 360, tenantRevenueModel: 'commission' },
    ],
    ...over,
  };
}

function mockNoExisting(t) {
  const SalesOrder = require('../models/SalesOrder');
  t.mock.method(SalesOrder, 'findOne', () => ({
    select: () => ({ lean: async () => null }),
  }));
}

test('bridges a tenant slice as a frozen-price draft SalesOrder', async (t) => {
  mockNoExisting(t);
  const Product = require('../models/Product');
  t.mock.method(Product, 'find', () => ({
    select: () => ({ lean: async () => [{ _id: PRODUCT, name: 'Kopke Fine Tawny Porto' }] }),
  }));
  const svc = require('../services/salesOrder.service');
  let captured;
  t.mock.method(svc, 'createSalesOrderDoc', async (args) => {
    captured = args;
    return { _id: oid(), soNumber: 'SO00099' };
  });

  const { bridgeMarketplaceOrder } = require('../services/marketplaceSalesOrderBridge');
  const result = await bridgeMarketplaceOrder({
    order: makeOrder(),
    tenantId: TENANT,
    customer: { firstName: 'Ada', lastName: 'Obi', email: 'ada@x.ng', phone: '08030000000' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, false);
  assert.equal(result.soNumber, 'SO00099');

  const body = captured.body;
  assert.equal(body.docType, 'order');
  assert.equal(body.paymentStatus, 'paid');
  assert.equal(body.paymentMethod, 'bank_transfer');
  // PRICING CONTRACT: the SO is the tenant's WHOLESALE leg — the price the
  // tenant sold to the platform for (payout), never the customer retail price.
  assert.equal(body.items[0].unitPrice, 7500, 'per-unit payout, not retail 10000');
  assert.equal(body.items[0].discount, 0);
  // Mixed order: payout slice only — no shipping/tax (the platform keeps those).
  assert.equal(body.amountPaid, 15000);
  assert.equal(body.shippingFee, 0);
  assert.ok(body.marketplaceOrderId, 'the bridge must record the marketplace order link');
  // PII CONTRACT: the customer belongs to the platform. The tenant gets a
  // neutral label + the delivery address, never name/phone/email.
  assert.equal(body.customerSnapshot.name, 'Online customer');
  assert.equal(body.customerSnapshot.email || '', '');
  assert.equal(body.customerSnapshot.phone || '', '');
  assert.equal(body.deliveryAddress.name, 'Online customer');
  assert.equal(body.deliveryAddress.phone || '', '');
  assert.equal(body.deliveryAddress.street, '12 Wuse St', 'address survives — the tenant must know where to deliver');
  assert.equal(body.items.length, 1, "the other tenant's line must not leak");
  assert.equal(body.items[0].name, 'Kopke Fine Tawny Porto');
  assert.equal(body.items[0].quantity, 2);
  assert.equal(captured.frozenPricing, true, 'bridge must freeze pricing');
});

test('single-tenant orders include shipping in the merchant slice', async (t) => {
  mockNoExisting(t);
  const Product = require('../models/Product');
  t.mock.method(Product, 'find', () => ({
    select: () => ({ lean: async () => [] }),
  }));
  const svc = require('../services/salesOrder.service');
  let captured;
  t.mock.method(svc, 'createSalesOrderDoc', async (args) => {
    captured = args;
    return { _id: oid(), soNumber: 'SO00100' };
  });

  const order = makeOrder();
  order.items = order.items.filter((i) => String(i.tenant) === String(TENANT));

  const { bridgeMarketplaceOrder } = require('../services/marketplaceSalesOrderBridge');
  await bridgeMarketplaceOrder({ order, tenantId: TENANT, customer: { email: 'a@b.ng' } });

  // Single-tenant order: still the tenant's payout leg — the customer's
  // shipping fee belongs to the platform, not to the tenant's sale.
  assert.equal(captured.body.shippingFee, 0);
  assert.equal(captured.body.amountPaid, 15000);
  assert.equal(captured.body.customerSnapshot.name, 'Online customer');
});

test('is idempotent — an already-bridged order never creates twice', async (t) => {
  const SalesOrder = require('../models/SalesOrder');
  t.mock.method(SalesOrder, 'findOne', () => ({
    select: () => ({ lean: async () => ({ soNumber: 'SO00042' }) }),
  }));
  const svc = require('../services/salesOrder.service');
  const create = t.mock.method(svc, 'createSalesOrderDoc', async () => {
    throw new Error('must not be called');
  });

  const { bridgeMarketplaceOrder } = require('../services/marketplaceSalesOrderBridge');
  const result = await bridgeMarketplaceOrder({
    order: makeOrder(), tenantId: TENANT, customer: {},
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.soNumber, 'SO00042');
  assert.equal(create.mock.callCount(), 0);
});

test('COD orders bridge as unpaid', async (t) => {
  mockNoExisting(t);
  const Product = require('../models/Product');
  t.mock.method(Product, 'find', () => ({
    select: () => ({ lean: async () => [] }),
  }));
  const svc = require('../services/salesOrder.service');
  let captured;
  t.mock.method(svc, 'createSalesOrderDoc', async (args) => {
    captured = args;
    return { _id: oid(), soNumber: 'SO00101' };
  });

  const { bridgeMarketplaceOrder } = require('../services/marketplaceSalesOrderBridge');
  await bridgeMarketplaceOrder({
    order: makeOrder({ paymentStatus: 'pending', paymentMethod: 'cash_on_delivery' }),
    tenantId: TENANT,
    customer: {},
  });

  assert.equal(captured.body.paymentStatus, 'unpaid');
  assert.equal(captured.body.amountPaid, 0);
});

test('orders without this tenant’s lines are skipped', async (t) => {
  const svc = require('../services/salesOrder.service');
  const create = t.mock.method(svc, 'createSalesOrderDoc', async () => {
    throw new Error('must not be called');
  });

  const { bridgeMarketplaceOrder } = require('../services/marketplaceSalesOrderBridge');
  const result = await bridgeMarketplaceOrder({
    order: makeOrder(), tenantId: oid(), customer: {},
  });

  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
  assert.equal(create.mock.callCount(), 0);
});
