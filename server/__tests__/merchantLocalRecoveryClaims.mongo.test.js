'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');
test(
  'retry refuses orphan old rider claim, preserves foreign claims and delivers original allocation once',
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, 'merchant_recovery_claims');
    const { f, child, actor, driver, booking, service, Stock, Child } =
      await require('./helpers/merchantRecoveryFixture').fixture(t);
    const engine = require('../services/delivery.service'),
      Driver = require('../models/Driver'),
      Delivery = require('../models/Delivery'),
      mongoose = require('mongoose');
    let row = await engine.dispatchManagedDelivery(
      booking._id,
      { expectedVersion: booking.version, idempotencyKey: 'ship' },
      actor
    );
    const failure = {
      expectedVersion: row.version,
      idempotencyKey: 'original-fail',
      status: 'failed',
      failureReason: 'Customer unavailable',
    };
    row = await engine.resolveManagedDelivery(booking._id, failure, actor);
    await require('../models/MerchantDispatchBooking').updateOne(
      { _id: booking._id },
      { $set: { resolutionOperations: [] } }
    );
    const replacement = await Driver.create({
      tenant: child.tenant,
      name: 'Replacement',
      phone: 'synthetic-replacement',
      vehicle: { type: 'bike', capacityKg: 10 },
    });
    const input = {
      action: 'reattempt',
      expectedVersion: row.version,
      idempotencyKey: 'replace',
      reason: 'Confirmed customer available',
      driverId: String(replacement._id),
    };
    await Driver.updateOne(
      { _id: driver._id },
      { $set: { managedTrip: booking.delivery, status: 'on_trip' } }
    );
    await assert.rejects(
      () => service.recoverManagedDelivery(booking._id, input, actor),
      /reconcil|claim/i,
      'orphan failed-trip rider claim must block retry'
    );
    const foreignTrip = new mongoose.Types.ObjectId();
    await Driver.updateOne(
      { _id: driver._id },
      { $set: { managedTrip: foreignTrip, status: 'on_trip' } }
    );
    const results = await Promise.all([
      service.recoverManagedDelivery(booking._id, input, actor),
      service.recoverManagedDelivery(booking._id, input, actor),
    ]);
    row = results[0];
    assert.equal(
      row.activeDelivery.toString(),
      results[1].activeDelivery.toString()
    );
    assert.equal(
      String((await Driver.findById(driver._id)).managedTrip),
      String(foreignTrip)
    );
    await engine.resolveManagedDelivery(booking._id, failure, actor);
    assert.equal(
      (await Delivery.findById(row.activeDelivery)).stops[0].status,
      'pending',
      'old exact failure replay cannot resolve new trip'
    );
    const resolved = {
      expectedVersion: row.version,
      idempotencyKey: 'success-retry',
      status: 'delivered',
    };
    row = await engine.resolveManagedDelivery(booking._id, resolved, actor);
    assert.equal(row.state, 'delivered');
    await engine.resolveManagedDelivery(booking._id, resolved, actor);
    assert.equal(
      (await Child.findById(child._id)).quantityProgress.reduce(
        (n, r) => n + r.delivered,
        0
      ),
      1
    );
    assert.equal(
      await require('../models/MerchantShipmentAllocation').countDocuments({
        merchantOrder: child._id,
      }),
      1
    );
    assert.equal(
      (await Stock.findOne({ tenant: child.tenant })).currentQuantity,
      9
    );
    assert.equal(
      String((await Driver.findById(driver._id)).managedTrip),
      String(foreignTrip)
    );
    assert.equal((await Driver.findById(replacement._id)).managedTrip, null);
  }
);
