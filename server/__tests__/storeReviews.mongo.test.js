// Seller ratings (TenantReview) acceptance test.
//
// A customer can only rate a seller store they actually received a delivered
// order from; every rating waits for super-admin moderation before it becomes
// public, and only approved reviews feed the denormalised Tenant.ratingAvg /
// Tenant.ratingCount aggregate shown in the vendors directory.
//
// Behavioral, not static: drives the real store router against the disposable
// venuePhase0 replica-set Mongo, same convention as platformBeverageGate.mongo.test.js.
//
// Run:
//   DRINKSHARBOUR_VENUE_TEST_MONGO_URI='mongodb://127.0.0.1:29127/drinks_venue_test_global?replicaSet=venuePhase0' \
//     node --test __tests__/storeReviews.mongo.test.js

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { connectVenueMongo } = require('./helpers/venueMongo');
const { startRouter, mockAuthUser, ROLE_USERS } = require('./helpers/routeAuthHarness');
const storeRouter = require('../routes/store.routes');

const TENANT = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Rate Tenant',
  slug: 'rate-tenant',
  status: 'approved',
  isActive: true,
  plan: 'starter',
  subscriptionStatus: 'active',
};

// The reviewed-by user carries a name for the public reviewer shape (protect
// resolves the JWT to this exact object in the harness).
const CUSTOMER = {
  ...ROLE_USERS.customer,
  firstName: 'Ada',
  lastName: 'Obi',
};

async function seed() {
  const oid = () => new mongoose.Types.ObjectId();
  await mongoose.model('Tenant').collection.insertOne({
    ...TENANT,
    ratingAvg: 0,
    ratingCount: 0,
  });
  // The reviewed-by user needs a persisted name for the public reviewer shape.
  await mongoose.model('User').collection.insertOne({
    _id: CUSTOMER._id,
    email: CUSTOMER.email,
    role: 'customer',
    status: 'active',
    firstName: CUSTOMER.firstName,
    lastName: CUSTOMER.lastName,
  });
  await mongoose.model('Order').collection.insertOne({
    _id: oid(),
    orderNumber: 'SR-TEST-1',
    user: CUSTOMER._id,
    status: 'delivered',
    paymentMethod: 'paystack',
    subtotal: 5000,
    total: 5000,
    items: [{ tenant: TENANT._id, name: 'Bottle' }],
  });
}

test('seller ratings: public read, verified purchase, moderation, aggregate', async (t) => {
  await connectVenueMongo(t, 'storeReviews');
  await seed();

  const app = await startRouter(storeRouter, '/api/stores');
  const reviewUrl = app.url('/api/stores/rate-tenant/reviews');
  const post = (auth, body) => fetch(reviewUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  });

  try {
    // ── Unauthenticated submissions are rejected ──────────────────────────────
    let res = await post(null, { rating: 5, comment: 'Original bottles, sealed and delivered fast.' });
    assert.equal(res.status, 401);

    // ── No delivered order from this seller → 403 (verified purchase only) ────
    const stranger = { _id: new mongoose.Types.ObjectId(), email: 'stranger@test.local', role: 'customer', tenant: null, status: 'active' };
    res = await post(mockAuthUser(t, stranger), { rating: 5, comment: 'Never bought here but great vibes, trust me.' });
    assert.equal(res.status, 403);

    // ── A customer with a delivered order from this seller can rate ───────────
    const body = { rating: 5, title: 'Great store', comment: 'Original bottles, sealed, delivered fast. Will order again.' };
    res = await post(mockAuthUser(t, CUSTOMER), body);
    assert.equal(res.status, 201, JSON.stringify(await res.clone().json()));
    let created = (await res.json()).data.review;
    assert.equal(created.rating, 5);
    assert.equal(created.isVerifiedPurchase, true);
    assert.equal(created.reviewer.firstName, 'Ada');
    assert.equal(created.reviewer.lastNameInitial, 'O.');

    // ── One review per customer per store ─────────────────────────────────────
    res = await post(mockAuthUser(t, CUSTOMER), body);
    assert.equal(res.status, 400);

    // ── Pending reviews are invisible publicly; summary reads zero, not stale ─
    res = await fetch(reviewUrl);
    let list = (await res.json()).data;
    assert.equal(list.reviews.length, 0);
    assert.equal(list.summary.totalReviews, 0);
    assert.equal(list.summary.averageRating, 0);

    // ── Customers cannot moderate ─────────────────────────────────────────────
    const patchUrl = app.url(`/api/stores/reviews/${created._id}/status`);
    res = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: mockAuthUser(t, CUSTOMER) },
      body: JSON.stringify({ status: 'approved' }),
    });
    assert.equal(res.status, 403);

    // ── Super-admin approval makes it public and recomputes the aggregate ─────
    res = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: mockAuthUser(t, ROLE_USERS.super_admin) },
      body: JSON.stringify({ status: 'approved' }),
    });
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const moderated = (await res.json()).data;
    assert.equal(moderated.rating.reviewCount, 1);
    assert.equal(moderated.rating.averageRating, 5);

    const tenantDoc = await mongoose.model('Tenant').collection.findOne({ _id: TENANT._id });
    assert.equal(tenantDoc.ratingCount, 1);
    assert.equal(tenantDoc.ratingAvg, 5);

    // ── Public read now shows exactly the approved review, no user IDs ────────
    res = await fetch(reviewUrl);
    list = (await res.json()).data;
    assert.equal(list.reviews.length, 1);
    assert.equal(list.summary.totalReviews, 1);
    assert.equal(list.summary.averageRating, 5);
    assert.equal(list.summary.distribution[5], 1);
    assert.equal(list.reviews[0].reviewer.firstName, 'Ada');
    assert.equal(list.reviews[0].user, undefined);

    // ── Hiding a review resets the aggregate, not a stale rating ──────────────
    res = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: mockAuthUser(t, ROLE_USERS.super_admin) },
      body: JSON.stringify({ status: 'hidden', note: 'Under authenticity investigation' }),
    });
    assert.equal(res.status, 200);
    const hidden = (await res.json()).data;
    assert.equal(hidden.rating.reviewCount, 0);
    assert.equal(hidden.rating.averageRating, 0);
    const tenantAfterHide = await mongoose.model('Tenant').collection.findOne({ _id: TENANT._id });
    assert.equal(tenantAfterHide.ratingCount, 0);
    assert.equal(tenantAfterHide.ratingAvg, 0);
  } finally {
    await app.close();
  }
});

test('seller ratings: unknown slug and invalid payloads', async (t) => {
  await connectVenueMongo(t, 'storeReviewsInvalid');
  await seed();

  const app = await startRouter(storeRouter, '/api/stores');
  try {
    let res = await fetch(app.url('/api/stores/no-such-store/reviews'));
    assert.equal(res.status, 404);

    const auth = mockAuthUser(t, CUSTOMER);
    res = await fetch(app.url('/api/stores/rate-tenant/reviews'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: auth },
      body: JSON.stringify({ rating: 9, comment: 'Short' }),
    });
    assert.equal(res.status, 400);
  } finally {
    await app.close();
  }
});
