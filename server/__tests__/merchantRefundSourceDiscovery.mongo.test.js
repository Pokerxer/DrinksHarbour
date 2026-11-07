"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose"),
  fs = require("node:fs"),
  path = require("node:path");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
const discoveryPath = path.resolve(
  __dirname,
  "../services/merchantFulfillment/refundSources/discovery.js",
);
const discovery = fs.existsSync(discoveryPath)
  ? require(discoveryPath)
  : null;

const KORAPAY_REVIEW =
  "Original tender refund capability requires review. Korapay fallback transactionId identity is ambiguous.";
const KORAPAY_PROTOCOL =
  "Original tender refund capability requires review. Korapay refund protocol and original identity policy require review.";
const TENDER_REVIEW = "Original tender refund capability requires review.";

async function claim(model, row) {
  await model.create(row);
}
const checkoutDebitId = (user, key) =>
  crypto.createHash("sha256").update(`${user}:${key}`).digest("hex");

test(
  "original-source discovery resolves exact claim/debit identities read-only with first-class unknown and ambiguous outcomes",
  { skip: !uri },
  async (t) => {
    assert.ok(discovery, "refund-source discovery module exists");
    assert.equal(typeof discovery.resolveOrderSources, "function");
    assert.equal(typeof discovery.describeOrderSources, "function");
    assert.equal(typeof discovery.resolveStoredValueFunding, "function");
    await connectVenueMongo(t, "refund_source_discovery");
    const oid = () => new mongoose.Types.ObjectId(),
      buyer = oid();
    const Order = require("../models/Order"),
      Claim = require("../models/MarketplacePaymentClaim"),
      WalletTransaction = require("../models/PlatformWalletTransaction"),
      GiftTransaction = require("../models/GiftCardTransaction"),
      CheckoutDebit = require("../models/CheckoutDebit"),
      Funding = require("../models/StoredValueFunding");
    const paidOrder = () => ({
      user: buyer,
      currency: "NGN",
      paymentStatus: "paid",
      status: "confirmed",
      source: "web",
      settlementOwner: "platform",
      merchantFulfillmentVersion: 1,
    });
    const mkOrder = async () => {
      const parent = oid();
      await Order.collection.insertOne({ _id: parent, ...paidOrder() });
      return parent;
    };
    // 1. Supported paystack original with a distinct canonical numeric transaction id.
    const paystackOrder = await mkOrder();
    await claim(Claim, {
      _id: "paystack:platform:dhm-payref",
      provider: "paystack",
      account: "platform",
      reference: "dhm-payref",
      user: buyer,
      amount: 20,
      currency: "NGN",
      state: "allocated",
      order: paystackOrder,
      receipt: {
        method: "paystack",
        reference: "dhm-payref",
        transactionId: "918273",
        amount: 20,
        currency: "NGN",
        paidAt: new Date(),
      },
    });
    // 2. Korapay fallback ambiguity: transactionId fell back to the merchant reference.
    const korapayFallbackOrder = await mkOrder();
    await claim(Claim, {
      _id: "korapay:platform:dhm-korafallback",
      provider: "korapay",
      account: "platform",
      reference: "dhm-korafallback",
      user: buyer,
      amount: 20,
      currency: "NGN",
      state: "allocated",
      order: korapayFallbackOrder,
      receipt: {
        method: "korapay",
        reference: "dhm-korafallback",
        transactionId: "dhm-korafallback",
        amount: 20,
        currency: "NGN",
        paidAt: new Date(),
      },
    });
    // 3. Korapay with a distinct recorded transaction id: identity resolved, refund capability still review-only.
    const korapayDistinctOrder = await mkOrder();
    await claim(Claim, {
      _id: "korapay:platform:dhm-koradistinct",
      provider: "korapay",
      account: "platform",
      reference: "dhm-koradistinct",
      user: buyer,
      amount: 20,
      currency: "NGN",
      state: "allocated",
      order: korapayDistinctOrder,
      receipt: {
        method: "korapay",
        reference: "dhm-koradistinct",
        transactionId: "736251",
        amount: 20,
        currency: "NGN",
        paidAt: new Date(),
      },
    });
    // 4. Wallet tender: exact original debit ledger row plus checkout debit binding.
    const walletOrder = await mkOrder();
    const walletTx = await WalletTransaction.create({
      userId: buyer,
      type: "debit",
      amount: 5,
      balanceAfter: 0,
      source: "online_checkout",
      relatedOrder: null,
    });
    await CheckoutDebit.create({
      _id: checkoutDebitId(String(buyer), "wallet-request"),
      user: buyer,
      method: "wallet",
      transaction: walletTx._id,
    });
    await claim(Claim, {
      _id: `wallet:platform:${walletTx._id}`,
      provider: "wallet",
      account: "platform",
      reference: String(walletTx._id),
      user: buyer,
      amount: 5,
      currency: "NGN",
      state: "allocated",
      order: walletOrder,
      receipt: {
        method: "wallet",
        reference: String(walletTx._id),
        transactionId: String(walletTx._id),
        amount: 5,
        currency: "NGN",
        paidAt: new Date(),
      },
    });
    // 5. Gift-card tender: redeem ledger row, checkout debit and credited funding kind/target.
    const giftOrder = await mkOrder(),
      giftCardId = oid();
    const giftTx = await GiftTransaction.create({
      giftCardId,
      type: "redeem",
      amount: 5,
      balanceAfter: 0,
      checkoutReceipt: true,
      relatedOrder: null,
      createdBy: buyer,
    });
    await CheckoutDebit.create({
      _id: checkoutDebitId(String(buyer), "gift-request"),
      user: buyer,
      method: "gift_card",
      transaction: giftTx._id,
    });
    await Funding.create({
      _id: "paystack:platform:dhm-giftfund",
      provider: "paystack",
      reference: "dhm-giftfund",
      user: buyer,
      amount: 5,
      currency: "NGN",
      kind: "gift_card_purchase",
      target: giftCardId,
      state: "credited",
    });
    await claim(Claim, {
      _id: `gift_card:platform:${giftTx._id}`,
      provider: "gift_card",
      account: "platform",
      reference: String(giftTx._id),
      user: buyer,
      amount: 5,
      currency: "NGN",
      state: "allocated",
      order: giftOrder,
      receipt: {
        method: "gift_card",
        reference: String(giftTx._id),
        transactionId: String(giftTx._id),
        amount: 5,
        currency: "NGN",
        paidAt: new Date(),
      },
    });
    // 6. Orphan wallet receipt: no recorded original debit ledger row.
    const orphanOrder = await mkOrder();
    const orphanTx = oid();
    await claim(Claim, {
      _id: `wallet:platform:${orphanTx}`,
      provider: "wallet",
      account: "platform",
      reference: String(orphanTx),
      user: buyer,
      amount: 5,
      currency: "NGN",
      state: "allocated",
      order: orphanOrder,
      receipt: {
        method: "wallet",
        reference: String(orphanTx),
        transactionId: String(orphanTx),
        amount: 5,
        currency: "NGN",
        paidAt: new Date(),
      },
    });
    const counts = {};
    for (const [name, Model] of Object.entries({
      claims: Claim,
      wallet: WalletTransaction,
      gift: GiftTransaction,
      debits: CheckoutDebit,
      funding: Funding,
    }))
      counts[name] = await Model.countDocuments();
    try {
      const paystack = await discovery.resolveOrderSources(paystackOrder);
      assert.equal(paystack.status, "resolved");
      assert.equal(paystack.sources.length, 1);
      assert.equal(paystack.sources[0].provider, "paystack");
      assert.equal(paystack.sources[0].identity, "resolved");
      assert.equal(paystack.sources[0].refundCapability, "supported");
      assert.equal(paystack.sources[0].claim.reference, "dhm-payref");
      assert.equal(paystack.sources[0].claim.transactionId, "918273");

      const fallback = await discovery.resolveOrderSources(korapayFallbackOrder);
      assert.equal(fallback.status, "ambiguous");
      assert.equal(fallback.sources[0].provider, "korapay");
      assert.equal(fallback.sources[0].identity, "ambiguous");
      assert.equal(fallback.sources[0].refundCapability, "review_required");
      assert.match(fallback.sources[0].reason, /fallback transactionId/);
      assert.equal(fallback.sources[0].reason, KORAPAY_REVIEW);

      const distinct = await discovery.resolveOrderSources(korapayDistinctOrder);
      assert.equal(distinct.status, "resolved");
      assert.equal(distinct.sources[0].identity, "resolved");
      assert.equal(distinct.sources[0].refundCapability, "review_required");
      assert.equal(distinct.sources[0].reason, KORAPAY_PROTOCOL);

      const wallet = await discovery.resolveOrderSources(walletOrder);
      assert.equal(wallet.status, "resolved");
      assert.equal(wallet.sources[0].provider, "wallet");
      assert.equal(wallet.sources[0].refundCapability, "review_required");
      assert.equal(wallet.sources[0].reason, TENDER_REVIEW);
      assert.equal(wallet.sources[0].storedValue.status, "resolved");
      assert.equal(wallet.sources[0].storedValue.kind, "wallet");
      assert.equal(
        String(wallet.sources[0].storedValue.ledger.id),
        String(walletTx._id),
      );
      assert.ok(wallet.sources[0].storedValue.checkoutDebit);
      assert.equal(wallet.sources[0].storedValue.checkoutDebit.method, "wallet");
      assert.equal(wallet.sources[0].storedValue.funding.status, "not_recorded");

      const gift = await discovery.resolveOrderSources(giftOrder);
      assert.equal(gift.sources[0].provider, "gift_card");
      assert.equal(gift.sources[0].storedValue.status, "resolved");
      assert.equal(gift.sources[0].storedValue.kind, "gift_card");
      assert.equal(
        String(gift.sources[0].storedValue.ledger.id),
        String(giftTx._id),
      );
      assert.equal(gift.sources[0].storedValue.funding.status, "resolved");
      assert.equal(gift.sources[0].storedValue.funding.kind, "gift_card_purchase");
      assert.equal(
        String(gift.sources[0].storedValue.funding.target),
        String(giftCardId),
      );

      const orphan = await discovery.resolveOrderSources(orphanOrder);
      assert.equal(orphan.status, "unknown");
      assert.equal(orphan.sources[0].identity, "unknown");
      assert.match(orphan.sources[0].reason, /original wallet checkout debit/i);

      // Multiple allocated claims are a first-class ambiguous outcome.
      await claim(Claim, {
        _id: "paystack:platform:dhm-secondref",
        provider: "paystack",
        account: "platform",
        reference: "dhm-secondref",
        user: buyer,
        amount: 20,
        currency: "NGN",
        state: "allocated",
        order: paystackOrder,
        receipt: {
          method: "paystack",
          reference: "dhm-secondref",
          transactionId: "918274",
          amount: 20,
          currency: "NGN",
          paidAt: new Date(),
        },
      });
      const multi = await discovery.resolveOrderSources(paystackOrder);
      assert.equal(multi.status, "ambiguous");
      assert.match(multi.reason, /Multiple allocated original payment claims/);

      const funding = await discovery.resolveStoredValueFunding(
        "paystack",
        "dhm-giftfund",
      );
      assert.equal(funding.status, "resolved");
      assert.equal(funding.kind, "gift_card_purchase");
      assert.equal(String(funding.target), String(giftCardId));
      const missingFunding = await discovery.resolveStoredValueFunding(
        "paystack",
        "dhm-neverfunded",
      );
      assert.equal(missingFunding.status, "unknown");

      // Readiness-safe projection never carries private identities.
      const safe = await discovery.describeOrderSources(paystackOrder);
      assert.deepEqual(safe, [
        {
          provider: "multiple",
          state: "review_required",
          reason: "Multiple allocated original payment claims require reconciliation.",
        },
      ]);
      const safeWallet = await discovery.describeOrderSources(walletOrder);
      assert.deepEqual(safeWallet, [
        { provider: "wallet", state: "review_required", reason: TENDER_REVIEW },
      ]);
      const safeOrphan = await discovery.describeOrderSources(orphanOrder);
      assert.equal(safeOrphan[0].state, "review_required");
      assert.equal(
        JSON.stringify(safe).includes(String(walletTx._id)),
        false,
      );

      // Discovery is strictly read-only: no documents were created or modified.
      for (const [name, Model] of Object.entries({
        claims: Claim,
        wallet: WalletTransaction,
        gift: GiftTransaction,
        debits: CheckoutDebit,
        funding: Funding,
      }))
        assert.equal(
          await Model.countDocuments(),
          name === "claims" ? counts[name] + 1 : counts[name],
          `discovery mutated ${name}`,
        );
    } finally {
      await Claim.deleteOne({ _id: "paystack:platform:dhm-secondref" });
    }
  },
);

test(
  "readiness get enumerates discovery-derived original sources fail-closed without private identities",
  { skip: !uri },
  async (t) => {
    assert.ok(discovery, "refund-source discovery module exists");
    await connectVenueMongo(t, "refund_source_readiness");
    const oid = () => new mongoose.Types.ObjectId(),
      buyer = oid(),
      tenant = oid();
    const Order = require("../models/Order"),
      Child = require("../models/MerchantOrder"),
      Set = require("../models/MerchantOrderSet"),
      Claim = require("../models/MarketplacePaymentClaim");
    const readiness = require("../services/merchantFulfillment/refundReadiness");
    const root = { _id: oid(), role: "super_admin" };
    const baseOrder = (parent) => ({
      _id: parent,
      user: buyer,
      currency: "NGN",
      subtotal: 20,
      totalAmount: 20,
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
          itemSubtotal: 20,
          discountAmount: 0,
          tenantRevenueShare: 16,
          platformCommission: 4,
        },
      ],
    });
    const mkFixture = async () => {
      const parent = oid();
      const raw = baseOrder(parent);
      await Order.collection.insertOne(raw);
      const groups =
        require("../services/merchantFulfillment/allocation").allocate(raw);
      await Child.create(groups);
      await Set.create({
        _id: parent,
        currency: "NGN",
        totalMinor: 2000,
        children: groups.map((g) => g._id),
        allocationPolicy: "merchandise-weighted-v1",
      });
      return { parent, child: groups[0] };
    };
    // Supported Stripe original: readiness enumerates the source as supported.
    const stripe = await mkFixture();
    await Claim.create({
      _id: "stripe:platform:pi_readiness_src",
      provider: "stripe",
      account: "platform",
      reference: "pi_readiness_src",
      user: buyer,
      amount: 20,
      currency: "NGN",
      state: "allocated",
      order: stripe.parent,
      receipt: {
        method: "stripe",
        reference: "pi_readiness_src",
        amount: 20,
        currency: "NGN",
      },
    });
    await require("../services/chartOfAccounts.service").ensureDefaultCOA(tenant);
    await require("../services/journalEntry.service").postJournalEntry({
      tenantId: tenant,
      refDoc: stripe.parent,
      refDocType: "Order",
      entryType: "sales_revenue",
      source: "marketplace",
      lines: [
        { account: "1300", debit: 16, credit: 0 },
        { account: "6500", debit: 4, credit: 0 },
        { account: "4000", debit: 0, credit: 20 },
      ],
    });
    const supported = await readiness.get(stripe.child._id, root);
    assert.deepEqual(supported.sources, [
      {
        provider: "stripe",
        state: "supported",
        reason:
          "Original allocated receipt identity is supported for merchandise refunds.",
      },
    ]);
    assert.equal(
      JSON.stringify(supported).includes("pi_readiness_src"),
      false,
    );
    // Korapay fallback original: readiness stays review_required and never discloses the reference.
    const korapay = await mkFixture();
    await Claim.create({
      _id: "korapay:platform:dhm-korareadiness",
      provider: "korapay",
      account: "platform",
      reference: "dhm-korareadiness",
      user: buyer,
      amount: 20,
      currency: "NGN",
      state: "allocated",
      order: korapay.parent,
      receipt: {
        method: "korapay",
        reference: "dhm-korareadiness",
        transactionId: "dhm-korareadiness",
        amount: 20,
        currency: "NGN",
        paidAt: new Date(),
      },
    });
    const review = await readiness.get(korapay.child._id, root);
    assert.equal(review.merchandise.state, "review_required");
    assert.deepEqual(review.sources, [
      {
        provider: "korapay",
        state: "review_required",
        reason:
          "Original tender refund capability requires review. Korapay fallback transactionId identity is ambiguous.",
      },
    ]);
    assert.equal(
      JSON.stringify(review).includes("dhm-korareadiness"),
      false,
    );
    // No allocated claim at all: explicit unknown source, never a guess.
    const unclaimed = await mkFixture();
    const unknown = await readiness.get(unclaimed.child._id, root);
    assert.deepEqual(unknown.sources, [
      {
        provider: "unknown",
        state: "review_required",
        reason:
          "No allocated original payment claim is recorded for this order.",
      },
    ]);
    // Zero-value policy wording is surfaced without changing refusal behavior.
    assert.deepEqual(unknown.zeroValueCancellation, {
      state: "review_required",
      reason:
        "Zero-only cancellation has no approved no-money policy; zero-value units release only within a positive supported refund.",
    });
  },
);
