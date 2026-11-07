"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  mongoose = require("mongoose");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
test(
  "original Paystack refund on real protected merchant route preserves pending budget and settles exact original shares once",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "merchant_paystack");
    const oid = () => new mongoose.Types.ObjectId(),
      tenant = oid(),
      buyer = oid(),
      parent = oid();
    const root = { _id: oid(), role: "super_admin", status: "active" },
      merchant = { _id: oid(), role: "tenant_owner", tenant, status: "active" };
    const foreign = {
      _id: oid(),
      role: "tenant_owner",
      tenant: oid(),
      status: "active",
    };
    const Order = require("../models/Order"),
      Child = require("../models/MerchantOrder"),
      Group = require("../models/MerchantOrderSet");
    const Claim = require("../models/MarketplacePaymentClaim"),
      Refund = require("../models/MerchantRefundAllocation"),
      Journal = require("../models/JournalEntry");
    const raw = {
      _id: parent,
      user: buyer,
      currency: "NGN",
      subtotal: 40,
      totalAmount: 40,
      shippingFee: 0,
      taxAmount: 0,
      discountTotal: 0,
      paymentStatus: "paid",
      status: "confirmed",
      paymentMethod: "card",
      merchantFulfillmentVersion: 1,
      source: "web",
      settlementOwner: "platform",
      items: [
        {
          _id: oid(),
          tenant,
          warehouse: oid(),
          product: oid(),
          subproduct: oid(),
          size: oid(),
          quantity: 2,
          itemSubtotal: 40,
          discountAmount: 0,
          tenantRevenueShare: 32,
          platformCommission: 8,
        },
      ],
    };
    await Order.collection.insertOne(raw);
    const [child] =
      require("../services/merchantFulfillment/allocation").allocate(raw);
    await Child.create(child);
    await Group.create({
      _id: parent,
      currency: "NGN",
      totalMinor: 4000,
      children: [child._id],
      allocationPolicy: "merchandise-weighted-v1",
    });
    await Claim.create({
      _id: "paystack:platform:original-paystack",
      provider: "paystack",
      account: "platform",
      reference: "original-paystack",
      user: buyer,
      amount: 40,
      currency: "NGN",
      state: "allocated",
      order: parent,
      receipt: {
        method: "paystack",
        reference: "original-paystack",
        transactionId: "1641",
        amount: 40,
        currency: "NGN",
      },
    });
    await require("../services/chartOfAccounts.service").ensureDefaultCOA(
      tenant,
    );
    await require("../services/journalEntry.service").postJournalEntry({
      tenantId: tenant,
      refDoc: parent,
      refDocType: "Order",
      entryType: "sales_revenue",
      source: "marketplace",
      lines: [
        { account: "1300", debit: 32, credit: 0 },
        { account: "6500", debit: 8, credit: 0 },
        { account: "4000", debit: 0, credit: 40 },
      ],
    });
    for (const actor of [root, merchant, foreign])
      await require("../models/User").collection.insertOne({
        ...actor,
        email: `${actor._id}@test.invalid`,
        permissions: ["orders:read", "orders:write"],
      });
    const prior = {};
    for (const key of [
      "JWT_SECRET",
      "MERCHANT_REFUNDS_ENABLED",
      "MERCHANT_PAYSTACK_REFUNDS_ENABLED",
      "PAYSTACK_SECRET_KEY",
    ])
      prior[key] = process.env[key];
    Object.assign(process.env, {
      JWT_SECRET: "synthetic-test-jwt-only",
      MERCHANT_REFUNDS_ENABLED: "true",
      MERCHANT_PAYSTACK_REFUNDS_ENABLED: "true",
      PAYSTACK_SECRET_KEY: "synthetic-no-network",
    });
    const axios = require("axios"),
      oldPost = axios.post,
      oldGet = axios.get;
    let creates = 0,
      status = "pending",
      failCreate = false;
    const provider = (id, transaction = 1641) => ({
      status: true,
      data: { id, transaction, amount: 1001, currency: "NGN", status },
    });
    axios.post = async (url, payload) => {
      assert.equal(url, "https://api.paystack.co/refund");
      assert.equal(payload.transaction, "original-paystack");
      assert.equal(payload.amount, 1001);
      assert.equal(payload.currency, "NGN");
      creates++;
      if (failCreate) throw new Error("Synthetic unknown create outcome");
      return {
        data: {
          ...provider(71),
          data: {
            ...provider(71).data,
            transaction: { id: 1641, reference: "original-paystack" },
            merchant_note: payload.merchant_note,
          },
        },
      };
    };
    axios.get = async (url) => {
      assert.equal(url, "https://api.paystack.co/refund/71");
      return { data: provider(71) };
    };
    t.after(() => {
      axios.post = oldPost;
      axios.get = oldGet;
      for (const [key, value] of Object.entries(prior)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
    const express = require("express"),
      app = express();
    app.use(express.json());
    app.use("/merchant-orders", require("../routes/merchantOrder.routes"));
    app.use((e, req, res, next) =>
      res.status(e.statusCode || 500).json({ message: e.message }),
    );
    const server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const jwt = require("jsonwebtoken");
    const call = async (actor, path, body) => {
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}/merchant-orders/${child._id}${path}`,
        {
          method: body ? "POST" : "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt.sign({ userId: String(actor._id) }, process.env.JWT_SECRET)}`,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      return {
        status: response.status,
        body: await response.json().catch(() => null),
      };
    };
    const input = {
      amountMinor: 1001,
      idempotencyKey: "paystack-first",
      reason: "Synthetic original-provider refund",
    };
    assert.equal((await call(foreign, "/refunds", input)).status, 404);
    const reserved = await call(merchant, "/refunds", input);
    assert.equal(reserved.status, 201, JSON.stringify(reserved.body));
    const row = reserved.body.data.refund;
    assert.equal(
      (await Refund.findById(row._id).lean()).providerTransactionId,
      "1641",
    );
    assert.equal(
      (await call(merchant, `/refunds/${row._id}/execute`, {})).status,
      403,
    );
    const pending = await call(root, `/refunds/${row._id}/execute`, {});
    assert.equal(pending.status, 409, JSON.stringify(pending.body));
    const saved = await Refund.findById(row._id).lean();
    assert.equal(saved.state, "uncertain");
    assert.equal(saved.providerRefundId, "71");
    assert.equal(
      (await Group.findById(parent).lean()).refundReservedMinor,
      1001,
    );
    assert.equal((await Group.findById(parent).lean()).refundedMinor, 0);
    assert.equal(
      (await call(root, `/refunds/${row._id}/execute`, {})).status,
      409,
    );
    assert.equal(creates, 1);
    status = "processed";
    const settled = await call(root, `/refunds/${row._id}/reconcile`, {
      providerRefundId: "71",
    });
    assert.equal(settled.status, 200, JSON.stringify(settled.body));
    assert.equal((await Group.findById(parent).lean()).refundedMinor, 1001);
    assert.equal((await Group.findById(parent).lean()).refundReservedMinor, 0);
    assert.equal(
      (
        await call(root, `/refunds/${row._id}/reconcile`, {
          providerRefundId: "71",
        })
      ).status,
      200,
    );
    assert.equal(
      await Journal.countDocuments({
        refDoc: new mongoose.Types.ObjectId(row._id),
        entryType: "refund",
      }),
      1,
    );
    const journal = await Journal.findOne({
      refDoc: new mongoose.Types.ObjectId(row._id),
      entryType: "refund",
    }).lean();
    assert.equal(journal.lines.find((l) => l.account === "4000").debit, 10.01);
    const second = await call(merchant, "/refunds", {
      ...input,
      idempotencyKey: "paystack-unknown",
    });
    assert.equal(second.status, 201);
    const id = second.body.data.refund._id;
    failCreate = true;
    assert.equal((await call(root, `/refunds/${id}/execute`, {})).status, 500);
    assert.equal((await call(root, `/refunds/${id}/execute`, {})).status, 409);
    assert.equal(creates, 2);
    assert.equal(
      (await call(root, `/refunds/${id}/reconcile`, { providerRefundId: "71" }))
        .status,
      409,
    );
    assert.equal(
      (await Group.findById(parent).lean()).refundReservedMinor,
      1001,
    );
    assert.equal((await call(foreign, "/refund-readiness")).status, 404);
    const readiness = await call(merchant, "/refund-readiness");
    assert.equal(readiness.status, 200, JSON.stringify(readiness.body));
    assert.equal(
      readiness.body.data.readiness.merchandise.availableMinor,
      1998,
    );
    assert.equal(readiness.body.data.readiness.merchandise.reservable, true);
    assert.equal(readiness.body.data.readiness.payout.state, "review_required");
    assert.equal(
      JSON.stringify(readiness.body).includes("original-paystack"),
      false,
    );
  },
);
