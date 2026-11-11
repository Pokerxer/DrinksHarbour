// Tenant marketplace-sales aggregate acceptance test.
//
// The denormalised Tenant.marketplaceSalesTotal / marketplaceSalesOrders must
// be derived ONLY from posted sales_revenue journals with source 'marketplace'
// — the same rows settlement statements pay out on. Storefront/POS/venue
// journals, draft entries and refunds must never move the number, and every
// journal posting keeps the aggregate current via the JournalEntry post-save
// hook.
//
// Behavioral, not static: drives the real service + model hooks against the
// disposable venuePhase0 replica-set Mongo, same convention as
// storeReviews.mongo.test.js.
//
// Run:
//   DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
//     node --test __tests__/marketplaceSales.mongo.test.js

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { connectVenueMongo } = require('./helpers/venueMongo');
const { recomputeMarketplaceSales } = require('../services/marketplaceSales.service');
require('../models/Tenant');
require('../models/JournalEntry');

const oid = () => new mongoose.Types.ObjectId();
const TENANT_A = oid();
const TENANT_B = oid();

function salesLine(net) {
  return [{ account: '4000', debit: 0, credit: net }, { account: '1300', debit: net, credit: 0 }];
}

async function postJournal(tenant, { source = 'marketplace', status = 'posted', entryType = 'sales_revenue', ref = oid(), net = 1000 }) {
  const JournalEntry = mongoose.model('JournalEntry');
  return JournalEntry.create({
    tenant,
    refDoc: ref,
    refDocType: 'Order',
    entryType,
    source,
    status,
    lines: salesLine(net),
    memo: 'test posting',
  });
}

async function readTenant(id) {
  const doc = await mongoose.model('Tenant').collection.findOne({ _id: id });
  return { total: doc.marketplaceSalesTotal ?? null, orders: doc.marketplaceSalesOrders ?? null };
}

test('marketplace sales aggregate: correct source, correct exclusions, hook-driven updates', async (t) => {
  await connectVenueMongo(t, 'marketplaceSales');

  await mongoose.model('Tenant').collection.insertMany([
    { _id: TENANT_A, name: 'Sales A', slug: 'sales-a', status: 'approved', isActive: true, plan: 'starter', subscriptionStatus: 'active' },
    { _id: TENANT_B, name: 'Sales B', slug: 'sales-b', status: 'approved', isActive: true, plan: 'starter', subscriptionStatus: 'active' },
  ]);

  // Tenant A: two paid marketplace orders (₦5,000 + ₦3,000).
  await postJournal(TENANT_A, { ref: oid(), net: 5000 });
  await postJournal(TENANT_A, { ref: oid(), net: 3000 });
  // Tenant B: one paid marketplace order (₦2,000).
  await postJournal(TENANT_B, { ref: oid(), net: 2000 });
  // Exclusions: storefront + POS revenue, a draft entry and a refund must
  // never move the aggregate.
  await postJournal(TENANT_A, { ref: oid(), net: 99999, source: 'storefront' });
  await postJournal(TENANT_A, { ref: oid(), net: 99999, source: 'pos' });
  await postJournal(TENANT_A, { ref: oid(), net: 99999, status: 'draft' });
  await postJournal(TENANT_A, { ref: oid(), entryType: 'refund', source: 'merchant_refund', net: 99999 });

  // The post-save hook already recomputed on every create — assert the
  // hook-driven state first.
  let a = await readTenant(TENANT_A);
  assert.equal(a.total, 8000);
  assert.equal(a.orders, 2);
  let b = await readTenant(TENANT_B);
  assert.equal(b.total, 2000);
  assert.equal(b.orders, 1);

  // A full recompute (backfill path) reproduces the same numbers.
  await recomputeMarketplaceSales();
  a = await readTenant(TENANT_A);
  assert.equal(a.total, 8000);
  assert.equal(a.orders, 2);

  // A subset recompute resets a tenant with no marketplace journals to 0/0
  // instead of leaving stale values behind.
  await mongoose.model('Tenant').collection.updateOne({ _id: TENANT_B }, { $set: { marketplaceSalesTotal: 12345, marketplaceSalesOrders: 99 } });
  await recomputeMarketplaceSales({ tenantIds: [TENANT_B] });
  b = await readTenant(TENANT_B);
  assert.equal(b.total, 2000);
  assert.equal(b.orders, 1);

  // A new posting for an otherwise-untracked tenant updates just that tenant.
  const TENANT_C = oid();
  await mongoose.model('Tenant').collection.insertOne({ _id: TENANT_C, name: 'Sales C', slug: 'sales-c', status: 'approved', isActive: true, plan: 'starter', subscriptionStatus: 'active' });
  await postJournal(TENANT_C, { ref: oid(), net: 1500 });
  const c = await readTenant(TENANT_C);
  assert.equal(c.total, 1500);
  assert.equal(c.orders, 1);

  // Hiding the source journal (status change) self-heals on the next posting
  // for that tenant: gross drops to only A's remaining postings.
  await mongoose.model('JournalEntry').collection.updateOne(
    { tenant: TENANT_B, source: 'marketplace', status: 'posted' },
    { $set: { status: 'draft' } }
  );
  await recomputeMarketplaceSales({ tenantIds: [TENANT_B] });
  b = await readTenant(TENANT_B);
  assert.equal(b.total, 0);
  assert.equal(b.orders, 0);
});
