'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');
test(
  'managed parents stay out of legacy rider trips while legacy delivery remains usable',
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, 'merchant_legacy_delivery');
    const Order = require('../models/Order'),
      Delivery = require('../models/Delivery'),
      service = require('../services/delivery.service');
    const oid = () => new mongoose.Types.ObjectId(),
      tenant = oid(),
      managed = oid(),
      legacy = oid();
    const base = {
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'card',
      shippingMethod: 'standard',
      totalAmount: 20,
      placedAt: new Date(),
      items: [{ tenant, quantity: 1 }],
      shippingAddress: {
        fullName: 'Synthetic buyer',
        city: 'Abuja',
        state: 'FCT',
        addressLine1: 'Synthetic',
      },
    };
    await Order.collection.insertMany([
      {
        ...base,
        _id: managed,
        merchantFulfillmentVersion: 1,
        orderNumber: 'MANAGED',
      },
      { ...base, _id: legacy, orderNumber: 'LEGACY' },
    ]);
    const queue = await service.getUnassignedOrders(tenant);
    assert.deepEqual(
      queue.map((row) => String(row._id)),
      [String(legacy)]
    );
    await assert.rejects(
      () => service.createDelivery(tenant, { orderIds: [managed] }, oid()),
      /could not|merchant|ready/i
    );
    assert.equal(await Delivery.countDocuments(), 0);
    const trip = await service.createDelivery(
      tenant,
      { orderIds: [legacy] },
      oid()
    );
    assert.equal(String(trip.stops[0].order), String(legacy));
  }
);
