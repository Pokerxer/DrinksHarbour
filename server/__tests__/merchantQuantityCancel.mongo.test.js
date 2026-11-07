"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
test(
  "version2 cancellation releases exactly refunded held units and money-only refund never restocks shipped goods",
  { skip: !uri },
  async (t) => {
    const target = path.resolve(
        __dirname,
        "../services/merchantFulfillment/quantity/commands.js",
      ),
      commands = fs.existsSync(target) ? require(target) : {};
    assert.equal(typeof commands.cancelQuantities, "function");
    await connectVenueMongo(t, "merchant_quantity_cancel");
    const names = [
        "MERCHANT_FULFILLMENT_ENABLED",
        "MERCHANT_QUANTITY_FULFILLMENT_ENABLED",
        "MERCHANT_REFUNDS_ENABLED",
      ],
      before = names.map((key) => process.env[key]);
    for (const key of names) process.env[key] = "true";
    t.after(() => {
      for (const [index, key] of names.entries())
        if (before[index] === undefined) delete process.env[key];
        else process.env[key] = before[index];
    });
    // These parent IDs force the opposite lexical orders of the repeated-SKU line hashes.
    for (const orderId of ["000000000000000000000004", "000000000000000000000001"]) {
    const { order, actors, tenants, admin } =
        await require("./helpers/merchantQuantityFixture").fixture({
          cost: 3.336,
          orderId,
        }),
      Child = require("../models/MerchantOrder"),
      Stock = require("../models/WarehouseStock"),
      Batch = require("../models/WarehouseBatch");
    const a = await Child.findOne({
        order: order._id,
        tenant: tenants[0]._id,
      }).lean(),
      line = a.lines.find((row) => row.quantity === 3);
    const ownHold = await require("../models/OnlineStockReservation").findOne({ order: order._id, merchantOrder: a._id, fulfillmentLineId: String(line.line), reservationVersion: 2 }).lean();
    const firstBatch = await Batch.findById(ownHold.batchAllocations[0].batch).lean();
    assert.equal(firstBatch.batchNumber, orderId.endsWith("4") ? "EARLY" : "LATER", "Both deterministic line-hash allocation orders are exercised");
    t.diagnostic(`parent ${orderId}: selected three-unit line initially owns ${firstBatch.batchNumber}`);
    const originalBatches = await Batch.find({ tenant: tenants[0]._id }).lean();
    const siblingHold = await require("../models/OnlineStockReservation").findOne({ order: order._id, merchantOrder: a._id, _id: { $ne: ownHold._id } }).lean();
    assert.ok(siblingHold, "The repeated-SKU sibling owns a distinct frozen hold");
    let ordinal = 1, refundedBatch;
    for (const allocation of ownHold.batchAllocations) {
      if (ordinal < allocation.quantity) { refundedBatch = String(allocation.batch); break; }
      ordinal -= allocation.quantity;
    }
    assert.ok(refundedBatch, "Original hold identifies the exact batch for unit ordinal1");
    const assertBatchRestoration = async () => {
      const current = await Batch.find({ tenant: tenants[0]._id }).lean();
      assert.equal(current.length, originalBatches.length);
      for (const original of originalBatches) {
        const actual = current.find(row => String(row._id) === String(original._id));
        assert.equal(actual.quantity, original.quantity + (String(original._id) === refundedBatch ? 1 : 0), "Only the refunded unit's original frozen batch is restored once");
      }
      assert.equal(current.reduce((sum,row) => sum + row.quantity, 0), originalBatches.reduce((sum,row) => sum + row.quantity, 0) + 1);
    };
    assert.ok(order.items.every(item => item.vendorPriceAtPurchase === 3.336), "Nonzero original cost snapshots required for integrated cancellation proof");
    const originalCost = await require("../models/JournalEntry").findOne({tenant: tenants[0]._id, refDoc: order._id, entryType: "cogs"}).lean();
    assert.equal(originalCost.lines.find(row => row.account === "5000").debit, 16.68, "Original cost posted before shipment");
    await require("../models/MarketplacePaymentClaim").create({
      _id: `stripe:platform:${order.paymentDetails.reference}`,
      provider: "stripe",
      account: "platform",
      reference: order.paymentDetails.reference,
      user: order.user,
      amount: order.totalAmount,
      currency: "NGN",
      state: "allocated",
      order: order._id,
      receipt: {
        method: "stripe",
        reference: order.paymentDetails.reference,
        amount: order.totalAmount,
        currency: "NGN",
      },
    });
    let submits = 0;
    t.mock.method(
      require("../services/merchantFulfillment/refundTransport"),
      "submit",
      async (row) => ({
        id: "re_quantity_" + order._id + "_" + ++submits,
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
    const version = async () => (await Child.findById(a._id).lean()).version;
    await require("../services/merchantFulfillment/actions").act(
      a._id,
      { action: "accept", expectedVersion: 1, idempotencyKey: "accept" },
      actors[0],
    );
    await commands.shipQuantities(
      a._id,
      {
        lines: [{ line: String(line.line), quantity: 1 }],
        expectedVersion: await version(),
        idempotencyKey: "ship-first",
      },
      actors[0],
    );
    const reserve =
      await require("../services/merchantFulfillment/quantity/refunds").request(
        a._id,
        {
          lines: [
            { line: String(line.line), ranges: [{ start: 1, quantity: 1 }] },
          ],
          expectedVersion: await version(),
          idempotencyKey: "refund-unit-one",
          reason: "Refund own unshipped unit",
        },
        actors[0],
      );
    await assert.rejects(
      () =>
        commands.cancelQuantities(
          a._id,
          {
            lines: [{ line: String(line.line), quantity: 1 }],
            expectedVersion: 0,
            idempotencyKey: "stale",
          },
          actors[0],
        ),
      /changed/i,
    );
    const pendingVersion = await version();
    await assert.rejects(
      () =>
        commands.cancelQuantities(
          a._id,
          {
            lines: [{ line: String(line.line), quantity: 1 }],
            expectedVersion: pendingVersion,
            idempotencyKey: "cannot-release-reserved-refund",
          },
          actors[0],
        ),
      /refund|remaining|unit/i,
    );
    await require("../services/merchantFulfillment/refunds").execute(
      String(reserve._id),
      admin,
    );
    const cancelInput = {
      lines: [{ line: String(line.line), quantity: 1 }],
      expectedVersion: await version(),
      idempotencyKey: "release-refunded-unit",
    };
    const cancelled = await Promise.all([
      commands.cancelQuantities(a._id, cancelInput, actors[0]),
      commands.cancelQuantities(a._id, cancelInput, actors[0]),
    ]);
    assert.equal(String(cancelled[0]._id), String(cancelled[1]._id));
    assert.deepEqual(
      cancelled[0].lines[0].ranges.map((r) => ({
        start: r.start,
        quantity: r.quantity,
      })),
      [{ start: 1, quantity: 1 }],
    );
    assert.equal(
      (await Stock.findOne({ tenant: tenants[0]._id }).lean()).currentQuantity,
      9,
    );
    assert.equal(
      (await Stock.findOne({ tenant: tenants[0]._id }).lean()).reservedQuantity,
      3,
    );
    assert.deepEqual(cancelled[0].lines[0].batchAllocations.map(row => ({batch: String(row.batch), quantity: row.quantity})), [{batch: refundedBatch, quantity: 1}], "Cancellation records the exact original unit batch");
    await assertBatchRestoration();
    const costJournals = await require("../models/JournalEntry")
      .find({ tenant: tenants[0]._id, source: "merchant_goods_cancel" })
      .lean();
    assert.equal(costJournals.length, 1);
    assert.equal(String(costJournals[0].refDoc), String(cancelled[0]._id));
    assert.equal(
      costJournals[0].lines.find((row) => row.account === "1200").debit,
      3.34,
    );
    assert.equal(
      costJournals[0].lines.find((row) => row.account === "5000").credit,
      3.34,
    );
    const second =
      await require("../services/merchantFulfillment/quantity/refunds").request(
        a._id,
        {
          lines: [
            { line: String(line.line), ranges: [{ start: 0, quantity: 1 }] },
          ],
          expectedVersion: await version(),
          idempotencyKey: "refund-shipped-unit",
          reason: "Refund money for shipped unit without goods return",
        },
        actors[0],
      );
    await require("../services/merchantFulfillment/refunds").execute(
      String(second._id),
      admin,
    );
    assert.equal(
      (await Stock.findOne({ tenant: tenants[0]._id }).lean()).currentQuantity,
      9,
    );
    assert.equal(
      await require("../models/JournalEntry").countDocuments({
        tenant: tenants[0]._id,
        source: "merchant_goods_cancel",
      }),
      1,
    );
    const last = await commands.shipQuantities(
      a._id,
      {
        lines: [{ line: String(line.line), quantity: 1 }],
        expectedVersion: await version(),
        idempotencyKey: "ship-last-owned-unit",
      },
      actors[0],
    );
    assert.deepEqual(
      last.lines[0].ranges.map((r) => ({
        start: r.start,
        quantity: r.quantity,
      })),
      [{ start: 2, quantity: 1 }],
    );
    const currentVersion = await version();
    await assert.rejects(
      () =>
        commands.cancelQuantities(
          a._id,
          {
            lines: [{ line: String(line.line), quantity: 1 }],
            expectedVersion: currentVersion,
            idempotencyKey: "cannot-release-shipped-unit",
          },
          actors[0],
        ),
      /refund|remaining|unit/i,
    );
    assert.equal(
      (await Stock.findOne({ tenant: tenants[0]._id }).lean()).currentQuantity,
      8,
    );
    assert.equal(
      (await Stock.findOne({ tenant: tenants[1]._id }).lean()).currentQuantity,
      10,
    );
    await assertBatchRestoration();
    assert.deepEqual(await require("../models/OnlineStockReservation").findById(siblingHold._id).lean(), siblingHold, "Shipping and refund cancellation never borrow the repeated-SKU sibling's hold");
    assert.deepEqual((await require("../models/OnlineStockReservation").findById(ownHold._id).lean()).batchAllocations, ownHold.batchAllocations, "Original line batch ownership remains immutable");
    }
  },
);
