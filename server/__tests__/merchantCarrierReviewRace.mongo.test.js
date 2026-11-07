'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');
test('a carrier review revoked after the booking read cannot admit a provider charge', { skip: !uri, timeout: 120000 }, async t => {
  await connectVenueMongo(t, 'carrier_review_race');
  t.diagnostic('connected isolated replica');
  const flags = ['MERCHANT_FULFILLMENT_ENABLED', 'MERCHANT_QUANTITY_FULFILLMENT_ENABLED'];
  const previous = flags.map(key => process.env[key]); flags.forEach(key => process.env[key] = 'true');
  t.after(() => flags.forEach((key, i) => previous[i] === undefined ? delete process.env[key] : process.env[key] = previous[i]));
  const f = await require('./helpers/merchantQuantityFixture').fixture();
  t.diagnostic('original order fixture created');
  const actor = f.actors[0], child = await require('../models/MerchantOrder').findOne({ order: f.order._id, tenant: actor.tenant }).lean();
  const line = child.lines[0];
  await require('../models/Product').collection.updateOne({ _id: line.product }, { $set: { type: 'soft_drink', isAlcoholic: false } });
  await require('../models/SubProduct').collection.updateOne({ _id: line.subproduct }, { $set: { shipping: { fragile: false, hazmat: false, requiresAgeVerification: false } } });
  await require('../models/Size').collection.updateOne({ _id: line.size }, { $set: { shippingWeight: 1000, packaging: { type: 'plastic_bottle', material: 'plastic' } } });
  await require('../services/merchantFulfillment/actions').act(child._id, { action: 'accept', expectedVersion: 1, idempotencyKey: 'review-race-accept' }, actor);
  const Order = require('../models/Order'), Warehouse = require('../models/Warehouse');
  await Order.collection.updateOne({ _id: child.order }, { $set: { shippingMethod: 'standard', 'shippingAddress.phone': '+2348000000000' } });
  await Warehouse.collection.updateOne({ _id: child.location }, { $set: { address: { line1: 'Synthetic origin', city: 'Abuja', state: 'FCT', country: 'Nigeria' }, contact: { name: 'Synthetic sender', email: 'sender@example.test', phone: '+2348000000001' } } });
  const allocation = await require('../services/merchantFulfillment/quantity/commands').shipQuantities(child._id,
    { lines: [{ line: String(child.lines[0].line), quantity: 1 }], expectedVersion: 2, idempotencyKey: 'review-race-ship' }, actor);
  const service = require('../services/deliveryProviders/external');
  t.diagnostic('original allocation shipped');
  const review = await service.reviewCarrier({ tenant: String(child.tenant), location: String(child.location), version: 1,
    account: 'SYNTHETIC', categoryId: 1, maxUnits: 10, maxWeightGrams: 10000, allowedServices: [{ courierId: 'parcel', serviceCode: 'regular' }],
    capabilities: { alcohol: false, ageVerification: false, fragile: false }, reviewReference: 'Synthetic review race evidence', validUntil: new Date(Date.now() + 86400000) }, f.admin);
  const loaded = await require('../services/deliveryProviders/external/scope').load(child._id, allocation._id, actor);
  t.diagnostic('carrier source authority loaded');
  const quote = await require('../models/MerchantCarrierQuote').create({ merchantOrder: child._id, order: child.order, tenant: child.tenant, location: child.location, allocationId: allocation._id,
    review: review._id, account: 'SYNTHETIC', scopeHash: loaded.scopeHash, snapshot: { ...loaded.snapshot, pickupDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
    requestToken: 'synthetic-race-token', rates: [{ courierId: 'parcel', serviceCode: 'regular', amountMinor: 0, displayMinor: 0 }], expiresAt: new Date(Date.now() + 60000), createdBy: actor._id });
  const old = process.env.MERCHANT_EXTERNAL_CARRIER_ENABLED; process.env.MERCHANT_EXTERNAL_CARRIER_ENABLED = 'true';
  t.after(() => old === undefined ? delete process.env.MERCHANT_EXTERNAL_CARRIER_ENABLED : process.env.MERCHANT_EXTERNAL_CARRIER_ENABLED = old);
  const Model = require('../models/MerchantCarrierReview'), original = Model.findOne;
  let release, began, paused = false, creates = 0;
  const started = new Promise(resolve => began = resolve), resume = new Promise(resolve => release = resolve);
  t.mock.method(Model, 'findOne', function (...args) {
    const query = original.apply(this, args), lean = query.lean;
    query.lean = async function (...values) {
      const result = await lean.apply(this, values);
      if (!paused && query.getOptions().session?.inTransaction()) { paused = true; began(); await resume; }
      return result;
    };
    return query;
  });
  t.mock.method(require('../services/deliveryProviders/external/transport'), 'request', async () => { creates++; throw new Error('Synthetic unknown provider response'); });
  const outcome = service.bookCarrier(child._id, { quoteId: String(quote._id), courierId: 'parcel', serviceCode: 'regular', idempotencyKey: 'review-race-book' }, actor).then(value => { if (!paused) began(); return { value }; }, error => { if (!paused) began(); return { error }; });
  try { await started; t.diagnostic('booking read paused'); if (!paused) { const early = await outcome; throw early.error || new Error('Booking never read reviewed authority'); } await service.revokeReview(review._id, f.admin); t.diagnostic('revocation committed'); }
  finally { release(); }
  const result = await outcome;
  assert.equal(result.error?.statusCode, 409, 'revoked authority must abort before external POST');
  assert.equal(creates, 0);
  assert.equal(await require('../models/MerchantCarrierBooking').countDocuments(), 0);
});
