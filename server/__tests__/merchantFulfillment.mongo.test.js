"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const mongoose = require("mongoose"),
  express = require("express"),
  jwt = require("jsonwebtoken"),
  fs = require("node:fs"),
  path = require("node:path");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
test(
  "two merchant HTTP fulfillment consumes only owned holds, journals batches and survives independent retry/cancel",
  { skip: !uri },
  async (t) => {
    const target = path.resolve(
        __dirname,
        "../services/merchantFulfillment/index.js",
      ),
      service = fs.existsSync(target) ? require(target) : {};
    assert.equal(
      typeof service.prepare,
      "function",
      "merchant allocation seed exists",
    );
    await connectVenueMongo(t, "merchant_fulfillment");
    const oid = () => new mongoose.Types.ObjectId(),
      Order = require("../models/Order"),
      Stock = require("../models/WarehouseStock"),
      Hold = require("../models/OnlineStockReservation"),
      Batch = require("../models/WarehouseBatch");
    const User = require("../models/User"),
      Tenant = require("../models/Tenant"),
      Warehouse = require("../models/Warehouse"),
      Product = require("../models/Product"),
      Sub = require("../models/SubProduct"),
      Size = require("../models/Size"),
      Channel = require("../models/StorefrontChannel");
    const previous = process.env.MERCHANT_FULFILLMENT_ENABLED,
      secret = process.env.JWT_SECRET;
    process.env.MERCHANT_FULFILLMENT_ENABLED = "true";
    process.env.JWT_SECRET = "merchant-fulfillment-test";
    t.after(() => {
      if (previous === undefined)
        delete process.env.MERCHANT_FULFILLMENT_ENABLED;
      else process.env.MERCHANT_FULFILLMENT_ENABLED = previous;
      if (secret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = secret;
    });
    const customer = oid(),
      admin = oid(),
      actors = [],
      tenants = [],
      items = [];
    await User.collection.insertMany([
      { _id: customer, role: "customer", status: "active" },
      { _id: admin, role: "super_admin", status: "active" },
    ]);
    for (let i = 0; i < 2; i++) {
      const tenant = oid(),
        location = oid(),
        product = oid(),
        subproduct = oid(),
        size = oid(),
        actor = oid();
      actors.push(actor);
      tenants.push({ _id: tenant, storefrontIntegrationEnabled: true });
      await Tenant.collection.insertOne({
        _id: tenant,
        status: "approved",
        subscriptionStatus: "active",
      });
      await User.collection.insertOne({
        _id: actor,
        tenant,
        role: "tenant_owner",
        status: "active",
      });
      await Warehouse.create({
        _id: location,
        tenant,
        name: "Synthetic location",
        code: "LOCAL",
        isActive: true,
      });
      await Channel.create({
        tenant,
        apiKey: oid(),
        warehouse: location,
        code: `SYNTHETIC_${i}`,
        paymentAccount: `SYNTHETIC_${i}`,
        returnOrigins: ["https://synthetic.example.test"],
        enabled: false,
        configuredBy: admin,
      });
      await Product.collection.insertOne({
        _id: product,
        name: "Synthetic beverage",
        tracksBatch: true,
      });
      await Sub.collection.insertOne({
        _id: subproduct,
        tenant,
        product,
        totalStock: 10,
        availableStock: 10,
      });
      await Size.collection.insertOne({
        _id: size,
        tenant,
        subproduct,
        stock: 10,
        availableStock: 10,
      });
      await Stock.create({
        tenant,
        warehouse: location,
        subProduct: subproduct,
        size,
        currentQuantity: 10,
        reservedQuantity: 0,
      });
      await Batch.create({
        tenant,
        warehouse: location,
        subProduct: subproduct,
        size,
        product,
        batchNumber: "SYNTHETIC",
        quantity: 10,
        initialQuantity: 10,
        unitCost: 3,
      });
      items.push({
        product,
        subproduct,
        size,
        tenant,
        quantity: 2,
        priceAtPurchase: 10,
        itemSubtotal: 20,
        discountAmount: 0,
        tenantRevenueShare: 16,
        platformCommission: 4,
      });
    }
    const data = {
      user: customer,
      orderNumber: "SYNTHETIC_MERCHANT",
      currency: "NGN",
      subtotal: 40,
      discountTotal: 0,
      shippingFee: 0,
      taxAmount: 0,
      totalAmount: 40,
      items,
      paymentMethod: "card",
      paymentStatus: "paid",
      paymentDetails: { method: "stripe", reference: "pi_fulfillment_test" },
      status: "confirmed",
      shippingAddress: {
        fullName: "Buyer",
        email: "buyer@example.test",
        addressLine1: "Synthetic",
        city: "Abuja",
        state: "FCT",
        country: "Nigeria",
      },
    };
    const order =
      await require("../services/storefrontLocationOrders").createMappedOrder(
        data,
        tenants,
      );
    assert.equal(order.merchantFulfillmentVersion, 1);
    const groups = await require("../models/MerchantOrder")
      .find({ order: order._id })
      .sort({ tenant: 1 })
      .lean();
    assert.equal(groups.length, 2);
    const groupFor = (index) =>
      groups.find((g) => String(g.tenant) === String(tenants[index]._id));
    const app = express();
    app.use(express.json());
    app.use("/", require("../routes/merchant-operations.routes"));
    app.use((e, req, res, next) =>
      res.status(e.statusCode || 500).json({ message: e.message }),
    );
    const server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const call = async (actor, method = "GET", suffix = "", body) => {
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}/merchant-orders${suffix}`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(actor
              ? {
                  Authorization: `Bearer ${jwt.sign({ userId: String(actor) }, process.env.JWT_SECRET)}`,
                }
              : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      return { status: response.status, body: await response.json() };
    };
    assert.equal((await call(null)).status, 401);
    assert.equal((await call(customer)).status, 403);
    const list = await call(actors[0]);
    assert.equal(list.status, 200);
    assert.equal(list.body.data.orders.length, 1);
    assert.equal(list.body.data.orders[0].totalMinor, 2000);
    assert.equal(
      JSON.stringify(list.body).includes(String(items[1].product)),
      false,
    );
    assert.equal(
      (
        await call(actors[1], "POST", `/${groupFor(0)._id}/actions`, {
          action: "accept",
          expectedVersion: 1,
          idempotencyKey: "foreign",
        })
      ).status,
      404,
    );
    const action = (i, name, version, key) =>
      call(actors[i], "POST", `/${groupFor(i)._id}/actions`, {
        action: name,
        expectedVersion: version,
        idempotencyKey: key,
      });
    const accepted = await action(0, "accept", 1, "accept-a");
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    const shipped = await Promise.all([
      action(0, "ship", 2, "ship-a"),
      action(0, "ship", 2, "ship-a"),
    ]);
    assert.deepEqual(
      shipped.map((r) => r.status),
      [200, 200],
    );
    assert.equal(
      (await Stock.findOne({ tenant: tenants[0]._id }).lean()).currentQuantity,
      8,
    );
    assert.equal(
      (await Stock.findOne({ tenant: tenants[1]._id }).lean()).currentQuantity,
      10,
    );
    assert.equal(
      (await Order.findById(order._id).lean()).status,
      "partially_shipped",
    );
    assert.equal(
      await require("../models/WarehouseMovement").countDocuments({
        type: "shipped",
      }),
      1,
    );
    assert.equal(
      await require("../models/InventoryMovement").countDocuments({
        type: "shipped",
      }),
      1,
    );
    assert.equal(
      (await Batch.findOne({ tenant: tenants[0]._id }).lean()).quantity,
      8,
    );
    delete process.env.MERCHANT_FULFILLMENT_ENABLED;
    const oldRefundFlag = process.env.MERCHANT_REFUNDS_ENABLED;
    process.env.MERCHANT_REFUNDS_ENABLED = "true";
    t.after(() => {
      if (oldRefundFlag === undefined)
        delete process.env.MERCHANT_REFUNDS_ENABLED;
      else process.env.MERCHANT_REFUNDS_ENABLED = oldRefundFlag;
    });
    await require("../models/MarketplacePaymentClaim").create({
      _id: "stripe:platform:pi_fulfillment_test",
      provider: "stripe",
      account: "platform",
      reference: "pi_fulfillment_test",
      user: customer,
      amount: 40,
      currency: "NGN",
      state: "allocated",
      order: order._id,
      receipt: {
        method: "stripe",
        reference: "pi_fulfillment_test",
        amount: 40,
        currency: "NGN",
      },
    });
    t.mock.method(
      require("../services/merchantFulfillment/refundTransport"),
      "submit",
      async (row) => ({
        id: "re_fulfillment_test",
        status: "succeeded",
        amount: row.amountMinor,
        currency: "ngn",
        payment_intent: row.providerReference,
        metadata: {
          merchant_refund_allocation: String(row._id),
          merchant_order: row.merchantOrder,
          parent_order: String(row.order),
        },
      }),
    );
    const refund =
      await require("../services/merchantFulfillment/refunds").request(
        groupFor(1)._id,
        {
          amountMinor: 2000,
          idempotencyKey: "b-cancel-refund",
          reason: "Refund own unshipped synthetic merchandise",
        },
        { _id: admin, role: "super_admin" },
      );
    await require("../services/merchantFulfillment/refunds").execute(
      String(refund._id),
      { _id: admin, role: "super_admin" },
    );
    const cancelled = await action(1, "cancel", 1, "cancel-b");
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
    assert.equal(
      (await Stock.findOne({ tenant: tenants[1]._id }).lean()).reservedQuantity,
      0,
    );
    assert.equal(
      (await Batch.findOne({ tenant: tenants[1]._id }).lean()).quantity,
      10,
    );
    assert.equal(
      (await Hold.findOne({ tenant: tenants[0]._id }).lean()).state,
      "consumed",
    );
    assert.equal(
      (await Hold.findOne({ tenant: tenants[1]._id }).lean()).state,
      "released",
    );
    await assert.rejects(
      () =>
        require("../services/orderStatus.service").applyOrderStatus(
          order,
          "cancelled",
          { actorId: admin },
        ),
      /merchant|fulfillment/i,
    );
    assert.equal(
      (await action(0, "cancel", 3, "cannot-cancel-shipped")).status,
      409,
    );
    const operation = await require("../models/MerchantFulfillmentOperation")
      .findOne({ merchantOrder: groupFor(0)._id, action: "accept" })
      .lean();
    assert.ok(operation);
    assert.equal(String(operation.actor), String(actors[0]));
  },
);
