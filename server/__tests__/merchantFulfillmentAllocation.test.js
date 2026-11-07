"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const modulePath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/allocation.js",
);
const load = () => (fs.existsSync(modulePath) ? require(modulePath) : {});
const order = () => ({
  _id: "507f1f77bcf86cd799439010",
  currency: "NGN",
  subtotal: 30,
  discountTotal: 0,
  taxAmount: 0.01,
  shippingFee: 1,
  totalAmount: 31.01,
  items: [
    {
      _id: "507f1f77bcf86cd799439001",
      tenant: "507f1f77bcf86cd799439011",
      warehouse: "507f1f77bcf86cd799439021",
      product: "507f1f77bcf86cd799439031",
      subproduct: "507f1f77bcf86cd799439041",
      size: "507f1f77bcf86cd799439051",
      quantity: 1,
      itemSubtotal: 10,
      discountAmount: 0,
      tenantRevenueShare: 8,
      platformCommission: 2,
    },
    {
      _id: "507f1f77bcf86cd799439002",
      tenant: "507f1f77bcf86cd799439012",
      warehouse: "507f1f77bcf86cd799439022",
      product: "507f1f77bcf86cd799439032",
      subproduct: "507f1f77bcf86cd799439042",
      size: "507f1f77bcf86cd799439052",
      quantity: 2,
      itemSubtotal: 20,
      discountAmount: 0,
      tenantRevenueShare: 16,
      platformCommission: 4,
    },
  ],
});
test("merchant allocations preserve authoritative lines and exactly reconcile smallest shipping/tax remainders", () => {
  const { allocate } = load();
  assert.equal(typeof allocate, "function");
  const groups = allocate(order());
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((g) => g.totalMinor),
    [1033, 2068],
  );
  assert.equal(
    groups.reduce((n, g) => n + g.shippingMinor, 0),
    100,
  );
  assert.equal(
    groups.reduce((n, g) => n + g.taxMinor, 0),
    1,
  );
  assert.equal(groups[0].lines.length, 1);
  assert.equal(groups[0].lines[0].quantity, 1);
  assert.deepEqual(allocate(order()), groups);
});
test("inconsistent financial or location evidence fails without rewriting history", () => {
  const { allocate } = load();
  assert.equal(typeof allocate, "function");
  for (const edit of [
    (o) => o.totalAmount++,
    (o) => delete o.items[0].warehouse,
    (o) => (o.items[0].platformCommission = 3),
    (o) => (o.currency = "GBP"),
    (o) => (o.items[0].discountAmount = 1),
  ]) {
    const o = order();
    edit(o);
    assert.throws(() => allocate(o));
  }
});
test("creation opt-in preserves legacy COD and unpaid electronic workflows without uncollectible child orders", async (t) => {
  const servicePath = path.resolve(
    __dirname,
    "../services/merchantFulfillment/index.js",
  );
  const { prepare } = fs.existsSync(servicePath) ? require(servicePath) : {};
  assert.equal(typeof prepare, "function");
  const old = process.env.MERCHANT_FULFILLMENT_ENABLED;
  process.env.MERCHANT_FULFILLMENT_ENABLED = "true";
  t.after(() => {
    if (old === undefined) delete process.env.MERCHANT_FULFILLMENT_ENABLED;
    else process.env.MERCHANT_FULFILLMENT_ENABLED = old;
  });
  const mongoose = require("mongoose"),
    Order = require("../models/Order");
  for (const fields of [
    { paymentStatus: "pending", paymentMethod: "card" },
    { paymentStatus: "pending", paymentMethod: "cash_on_delivery" },
    { paymentStatus: "paid", paymentMethod: "cash" },
  ]) {
    const value = new Order({
      ...fields,
      onlineStockVersion: 1,
      settlementOwner: "platform",
      items: [{ warehouse: new mongoose.Types.ObjectId(), quantity: 1 }],
    });
    assert.deepEqual(await prepare(value), []);
    assert.equal(value.merchantFulfillmentVersion, undefined);
  }
});
