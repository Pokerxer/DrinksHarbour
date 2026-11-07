"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const mongoose = require("mongoose"),
  fs = require("node:fs"),
  path = require("node:path");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
const statementPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/settlement/statement.js",
);
const statement = fs.existsSync(statementPath)
  ? require(statementPath)
  : undefined;
test(
  "read-only settlement statement projects exact source-traced money conservation with uncertain states and tenant denial",
  { skip: !uri },
  async (t) => {
    assert.equal(
      typeof statement?.child,
      "function",
      "settlement statement child projection exists",
    );
    await connectVenueMongo(t, "merchant_settlement");
    const oid = () => new mongoose.Types.ObjectId(),
      Order = require("../models/Order"),
      Child = require("../models/MerchantOrder"),
      Set = require("../models/MerchantOrderSet"),
      Claim = require("../models/MarketplacePaymentClaim"),
      Journal = require("../models/JournalEntry"),
      Budget = require("../models/MerchantDispatchBudget"),
      Basis = require("../models/MerchantGoodsCancellation"),
      Refund = require("../models/MerchantRefundAllocation");
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
    await Order.collection.insertOne({
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
    });
    const groups =
      require("../services/merchantFulfillment/allocation").allocate({
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
      });
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
    const refunds = require("../services/merchantFulfillment/refunds");
    const request = (group, amount, key, actor = root) =>
      refunds.request(
        group._id,
        { amountMinor: amount, idempotencyKey: key, reason: "Synthetic settlement statement refund" },
        actor,
      );
    const transport = require("../services/merchantFulfillment/refundTransport");
    let calls = 0;
    t.mock.method(transport, "submit", async (row) => {
      calls++;
      if (calls === 2) throw new Error("synthetic transport outage");
      return {
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
      };
    });
    const oldFlag = process.env.MERCHANT_REFUNDS_ENABLED;
    process.env.MERCHANT_REFUNDS_ENABLED = "true";
    t.after(() => {
      if (oldFlag === undefined) delete process.env.MERCHANT_REFUNDS_ENABLED;
      else process.env.MERCHANT_REFUNDS_ENABLED = oldFlag;
    });
    const settled = await request(a, 500, "s-settled");
    await refunds.execute(String(settled._id), root);
    const held = await request(a, 300, "s-held");
    const uncertainRow = await request(a, 200, "s-uncertain");
    await assert.rejects(
      () => refunds.execute(String(uncertainRow._id), root),
      /synthetic transport outage/,
    );
    assert.equal(
      (await Refund.findById(uncertainRow._id).lean()).state,
      "uncertain",
    );
    const goodsJournalRef = oid();
    await Basis.create({
      _id: require("../services/merchantFulfillment/allocation").hash(
        `${parent}:${tenantA}:goods-cost-v1`,
      ),
      order: parent,
      tenant: tenantA,
      originalCostMinor: 800,
      fingerprint: "synthetic-goods-fingerprint",
      lines: [{ line: String(items[0]._id), merchantOrder: a._id, costMinor: 800 }],
      cancellations: [
        {
          merchantOrder: a._id,
          journalRef: goodsJournalRef,
          costMinor: 500,
          allocation: "synthetic-goods-allocation",
          actor: root._id,
          cancelledAt: new Date(),
        },
      ],
      version: 1,
    });
    await require("../services/journalEntry.service").postJournalEntry({
      tenantId: tenantA,
      refDoc: goodsJournalRef,
      refDocType: "MerchantGoodsCancellation",
      entryType: "inventory_adjust",
      source: "merchant_goods_cancel",
      lines: [
        { account: "1200", debit: 5, credit: 0 },
        { account: "5000", debit: 0, credit: 5 },
      ],
    });
    await Budget.create({
      _id: a._id,
      order: parent,
      tenant: tenantA,
      shippingMinor: 300,
      reservedMinor: 300,
      committedMinor: 250,
    });
    const countsBefore = {
      journals: await Journal.countDocuments(),
      refunds: await Refund.countDocuments(),
      basis: await Basis.countDocuments(),
      budgets: await Budget.countDocuments(),
      setVersion: (await Set.findById(parent).lean()).version,
      childVersion: (await Child.findById(a._id).lean()).version,
    };
    const first = await statement.child(a._id, merchantA);
    const second = await statement.child(a._id, merchantA);
    assert.equal(JSON.stringify(first), JSON.stringify(second));
    assert.equal(
      (await Journal.countDocuments()),
      countsBefore.journals,
      "statement read must not write journals",
    );
    assert.equal(
      (await Refund.countDocuments()),
      countsBefore.refunds,
      "statement read must not create allocations",
    );
    assert.equal((await Set.findById(parent).lean()).version, countsBefore.setVersion);
    assert.equal((await Child.findById(a._id).lean()).version, countsBefore.childVersion);
    assert.equal(first.statementVersion, 1);
    assert.equal(first.readOnly, true);
    assert.equal(first.currency, "NGN");
    // Exact component conservation from immutable records
    assert.equal(first.totals.grossMinor, 2000);
    assert.equal(first.totals.discountMinor, 0);
    assert.equal(first.totals.merchandiseMinor, 2000);
    assert.equal(first.totals.tenantShareMinor, 1600);
    assert.equal(first.totals.commissionMinor, 400);
    assert.equal(first.totals.totalMinor, 2000);
    assert.equal(
      first.totals.grossMinor - first.totals.discountMinor,
      first.totals.merchandiseMinor,
    );
    assert.equal(
      first.totals.tenantShareMinor + first.totals.commissionMinor,
      first.totals.merchandiseMinor,
    );
    assert.equal(first.scope.childId, String(a._id));
    assert.equal(first.scope.orderId, String(parent));
    assert.equal(first.scope.tenantId, String(tenantA));
    assert.match(first.sources.totals, new RegExp(`MerchantOrder:${a._id}`));
    // Refunds: reserved vs settled from immutable counters + allocations
    assert.equal(first.refunds.reservedMinor, 500);
    assert.equal(first.refunds.settledMinor, 500);
    assert.equal(first.refunds.settledCommissionMinor, 100);
    assert.equal(first.refunds.settledTenantShareMinor, 400);
    const succeeded = first.refunds.allocations.filter(
      (row) => row.state === "succeeded",
    );
    assert.equal(
      succeeded.reduce((n, row) => n + row.amountMinor, 0),
      first.refunds.settledMinor,
    );
    assert.equal(
      succeeded.reduce((n, row) => n + row.commissionMinor, 0),
      first.refunds.settledCommissionMinor,
    );
    for (const row of first.refunds.allocations)
      assert.match(row.source, /^MerchantRefundAllocation:[0-9a-f]{24}$/);
    assert.equal(
      first.refunds.allocations.some((row) => row.id === String(uncertainRow._id) && row.state === "uncertain"),
      true,
      "uncertain allocation must be surfaced",
    );
    // Commission reversal == refundedCommissionMinor, traced to refund journals
    assert.equal(first.commissionReversal.settledMinor, 100);
    // Net receivable identity: tenantShare − settled refunds ± commission reversal = net
    assert.equal(
      first.netReceivable.settledMinor +
        first.refunds.settledMinor -
        first.refunds.settledCommissionMinor,
      first.totals.tenantShareMinor,
    );
    assert.equal(first.netReceivable.settledMinor, 1200);
    assert.equal(first.netReceivable.reservedMinor, 500);
    assert.equal(first.netReceivable.projectedMinor, 700);
    // Goods cost from frozen basis
    assert.equal(first.goodsCost.originalCostMinor, 800);
    assert.equal(first.goodsCost.cancelledCostMinor, 500);
    assert.equal(first.goodsCost.netCostMinor, 300);
    assert.ok(first.goodsCost.sourceId);
    // Carrier cost committed spend marked journal-exempt
    assert.equal(first.carrierCost.committedMinor, 250);
    assert.equal(first.carrierCost.journalExempt, true);
    assert.equal(first.carrierCost.sourceId, String(a._id));
    // Journals traced with exact refundAuthority signed sums
    assert.equal(first.journals.sales.merchandiseMinor, 2000);
    assert.equal(first.journals.sales.tenantShareMinor, 1600);
    assert.equal(first.journals.sales.commissionMinor, 400);
    assert.ok(first.journals.sales.sourceId);
    const refundJournal = first.journals.refunds.find(
      (row) => row.refDoc === String(settled._id),
    );
    assert.ok(refundJournal, "settled refund journal must be traced");
    assert.equal(refundJournal.amountMinor, 500);
    assert.equal(refundJournal.tenantShareMinor, 400);
    assert.equal(refundJournal.commissionMinor, 100);
    assert.equal(first.journals.goodsCancellations.length, 1);
    assert.equal(first.journals.goodsCancellations[0].costMinor, 500);
    // Partial refundSettlement needs_review + uncertain surfacing
    assert.equal(first.reconciliation.state, "needs_review");
    assert.equal(
      first.reconciliation.items.some(
        (row) => row.scope === "refundSettlement" && row.state === "needs_review",
      ),
      true,
      "partial refund settlement must surface revenueAgreement needs_review",
    );
    assert.equal(
      first.reconciliation.uncertain.some(
        (row) => row.id === String(uncertainRow._id),
      ),
      true,
    );
    assert.equal(first.payout.state, "review_required");
    assert.match(first.payout.reason, /No payout execution exists/);
    // No provider/private credential data leaks into the statement
    const dump = JSON.stringify(first);
    assert.doesNotMatch(dump, /pi_synthetic|re_synthetic/);
    assert.ok(!dump.includes("provider"), "no provider identity fields");
    // Set-level tenant-scoped aggregate
    assert.equal(first.set.orderId, String(parent));
    assert.equal(first.set.totals.merchandiseMinor, 2000);
    assert.equal(first.set.totals.settledMinor, 500);
    // Clean child reconciles without refunds
    const clean = await statement.child(b._id, merchantB);
    assert.equal(clean.reconciliation.state, "reconciled");
    assert.equal(clean.refunds.settledMinor, 0);
    assert.equal(clean.netReceivable.settledMinor, 1600);
    assert.equal(clean.reconciliation.uncertain.length, 0);
    assert.equal(clean.carrierCost.committedMinor, 0);
    assert.equal(clean.goodsCost.originalCostMinor, 0);
    // Foreign tenant denial (service and HTTP)
    await assert.rejects(
      () => statement.child(b._id, merchantA),
      (error) =>
        error instanceof
        require("../utils/errors").NotFoundError,
    );
    const express = require("express"),
      jwt = require("jsonwebtoken"),
      User = require("../models/User");
    await User.collection.insertMany([
      { _id: root._id, role: "super_admin", status: "active" },
      { _id: merchantA._id, tenant: tenantA, role: "tenant_owner", status: "active" },
      { _id: merchantB._id, tenant: tenantB, role: "tenant_owner", status: "active" },
    ]);
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "merchant-settlement-http-test";
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
    const call = async (actor, route) => {
      const result = await fetch(
        `http://127.0.0.1:${server.address().port}/merchant-orders${route}`,
        {
          headers: {
            Authorization: `Bearer ${jwt.sign({ userId: String(actor._id) }, process.env.JWT_SECRET)}`,
          },
        },
      );
      return { status: result.status, body: await result.json().catch(() => null) };
    };
    const own = await call(merchantA, `/${a._id}/settlement-statement`);
    assert.equal(own.status, 200, JSON.stringify(own.body));
    assert.equal(own.body.data.statement.totals.merchandiseMinor, 2000);
    assert.equal(
      (await call(merchantA, `/${b._id}/settlement-statement`)).status,
      404,
      "foreign tenant statement must be denied",
    );
    assert.equal(
      (await call(root, `/${b._id}/settlement-statement`)).status,
      200,
      "platform admin may read statements",
    );
    assert.equal(await Journal.countDocuments(), countsBefore.journals);
  },
);
