'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');
test(
  'failed managed delivery explicitly retries original goods and quarantines physical return exactly once through JWT routes',
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, 'merchant_recovery');
    const { f, child, actor, driver, booking, service, Stock, Child } =
      await require('./helpers/merchantRecoveryFixture').fixture(t);
    const engine = require('../services/delivery.service'),
      Delivery = require('../models/Delivery'),
      Driver = require('../models/Driver');
    const shipped = await engine.dispatchManagedDelivery(
      booking._id,
      { expectedVersion: booking.version, idempotencyKey: 'ship' },
      actor
    );
    const stock = (await Stock.findOne({ tenant: child.tenant }))
      .currentQuantity;
    const failed = await engine.resolveManagedDelivery(
      booking._id,
      {
        expectedVersion: shipped.version,
        idempotencyKey: 'fail-original',
        status: 'failed',
        failureReason: 'Recipient absent',
      },
      actor
    );
    const original = await Delivery.findById(booking.delivery).lean();
    const express = require('express'),
      jwt = require('jsonwebtoken');
    const previous = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'synthetic-recovery-only';
    t.after(() =>
      previous === undefined
        ? delete process.env.JWT_SECRET
        : (process.env.JWT_SECRET = previous)
    );
    const app = express();
    app.use(express.json());
    app.use(
      '/api/merchant-local-dispatch',
      require('../routes/merchantLocalDispatch.routes')
    );
    app.use('/api', require('../routes/customer-order-operations.routes'));
    app.use((err, req, res, next) =>
      res.status(err.statusCode || 500).json({ message: err.message })
    );
    const server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const call = async (input, who = actor) => {
      const r = await fetch(
        `http://127.0.0.1:${server.address().port}/api/merchant-local-dispatch/bookings/${booking._id}/recover`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt.sign({ userId: String(who._id) }, process.env.JWT_SECRET)}`,
          },
          body: JSON.stringify(input),
        }
      );
      const text = await r.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text };
      }
      return { status: r.status, body };
    };
    const budgetBefore = await require('../models/MerchantDispatchBudget')
      .findById(child._id)
      .lean();
    const retry = {
      action: 'reattempt',
      expectedVersion: failed.version,
      idempotencyKey: 'retry-one',
      reason: 'Confirmed recipient available',
      driverId: String(driver._id),
    };
    assert.equal((await call(retry, f.actors[1])).status, 404);
    const foreignDriver = await Driver.create({
      tenant: f.actors[1].tenant,
      name: 'Foreign rider',
      phone: 'synthetic-foreign',
      vehicle: { type: 'bike', capacityKg: 10 },
    });
    assert.equal(
      (
        await call({
          ...retry,
          driverId: String(foreignDriver._id),
          idempotencyKey: 'foreign-driver',
        })
      ).status,
      409
    );
    assert.equal(
      (
        await call({
          ...retry,
          expectedVersion: 1,
          idempotencyKey: 'stale-version',
        })
      ).status,
      409
    );
    assert.equal(
      (await call({ ...retry, tenant: String(f.actors[1].tenant) })).status,
      400
    );
    const response = await call(retry);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const retried = response.body.data.booking;
    assert.equal(retried.state, 'dispatched');
    assert.equal(String(retried.delivery), String(booking.delivery));
    assert.notEqual(String(retried.activeDelivery), String(booking.delivery));
    assert.equal((await call(retry)).status, 200);
    assert.equal(
      (await call({ ...retry, reason: 'Different instruction' })).status,
      409
    );
    assert.equal(
      await Delivery.countDocuments({ responsibilityVersion: 2 }),
      2
    );
    assert.deepEqual(
      await Delivery.findById(booking.delivery).lean(),
      original,
      'original failed trip preserved'
    );
    assert.equal(
      (await Stock.findOne({ tenant: child.tenant })).currentQuantity,
      stock
    );
    assert.equal(
      (await Child.findById(child._id)).quantityProgress.reduce(
        (n, r) => n + r.shipped,
        0
      ),
      1
    );
    const failedAgain = await engine.resolveManagedDelivery(
      booking._id,
      {
        expectedVersion: retried.version,
        idempotencyKey: 'fail-second',
        status: 'failed',
        failureReason: 'Recipient absent again',
      },
      actor
    );
    const allocation = await require('../models/MerchantShipmentAllocation')
      .findById(shipped.shipmentAllocation)
      .lean();
    await Child.updateOne(
      { _id: child._id },
      {
        $push: {
          'quantityProgress.0.financialBlocks': {
            ...(allocation.lines[0].ranges[0].toObject?.() ||
              allocation.lines[0].ranges[0]),
            refund: new (require('mongoose').Types.ObjectId)(),
            kind: 'refunded',
          },
        },
      }
    );
    assert.equal(
      (
        await call({
          ...retry,
          idempotencyKey: 'blocked-retry',
          expectedVersion: failedAgain.version,
        })
      ).status,
      409
    );
    const request = {
      action: 'return',
      expectedVersion: failedAgain.version,
      idempotencyKey: 'return-request',
      reason: 'Return original goods to origin',
    };
    const requested = await call(request);
    assert.equal(requested.status, 200, JSON.stringify(requested.body));
    assert.equal(requested.body.data.booking.state, 'returning');
    const receiptInput = {
      action: 'receive_return',
      expectedVersion: requested.body.data.booking.version,
      idempotencyKey: 'return-received',
      reason: 'Original sealed goods physically received',
    };
    const received = await call(receiptInput);
    assert.equal((await call(receiptInput)).status, 200);
    assert.equal(received.status, 200, JSON.stringify(received.body));
    assert.equal(received.body.data.booking.state, 'returned');
    assert.equal(
      (await Stock.findOne({ tenant: child.tenant })).currentQuantity,
      stock,
      'quarantine never becomes sellable stock'
    );
    assert.equal((await Driver.findById(driver._id)).managedTrip, null);
    const receipts = await require('../models/MerchantDeliveryReturn')
      .find()
      .lean();
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].disposition, 'quarantined');
    assert.equal(receipts[0].shipmentAllocation, shipped.shipmentAllocation);
    assert.equal(
      (
        await call({
          ...retry,
          idempotencyKey: 'late-retry',
          expectedVersion: received.body.data.booking.version,
        })
      ).status,
      409
    );
    assert.deepEqual(
      await require('../models/MerchantDispatchBudget')
        .findById(child._id)
        .lean(),
      budgetBefore,
      'recovery never recharges original budget'
    );
    const customerResponse = await fetch(
      `http://127.0.0.1:${server.address().port}/api/customer-shipments/${f.order._id}`,
      {
        headers: {
          Authorization: `Bearer ${jwt.sign({ userId: String(f.customer) }, process.env.JWT_SECRET)}`,
        },
      }
    );
    assert.equal(customerResponse.status, 200);
    const customerView = await customerResponse.json();
    assert.equal(
      customerView.data.groups.find((g) => g.id === child._id).shipments[0]
        .status,
      'returned'
    );
    assert.doesNotMatch(
      JSON.stringify(customerView),
      /quarantined|Original sealed goods|recoveryOperations|managedTrip|refund-received/
    );
    // An uncertain restore of mutable booking state cannot override immutable receipt.
    await require('../models/MerchantDispatchBooking').updateOne(
      { _id: booking._id },
      { $set: { state: 'failed' } }
    );
    assert.equal(
      (
        await call({
          ...request,
          idempotencyKey: 'restored-state-must-not-return-again',
          expectedVersion: received.body.data.booking.version,
        })
      ).status,
      409
    );
  }
);
