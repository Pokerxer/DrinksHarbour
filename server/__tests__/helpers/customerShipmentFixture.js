"use strict";
// Synthetic saved evidence includes deliberately foreign/private rows for read isolation.
async function customerShipmentFixture() {
  const { fixture } = require("./merchantQuantityFixture"),
    { order, customer, actors, admin } = await fixture();
  const mongoose = require("mongoose"),
    oid = () => new mongoose.Types.ObjectId(),
    Child = require("../../models/MerchantOrder"),
    Order = require("../../models/Order"),
    User = require("../../models/User");
  const children = await Child.find({ order: order._id })
      .sort({ _id: 1 })
      .lean(),
    a = children[0],
    b = children[1],
    line = String(a.lines[0].line);
  const foreign = oid();
  await User.collection.insertOne({
    _id: foreign,
    role: "customer",
    status: "active",
  });
  await Child.collection.updateOne(
    { _id: a._id },
    {
      $set: {
        state: "partially_shipped",
        quantityProgress: [
          {
            line,
            shipped: 1,
            delivered: 0,
            cancelled: 1,
            financialBlocks: [
              { refund: oid(), kind: "reserved", start: 1, quantity: 1 },
            ],
          },
        ],
      },
    },
  );
  const allocation = {
    _id: "allocation-own",
    merchantOrder: a._id,
    order: order._id,
    tenant: a.tenant,
    location: a.location,
    state: "shipped",
    dispatchBooking: "booking-own",
    lines: [
      {
        line,
        quantity: 1,
        ranges: [{ start: 0, quantity: 1 }],
        movementReference: "PRIVATE_MOVEMENT",
        batchAllocations: [{ batch: oid(), quantity: 1 }],
      },
    ],
    shippedBy: admin._id,
  };
  await require("../../models/MerchantShipmentAllocation").collection.insertMany(
    [allocation, { ...allocation, _id: "foreign-allocation", order: oid() }],
  );
  await require("../../models/MerchantDispatchBooking").collection.insertOne({
    _id: "booking-own",
    merchantOrder: a._id,
    order: order._id,
    tenant: a.tenant,
    location: a.location,
    state: "dispatched",
    shipmentAllocation: allocation._id,
    createdBy: admin._id,
    events: [{ note: "PRIVATE_NOTE", driver: "PRIVATE_RIDER" }],
  });
  await require("../../models/MerchantRefundAllocation").collection.insertMany([
    {
      _id: oid(),
      merchantOrder: a._id,
      order: order._id,
      tenant: a.tenant,
      customer,
      state: "uncertain",
      amountMinor: 1000,
      currency: "NGN",
      reason: "PRIVATE_REASON",
      providerReference: "PRIVATE_PROVIDER",
      requestedBy: admin._id,
    },
    {
      _id: oid(),
      merchantOrder: a._id,
      order: oid(),
      tenant: a.tenant,
      customer,
      state: "succeeded",
      amountMinor: 9999,
      currency: "NGN",
    },
  ]);
  await require("../../models/MerchantDispatchBooking").collection.insertOne({
    _id: "booking-pending",
    merchantOrder: b._id,
    order: order._id,
    tenant: b.tenant,
    location: b.location,
    state: "booked",
    lines: [
      {
        line: String(b.lines[0].line),
        quantity: 1,
        ranges: [{ start: 0, quantity: 1 }],
      },
    ],
  });
  return {
    order,
    customer,
    actors,
    admin,
    mongoose,
    oid,
    Child,
    Order,
    a,
    b,
    foreign,
  };
}
module.exports = { customerShipmentFixture };
