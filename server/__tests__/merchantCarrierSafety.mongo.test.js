'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');
test('carrier reviews keep official string IDs and private nested data out of DTOs while tracking cannot regress', { skip: !uri }, async t => {
  await connectVenueMongo(t, 'carrier_safe');
  const tenant = new mongoose.Types.ObjectId(), location = new mongoose.Types.ObjectId();
  const actor = { _id: new mongoose.Types.ObjectId(), tenant, role: 'tenant_owner' };
  const admin = { _id: new mongoose.Types.ObjectId(), role: 'super_admin' };
  await require('../models/Warehouse').collection.insertOne({ _id: location, tenant, isActive: true });
  const review = require('../services/deliveryProviders/external/review');
  await t.test('review accepts official alphanumeric courier identity and allowlists corrupted nested storage', async () => {
    const row = await review.reviewCarrier({ tenant: String(tenant), location: String(location), version: 1,
      account: 'SYNTHETIC', categoryId: 1, maxUnits: 10, maxWeightGrams: 10000,
      allowedServices: [{ courierId: 'dellyman', serviceCode: 'regular' }],
      capabilities: { alcohol: false, fragile: false, ageVerification: false },
      reviewReference: 'Synthetic provider capability only', validUntil: new Date(Date.now() + 86400000).toISOString() }, admin);
    const Model = require('../models/MerchantCarrierReview');
    await Model.collection.updateOne({ _id: row._id }, { $set: {
      capabilities: { alcohol: false, fragile: false, ageVerification: false, private: 'SECRET' },
      allowedServices: [{ courierId: 'dellyman', serviceCode: 'regular', private: 'SECRET' }],
    } });
    assert.doesNotMatch(JSON.stringify(review.reviewDTO(await Model.findById(row._id).lean())), /SECRET|private/);
  });
  await t.test('a late older authenticated response cannot undo a completed provider observation', async () => {
    const Booking = require('../models/MerchantCarrierBooking');
    const id = 'c'.repeat(64), accountKey = 'SHIPBUBBLE_ACCOUNT_SYNTHETIC';
    await Booking.collection.insertOne({ _id: id, tenant, location, merchantOrder: 'owned-child',
      order:new mongoose.Types.ObjectId(),quote:new mongoose.Types.ObjectId(),review:'synthetic-review',fingerprint:'synthetic-fingerprint',scopeHash:'synthetic-scope',snapshot:{synthetic:true},createdBy:actor._id,scheduledFor:new Date(Date.now()+86400000),allocationId: 'a'.repeat(64), state: 'booked', account: 'SYNTHETIC', providerId: 'SB-OWN',
      providerStatus: 'pending', rate: { courierId:'1',serviceCode:'regular',amountMinor: 100, displayMinor: 100 } });
    const old = process.env[accountKey]; process.env[accountKey] = 'sb_sandbox_synthetic';
    t.after(() => old === undefined ? delete process.env[accountKey] : process.env[accountKey] = old);
    let release, began; const started = new Promise(r => began = r), delayed = new Promise(r => release = r);
    let calls = 0;
    t.mock.method(global, 'fetch', async () => {
      const current = ++calls;
      if (current === 1) { began(); await delayed; }
      return new Response(JSON.stringify({ status: 'success', data: { results: [{ order_id: 'SB-OWN', status: current === 1 ? 'pending' : 'completed' }] } }));
    });
    const tracking = require('../services/deliveryProviders/external/tracking');
    const first = tracking.refresh(id, actor); await started;
    await tracking.refresh(id, actor); release(); await first;
    assert.equal((await Booking.findById(id)).providerStatus, 'completed');
    assert.equal(calls, 2);
  });
});
