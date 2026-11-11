// __tests__/subproductDetailStats.mongo.test.js
//
// The rule this file exists to protect: GET /api/subproducts/:id (the
// create/edit page the toolbar lives on) must return Purchased/Sold counters
// computed from Orders and PurchaseOrders — the same sources its drill-down
// panels read — not from the stale SubProduct document counters
// (totalSold: POS-only increments; purchaseCount: never incremented).
//
// Reproduction of the 2026-11-11 report: Sunblessed Vinho Branco showed
// "Purchased 0 / Sold 0" while its purchase history held 1,200 units and its
// sales history 6 orders.
//
// Run:
//   DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
//     node --test __tests__/subproductDetailStats.mongo.test.js

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { connectVenueMongo } = require('./helpers/venueMongo');
const subProductService = require('../services/subproduct.service');

const oid = () => new mongoose.Types.ObjectId();

test('detail response stamps sold units/revenue and purchased units from orders and POs', async (t) => {
  await connectVenueMongo(t);
  const db = mongoose.connection.db;

  const tenantId = oid();
  const otherTenantId = oid();
  const productId = oid();
  const subProductId = oid();
  const otherSubProductId = oid();

  await db.collection('tenants').insertMany([
    {
      _id: tenantId,
      name: 'Stats Tenant',
      slug: 'stats-tenant',
      status: 'approved',
      isActive: true,
      plan: 'starter',
      subscriptionStatus: 'active',
      revenueModel: 'commission',
      commissionPercentage: 13,
    },
    {
      _id: otherTenantId,
      name: 'Other Tenant',
      slug: 'other-tenant',
      status: 'approved',
      isActive: true,
      plan: 'starter',
      subscriptionStatus: 'active',
      revenueModel: 'commission',
      commissionPercentage: 13,
    },
  ]);

  await db.collection('products').insertOne({
    _id: productId,
    name: 'Sunblessed Vinho Branco',
    slug: 'sunblessed-vinho-branco',
    type: 'wine',
    status: 'approved',
    isPublished: true,
  });

  await db.collection('subproducts').insertOne({
    _id: subProductId,
    product: productId,
    tenant: tenantId,
    sku: 'STATS-1',
    status: 'active',
    isPublished: true,
    totalStock: 1086,
    availableStock: 1086,
    baseSellingPrice: 12200,
    sizes: [],
  });
  await db.collection('subproducts').insertOne({
    _id: otherSubProductId,
    product: productId,
    tenant: tenantId,
    sku: 'STATS-2',
    status: 'active',
    isPublished: true,
    sizes: [],
  });

  // Orders: two lines for our subproduct (2 + 3 units), one line for a
  // DIFFERENT subproduct (must not leak into the totals).
  await db.collection('orders').insertOne({
    items: [
      {
        subproduct: subProductId,
        product: productId,
        quantity: 2,
        priceAtPurchase: 12200,
        itemSubtotal: 24400,
      },
      {
        subproduct: subProductId,
        product: productId,
        quantity: 3,
        priceAtPurchase: 12200,
        itemSubtotal: 36600,
      },
      {
        subproduct: otherSubProductId,
        product: productId,
        quantity: 9,
        priceAtPurchase: 12200,
        itemSubtotal: 109800,
      },
    ],
    placedAt: new Date('2026-09-15T10:00:00Z'),
  });

  // Purchase orders: ours 1,200 units received, plus a draft of 10 (the PO
  // panel's "All" view counts every status), plus ANOTHER TENANT's PO for the
  // same subproduct (must stay out — POs are tenant-scoped documents).
  await db.collection('purchaseorders').insertMany([
    {
      tenant: tenantId,
      status: 'received',
      items: [
        { subProductId: subProductId, quantity: 1200, unitPrice: 6000, totalPrice: 7200000 },
      ],
    },
    {
      tenant: tenantId,
      status: 'draft',
      items: [
        { subProductId: subProductId, quantity: 10, unitPrice: 6000, totalPrice: 60000 },
      ],
    },
    {
      tenant: otherTenantId,
      status: 'received',
      items: [
        { subProductId: subProductId, quantity: 999, unitPrice: 6000, totalPrice: 5994000 },
      ],
    },
  ]);

  const detail = await subProductService.getSubProduct(String(subProductId), String(tenantId));

  assert.equal(detail.totalSold, 5, 'sold units must come from order lines (2+3), not the stale POS counter');
  assert.equal(detail.totalRevenue, 61000, 'sold revenue must come from order line subtotals');
  assert.equal(detail.purchaseCount, 1210, 'purchased units must come from PO lines of THIS tenant, every status');
});
