"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  mongoose = require("mongoose");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
test(
  "original Paystack V2 refund binds exact original units and preserves unreturned goods and original cost journals",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "merchant_paystack_units");
    const oid = () => new mongoose.Types.ObjectId(),
      tenant = oid(),
      buyer = oid(),
      parent = oid();
    const actor = { _id: oid(), role: "super_admin" },
      merchant = { _id: oid(), tenant, role: "tenant_owner" };
    const Order = require("../models/Order"),
      Child = require("../models/MerchantOrder"),
      Group = require("../models/MerchantOrderSet");
    const Claim = require("../models/MarketplacePaymentClaim"),
      Refund = require("../models/MerchantRefundAllocation"),
      Journal = require("../models/JournalEntry"),
      Hold = require("../models/OnlineStockReservation");
    const line = {
      _id: oid(),
      fulfillmentLineId: oid(),
      tenant,
      warehouse: oid(),
      product: oid(),
      subproduct: oid(),
      size: oid(),
      quantity: 3,
      itemSubtotal: 10.01,
      discountAmount: 0,
      tenantRevenueShare: 8.68,
      platformCommission: 1.33,
      vendorPriceAtPurchase: 2,
    };
    const raw = {
      _id: parent,
      user: buyer,
      currency: "NGN",
      subtotal: 10.01,
      totalAmount: 10.01,
      items: [line],
      source: "web",
      settlementOwner: "platform",
      merchantFulfillmentVersion: 2,
      paymentStatus: "paid",
      shippingFee: 0,
      taxAmount: 0,
    };
    await Order.collection.insertOne(raw);
    const [allocation] =
      require("../services/merchantFulfillment/allocation").allocate(raw);
    const child = await Child.create({
      ...allocation,
      fulfillmentVersion: 2,
      quantityProgress: [{ line: String(line.fulfillmentLineId) }],
    });
    await Hold.create({
      _id: "paystack-unit-hold",
      order: parent,
      tenant,
      warehouse: line.warehouse,
      product: line.product,
      subProduct: line.subproduct,
      size: line.size,
      quantity: 3,
      state: "reserved",
      reservationVersion: 2,
      merchantOrder: child._id,
      fulfillmentLineId: String(line.fulfillmentLineId),
      consumedQuantity: 0,
      releasedQuantity: 0,
      unitDispositions: [],
      batchAllocations: [],
    });
    await Group.create({
      _id: parent,
      currency: "NGN",
      totalMinor: 1001,
      children: [child._id],
      allocationPolicy: "merchandise-weighted-v1",
    });
    const claim = {
      _id: "paystack:platform:original-unit-charge",
      provider: "paystack",
      account: "platform",
      reference: "original-unit-charge",
      user: buyer,
      amount: 10.01,
      currency: "NGN",
      state: "allocated",
      order: parent,
      receipt: {
        method: "paystack",
        reference: "original-unit-charge",
        transactionId: "1641",
        amount: 10.01,
        currency: "NGN",
      },
    };
    await Claim.create(claim);
    await require("../services/chartOfAccounts.service").ensureDefaultCOA(
      tenant,
    );
    await require("../services/journalEntry.service").postJournalEntry({
      tenantId: tenant,
      refDoc: parent,
      entryType: "sales_revenue",
      source: "marketplace",
      lines: [
        { account: "1300", debit: 8.68 },
        { account: "6500", debit: 1.33 },
        { account: "4000", credit: 10.01 },
      ],
    });
    await require("../services/journalEntry.service").postJournalEntry({
      tenantId: tenant,
      refDoc: parent,
      entryType: "cogs",
      source: "marketplace",
      lines: [
        { account: "5000", debit: 6 },
        { account: "1200", credit: 6 },
      ],
    });
    const goodsJournal = await Journal.findOne({
      refDoc: parent,
      entryType: "cogs",
    }).lean();
    const holdBefore = await Hold.findById("paystack-unit-hold").lean();
    const input = {
      lines: [
        {
          line: String(line.fulfillmentLineId),
          ranges: [{ start: 1, quantity: 1 }],
        },
      ],
      expectedVersion: 1,
      idempotencyKey: "middle-unit",
      reason: "Synthetic unit refund only",
    };
    const units = require("../services/merchantFulfillment/quantity/refunds"),
      api = require("../services/merchantFulfillment/refunds");
    for (const transactionId of [
      "original-unit-charge",
      "01",
      "1.0",
      "9007199254740993",
      0,
    ]) {
      await Claim.updateOne(
        { _id: claim._id },
        { $set: { "receipt.transactionId": transactionId } },
      );
      await assert.rejects(() => units.request(child._id, input, merchant), {
        statusCode: 409,
      });
      assert.equal(await Refund.countDocuments({}), 0);
    }
    await Claim.updateOne(
      { _id: claim._id },
      { $set: { "receipt.transactionId": "1641" } },
    );
    await Claim.create({
      ...claim,
      _id: "wallet:platform:ambiguous-debit",
      provider: "wallet",
      reference: "ambiguous-debit",
      receipt: {
        ...claim.receipt,
        method: "wallet",
        reference: "ambiguous-debit",
      },
    });
    await assert.rejects(
      () => units.request(child._id, input, merchant),
      { statusCode: 409 },
      "two allocated sources cannot select a convenient supported refund destination",
    );
    assert.equal(await Refund.countDocuments({}), 0);
    await Claim.deleteOne({ _id: "wallet:platform:ambiguous-debit" });
    const reserved = await units.request(child._id, input, merchant);
    assert.equal(reserved.amountMinor, 334);
    assert.deepEqual(reserved.unitRanges, input.lines);
    const saved = await Refund.findById(reserved._id).lean();
    assert.equal(saved.provider, "paystack");
    assert.equal(saved.providerTransactionId, "1641");
    assert.equal(saved.commissionMinor, 44);
    assert.equal(saved.tenantShareMinor, 290);
    await assert.rejects(
      () =>
        units.request(
          child._id,
          { ...input, idempotencyKey: "overlap", expectedVersion: 2 },
          merchant,
        ),
      { statusCode: 409 },
    );
    const old = {};
    for (const key of [
      "MERCHANT_REFUNDS_ENABLED",
      "MERCHANT_PAYSTACK_REFUNDS_ENABLED",
      "PAYSTACK_SECRET_KEY",
    ])
      old[key] = process.env[key];
    Object.assign(process.env, {
      MERCHANT_REFUNDS_ENABLED: "true",
      MERCHANT_PAYSTACK_REFUNDS_ENABLED: "true",
      PAYSTACK_SECRET_KEY: "synthetic-no-network",
    });
    const axios = require("axios"),
      oldPost = axios.post,
      oldGet = axios.get;
    let calls = 0;
    axios.post = async (url, body) => {
      calls++;
      assert.equal(body.amount, 334);
      assert.equal(body.transaction, "original-unit-charge");
      return {
        data: {
          status: true,
          data: {
            id: 75,
            transaction: { id: 1641, reference: "original-unit-charge" },
            amount: 334,
            currency: "NGN",
            status: "pending",
            merchant_note: body.merchant_note,
          },
        },
      };
    };
    axios.get = async () => ({
      data: {
        status: true,
        data: {
          id: 75,
          transaction: 1641,
          amount: 334,
          currency: "NGN",
          status: "processed",
        },
      },
    });
    t.after(() => {
      axios.post = oldPost;
      axios.get = oldGet;
      for (const [key, value] of Object.entries(old)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
    await api.execute(String(reserved._id), actor);
    await api.execute(String(reserved._id), actor);
    assert.equal(calls, 1);
    const after = await Child.findById(child._id).lean();
    assert.equal(after.refundedMinor, 334);
    assert.equal(after.refundReservedMinor, 0);
    assert.equal(after.quantityProgress[0].financialBlocks[0].kind, "refunded");
    assert.equal(after.quantityProgress[0].shipped, 0);
    assert.equal(after.quantityProgress[0].cancelled, 0);
    assert.equal(after.version, 3);
    assert.deepEqual(
      await Hold.findById("paystack-unit-hold").lean(),
      holdBefore,
    );
    assert.deepEqual(
      await Journal.findById(goodsJournal._id).lean(),
      goodsJournal,
    );
    assert.equal(await Journal.countDocuments({ entryType: "refund" }), 1);
    assert.equal((await Group.findById(parent).lean()).refundedMinor, 334);
  },
);
