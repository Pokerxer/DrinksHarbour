// Merchant sales-summary endpoint acceptance test (merchantOrder.routes).
//
// Tenant roles read their own JWT tenant's marketplace-sales aggregate;
// platform roles must name a tenant slug explicitly; unknown slugs 404.
//
// Run:
//   DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
//     node --test __tests__/merchantSalesSummary.mongo.test.js

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { connectVenueMongo } = require('./helpers/venueMongo');
const {
  startRouter,
  mockAuthUser,
  ROLE_USERS,
  TENANT_ID,
} = require('./helpers/routeAuthHarness');
const merchantOrderRouter = require('../routes/merchantOrder.routes');
require('../models/Tenant');

const oid = () => new mongoose.Types.ObjectId();

async function seed() {
  const Tenant = mongoose.model('Tenant');
  await Tenant.collection.insertMany([
    {
      _id: TENANT_ID,
      name: 'Summary Tenant',
      slug: 'summary-tenant',
      status: 'approved',
      isActive: true,
      plan: 'starter',
      subscriptionStatus: 'active',
      marketplaceSalesTotal: 28500,
      marketplaceSalesOrders: 1,
    },
    {
      _id: oid(),
      name: 'Other Tenant',
      slug: 'other-tenant',
      status: 'approved',
      isActive: true,
      plan: 'starter',
      subscriptionStatus: 'active',
      marketplaceSalesTotal: 5000,
      marketplaceSalesOrders: 2,
    },
  ]);
}

test('merchant sales summary: own tenant, platform override, guards', async (t) => {
  await connectVenueMongo(t, 'merchantSalesSummary');
  await seed();
  const app = await startRouter(merchantOrderRouter, '/api/merchant-orders');
  const url = app.url('/api/merchant-orders/sales-summary');

  try {
    // Unauthenticated → 401
    let res = await fetch(url);
    assert.equal(res.status, 401);

    // Tenant role → their own JWT tenant's aggregate
    res = await fetch(url, { headers: { authorization: mockAuthUser(t, ROLE_USERS.tenant_owner) } });
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    let body = (await res.json()).data;
    assert.equal(body.tenant.slug, 'summary-tenant');
    assert.equal(body.marketplaceSalesTotal, 28500);
    assert.equal(body.marketplaceSalesOrders, 1);

    // Platform role WITH a JWT tenant resolves their own tenant (same rule as
    // tenant roles).
    res = await fetch(url, { headers: { authorization: mockAuthUser(t, ROLE_USERS.super_admin) } });
    assert.equal(res.status, 200);
    body = (await res.json()).data;
    assert.equal(body.tenant.slug, 'summary-tenant');
    assert.equal(body.marketplaceSalesTotal, 28500);
    assert.equal(body.marketplaceSalesOrders, 1);

    // Platform role with NO JWT tenant and no slug → explicit error, never
    // another tenant's data.
    const platformless = { _id: new mongoose.Types.ObjectId(), email: 'sa2@test.local', role: 'super_admin', tenant: null, status: 'active' };
    res = await fetch(url, { headers: { authorization: mockAuthUser(t, platformless) } });
    assert.equal(res.status, 400);

    // Platform role names a tenant slug explicitly → views that tenant
    res = await fetch(`${url}?tenant=other-tenant`, { headers: { authorization: mockAuthUser(t, ROLE_USERS.super_admin) } });
    assert.equal(res.status, 200);
    body = (await res.json()).data;
    assert.equal(body.tenant.slug, 'other-tenant');
    assert.equal(body.marketplaceSalesTotal, 5000);
    assert.equal(body.marketplaceSalesOrders, 2);

    // Unknown slug → 404
    res = await fetch(`${url}?tenant=no-such-tenant`, { headers: { authorization: mockAuthUser(t, ROLE_USERS.super_admin) } });
    assert.equal(res.status, 404);
  } finally {
    await app.close();
  }
});
