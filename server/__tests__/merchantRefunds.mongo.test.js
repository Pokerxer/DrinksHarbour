"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const mongoose = require("mongoose"),
  fs = require("node:fs"),
  path = require("node:path");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
test(
  "allocated merchant partial refunds preserve global money budgets, original-account evidence, journal and uncertain recovery",
  { skip: !uri },
  async (t) => {
    const target = path.resolve(
        __dirname,
        "../services/merchantFulfillment/refunds.js",
      ),
      refunds = fs.existsSync(target) ? require(target) : {};
    assert.equal(
      typeof refunds.request,
      "function",
      "merchant partial refund reservation exists",
    );
    await connectVenueMongo(t, "merchant_refunds");
    const oid = () => new mongoose.Types.ObjectId(),
      Order = require("../models/Order"),
      Child = require("../models/MerchantOrder"),
      Set = require("../models/MerchantOrderSet"),
      Claim = require("../models/MarketplacePaymentClaim"),
      Journal = require("../models/JournalEntry");
    const root = { _id: oid(), role: "super_admin" },
      buyer = oid(),
      tenantA = oid(),
      tenantB = oid(),
      merchantA = { _id: oid(), role: "tenant_owner", tenant: tenantA },
      merchantB = { _id: oid(), role: "tenant_owner", tenant: tenantB };
    const parent = oid(),
      items = [tenantA, tenantB].map((tenant) => ({
        _id: oid(),
        tenant,
        warehouse: oid(),
        product: oid(),
        subproduct: oid(),
        size: oid(),
        quantity: 2,
        itemSubtotal: 20,
        discountAmount: 0,
        tenantRevenueShare: 16,
        platformCommission: 4,
      }));
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
      items,
    };
    await Order.collection.insertOne(raw);
    const groups =
      require("../services/merchantFulfillment/allocation").allocate(raw);
    await Child.create(groups);
    await Set.create({
      _id: parent,
      currency: "NGN",
      totalMinor: 4000,
      children: groups.map((g) => g._id),
      allocationPolicy: "merchandise-weighted-v1",
    });
    await Claim.create({
      _id: "stripe:platform:pi_synthetic_original",
      provider: "stripe",
      account: "platform",
      reference: "pi_synthetic_original",
      user: buyer,
      amount: 40,
      currency: "NGN",
      state: "allocated",
      order: parent,
      receipt: {
        method: "stripe",
        reference: "pi_synthetic_original",
        amount: 40,
        currency: "NGN",
      },
    });
    for (const tenant of [tenantA, tenantB]) {
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
          { account: "1300", debit: 16, credit: 0 },
          { account: "6500", debit: 4, credit: 0 },
          { account: "4000", debit: 0, credit: 20 },
        ],
      });
    }
    const a = groups.find((g) => String(g.tenant) === String(tenantA)),
      b = groups.find((g) => String(g.tenant) === String(tenantB));
    const request = (group, amount, key, actor = root) =>
      refunds.request(
        group._id,
        {
          amountMinor: amount,
          idempotencyKey: key,
          reason: "Synthetic merchant merchandise refund",
        },
        actor,
      );
    const journalFilter = {
      tenant: tenantA,
      refDoc: parent,
      entryType: "sales_revenue",
    };
    const originalJournal = await Journal.findOne(journalFilter).lean();
    await Journal.collection.updateOne(journalFilter, {
      $set: {
        lines: [
          { account: "1300", debit: 17, credit: 0 },
          { account: "6500", debit: 3, credit: 0 },
          { account: "4000", debit: 0, credit: 20 },
        ],
      },
    });
    try {
      await assert.rejects(
        () => request(a, 100, "wrong-commission-journal", merchantA),
        /journal|shares|settlement/i,
      );
    } finally {
      await Journal.collection.updateOne(journalFilter, {
        $set: { lines: originalJournal.lines },
      });
    }

    const reserved = await Promise.all([
      request(a, 500, "a-first", merchantA),
      request(a, 500, "a-first", merchantA),
    ]);
    assert.equal(String(reserved[0]._id), String(reserved[1]._id));
    await assert.rejects(
      () => request(a, 600, "a-first", merchantA),
      /key|another/i,
    );
    await assert.rejects(
      () => request(a, 1600, "a-over", merchantA),
      /budget|remaining|exceed/i,
    );
    await assert.rejects(
      () => request(b, 500, "foreign", merchantA),
      /not found/i,
    );
    assert.equal((await Set.findById(parent).lean()).refundReservedMinor, 500);
    await require("../services/merchantFulfillment/actions").act(
      a._id,
      {
        action: "accept",
        expectedVersion: 1,
        idempotencyKey: "accept-refund-held",
      },
      merchantA,
    );
    await assert.rejects(
      () =>
        require("../services/merchantFulfillment/actions").act(
          a._id,
          {
            action: "ship",
            expectedVersion: 2,
            idempotencyKey: "ship-refund-held",
          },
          merchantA,
        ),
      /refund/i,
    );
    const transport = require("../services/merchantFulfillment/refundTransport");
    let calls = 0;
    let response;
    t.mock.method(transport, "submit", async (row) => {
      calls++;
      return (
        response || {
          id: "re_synthetic_" + calls,
          status: "succeeded",
          amount: row.amountMinor,
          currency: "ngn",
          payment_intent: row.providerReference,
          metadata: {
            merchant_refund_allocation: String(row._id),
            merchant_order: row.merchantOrder,
            parent_order: String(row.order),
          },
        }
      );
    });
    const oldFlag = process.env.MERCHANT_REFUNDS_ENABLED;
    process.env.MERCHANT_REFUNDS_ENABLED = "true";
    t.after(() => {
      if (oldFlag === undefined) delete process.env.MERCHANT_REFUNDS_ENABLED;
      else process.env.MERCHANT_REFUNDS_ENABLED = oldFlag;
    });
    await assert.rejects(
      () => refunds.execute(String(reserved[0]._id), merchantA),
      /platform|admin/i,
    );
    const done = await refunds.execute(String(reserved[0]._id), root);
    assert.equal(done.state, "succeeded");
    await refunds.execute(String(done._id), root);
    assert.equal(calls, 1);
    assert.equal((await Set.findById(parent).lean()).refundedMinor, 500);
    assert.equal((await Child.findById(a._id).lean()).refundedMinor, 500);
    const posting = await Journal.findOne({
      tenant: tenantA,
      refDoc: done._id,
      entryType: "refund",
    }).lean();
    assert.ok(posting);
    assert.equal(
      posting.lines.reduce((n, l) => n + l.debit, 0),
      5,
    );
    assert.equal(
      posting.lines.reduce((n, l) => n + l.credit, 0),
      5,
    );
    assert.equal((await Child.findById(b._id).lean()).refundedMinor, 0);
    assert.equal(
      (await Order.findById(parent).lean()).paymentStatus,
      "partially_refunded",
    );
    const second = await request(a, 500, "a-uncertain");
    await Claim.updateOne(
      { _id: "stripe:platform:pi_synthetic_original" },
      { $set: { state: "needs_review" } },
    );
    await Claim.create({
      _id: "stripe:platform:pi_synthetic_replacement",
      provider: "stripe",
      account: "platform",
      reference: "pi_synthetic_replacement",
      user: buyer,
      amount: 40,
      currency: "NGN",
      state: "allocated",
      order: parent,
      receipt: {
        method: "stripe",
        reference: "pi_synthetic_replacement",
        amount: 40,
        currency: "NGN",
      },
    });
    try {
      await assert.rejects(
        () => refunds.execute(String(second._id), root),
        /receipt|original|changed/i,
      );
      assert.equal(
        calls,
        1,
        "changed original authority must be denied before provider transport",
      );
      assert.equal(
        (await refunds.get(String(second._id), root)).state,
        "reserved",
      );
    } finally {
      await Claim.deleteOne({
        _id: "stripe:platform:pi_synthetic_replacement",
      });
      await Claim.updateOne(
        { _id: "stripe:platform:pi_synthetic_original" },
        { $set: { state: "allocated" } },
      );
    }
    response = {
      id: "re_synthetic_wrong",
      status: "succeeded",
      amount: 499,
      currency: "ngn",
      payment_intent: "pi_synthetic_original",
    };
    await assert.rejects(
      () => refunds.execute(String(second._id), root),
      /evidence|match|reconcil/i,
    );
    assert.equal(
      (await refunds.get(String(second._id), root)).state,
      "uncertain",
    );
    await assert.rejects(
      () => refunds.execute(String(second._id), root),
      /reconcil/i,
    );
    assert.equal(calls, 2);
    assert.equal((await Set.findById(parent).lean()).refundReservedMinor, 500);
    t.mock.method(transport, "fetch", async (id) => ({
      id,
      status: "succeeded",
      amount: 500,
      currency: "ngn",
      payment_intent: "pi_synthetic_original",
      metadata: {
        merchant_refund_allocation: String(second._id),
        merchant_order: a._id,
        parent_order: String(parent),
      },
    }));
    await assert.rejects(
      () =>
        refunds.reconcile(
          String(second._id),
          root,
          done.providerRefundId || "re_synthetic_1",
        ),
      /used|another|claimed|evidence/i,
    );
    assert.equal((await Set.findById(parent).lean()).refundedMinor, 500);
    await assert.rejects(
      () =>
        refunds.reconcile(
          String(second._id),
          merchantA,
          "re_synthetic_verified",
        ),
      /platform|admin/i,
    );
    const reconciled = await refunds.reconcile(
      String(second._id),
      root,
      "re_synthetic_verified",
    );
    assert.equal(reconciled.state, "succeeded");
    assert.equal((await Set.findById(parent).lean()).refundedMinor, 1000);
    assert.equal((await Set.findById(parent).lean()).refundReservedMinor, 0);
    assert.equal(
      await require("../models/WarehouseMovement").countDocuments(),
      0,
    );
    assert.equal(
      await require("../models/InventoryMovement").countDocuments(),
      0,
    );
    await assert.rejects(
      () => require("../services/marketplaceRefund").execute(parent, 5, root),
      /allocated merchant/i,
    );
    await Set.updateOne(
      { _id: parent },
      { $set: { refundReservedMinor: 3000 } },
    );
    await assert.rejects(
      () => request(b, 100, "global-parent-budget", merchantB),
      /budget|exceed/i,
    );
    assert.equal((await Child.findById(b._id).lean()).refundReservedMinor, 0);
    await Set.updateOne({ _id: parent }, { $set: { refundReservedMinor: 0 } });
    const express = require("express"),
      jwt = require("jsonwebtoken"),
      User = require("../models/User");
    await User.collection.insertMany([
      { _id: root._id, role: "super_admin", status: "active" },
      {
        _id: merchantA._id,
        tenant: tenantA,
        role: "tenant_owner",
        status: "active",
      },
      {
        _id: merchantB._id,
        tenant: tenantB,
        role: "tenant_owner",
        status: "active",
      },
    ]);
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "merchant-refund-http-test";
    t.after(() => {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    });
    const app = express();
    app.use(express.json());
    app.use("/merchant-orders", require("../routes/merchantOrder.routes"));
    app.use((e, req, res, next) =>
      res.status(e.statusCode || 500).json({ message: e.message }),
    );
    const server = await new Promise((resolve) => {
      const value = app.listen(0, "127.0.0.1", () => resolve(value));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const call = async (actor, path, body) => {
      const result = await fetch(
        `http://127.0.0.1:${server.address().port}/merchant-orders${path}`,
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
        status: result.status,
        body: await result.json().catch(() => null),
      };
    };
    assert.equal(
      (
        await call(merchantA, `/${b._id}/refunds`, {
          amountMinor: 2000,
          reason: "Foreign merchant must not refund",
          idempotencyKey: "http-foreign",
        })
      ).status,
      404,
    );
    const reply = await call(merchantB, `/${b._id}/refunds`, {
      amountMinor: 2000,
      reason: "Refund own second merchant allocation",
      idempotencyKey: "http-b-refund",
    });
    assert.equal(reply.status, 201, JSON.stringify(reply.body));
    const refundB = reply.body.data.refund;
    assert.equal((await call(merchantA, `/${b._id}/refunds`)).status, 404);
    assert.equal(
      (await call(merchantB, `/${b._id}/refunds/${refundB._id}/execute`, {}))
        .status,
      403,
    );
    response = undefined;
    assert.equal(
      (await call(root, `/${b._id}/refunds/${refundB._id}/execute`, {})).status,
      200,
    );
    assert.equal((await Set.findById(parent).lean()).refundedMinor, 3000);
    assert.equal((await Set.findById(parent).lean()).refundReservedMinor, 0);
    assert.equal((await Child.findById(a._id).lean()).refundedMinor, 1000);
    assert.equal((await Child.findById(b._id).lean()).refundedMinor, 2000);
    assert.equal(
      (await call(root, `/${a._id}/refunds/${refundB._id}/execute`, {})).status,
      404,
    );
  },
);
