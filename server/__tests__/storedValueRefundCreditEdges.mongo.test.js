"use strict";
// Stored-value credit command — resolution edges surface recorded reasons
// verbatim (never guess), and gift expiry/precision behavior comes ONLY from
// the recorded policy fields.
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const mongoose = require("mongoose"),
  path = require("node:path");
const { uri, connectVenueMongo } = require("./helpers/venueMongo");
const {
  giftCheckoutFixture,
  recordPolicy,
  oid,
} = require("./helpers/storedValueRefundFixture");

const storedValueCredit = require("../services/merchantFulfillment/refundSources/storedValueCredit");
const TENDER_REVIEW = "Original tender refund capability requires review.";
const WALLET_UNKNOWN_REVIEW =
  "Original wallet checkout debit requires review; the recorded original debit is missing or already bound to an order.";
const MULTIPLE_CLAIMS_REVIEW =
  "Multiple allocated original payment claims require reconciliation.";
const KORAPAY_FALLBACK_REVIEW =
  "Original tender refund capability requires review. Korapay fallback transactionId identity is ambiguous.";
const FLAG = "MERCHANT_STORED_VALUE_REFUNDS_ENABLED";

const claim = (Model, row) => Model.create(row);

test(
  "credit surfaces resolution edges verbatim and honors gift rules only from recorded policy",
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, "stored_value_credit_edges");
    const Claim = require("../models/MarketplacePaymentClaim"),
      GiftCard = require("../models/GiftCard"),
      GiftTransaction = require("../models/GiftCardTransaction"),
      WalletTransaction = require("../models/PlatformWalletTransaction"),
      Funding = require("../models/StoredValueFunding"),
      CreditRecord = require("../models/StoredValueRefundCredit");
    const root = { _id: oid(), role: "super_admin" };
    process.env[FLAG] = "true";
    t.after(() => delete process.env[FLAG]);
    const counts = async () => ({
      credits: await CreditRecord.countDocuments(),
      walletRefunds: await WalletTransaction.countDocuments({ type: "refund" }),
      giftRefunds: await GiftTransaction.countDocuments({ type: "refund" }),
    });
    const rejectsWithZeroWrites = async (promise, match, before) => {
      await assert.rejects(promise, (error) =>
        error.statusCode === 409 && match(error.message),
      );
      assert.deepEqual(await counts(), before);
    };

    // --- Resolution edges surface discovery's recorded reasons verbatim. ---
    const korapay = { orderId: oid() };
    await claim(Claim, {
      _id: "korapay:platform:dhm-wfallback", provider: "korapay", account: "platform",
      reference: "dhm-wfallback", user: oid(), amount: 5, currency: "NGN",
      state: "allocated", order: korapay.orderId,
      receipt: { method: "korapay", reference: "dhm-wfallback", transactionId: "dhm-wfallback", amount: 5, currency: "NGN", paidAt: new Date() },
    });
    let before = await counts();
    await rejectsWithZeroWrites(
      storedValueCredit.creditStoredValue(
        { orderId: korapay.orderId, amountMinor: 500, idempotencyKey: "edge-kora" }, root,
      ),
      (m) => m === KORAPAY_FALLBACK_REVIEW,
      before,
    );
    const orphan = { orderId: oid() }, orphanRef = oid();
    await claim(Claim, {
      _id: `wallet:platform:${orphanRef}`, provider: "wallet", account: "platform",
      reference: String(orphanRef), user: oid(), amount: 5, currency: "NGN",
      state: "allocated", order: orphan.orderId,
      receipt: { method: "wallet", reference: String(orphanRef), transactionId: String(orphanRef), amount: 5, currency: "NGN", paidAt: new Date() },
    });
    before = await counts();
    await rejectsWithZeroWrites(
      storedValueCredit.creditStoredValue(
        { orderId: orphan.orderId, amountMinor: 500, idempotencyKey: "edge-orphan" }, root,
      ),
      (m) => m === WALLET_UNKNOWN_REVIEW,
      before,
    );
    const multi = { orderId: oid() }, multiRef = oid();
    for (const reference of ["dhm-first", String(multiRef)])
      await claim(Claim, {
        _id: `${reference === "dhm-first" ? "paystack" : "wallet"}:platform:${reference}`,
        provider: reference === "dhm-first" ? "paystack" : "wallet",
        account: "platform", reference, user: oid(), amount: 5, currency: "NGN",
        state: "allocated", order: multi.orderId,
        receipt: { method: reference === "dhm-first" ? "paystack" : "wallet", reference, transactionId: reference === "dhm-first" ? "918273" : reference, amount: 5, currency: "NGN", paidAt: new Date() },
      });
    before = await counts();
    await rejectsWithZeroWrites(
      storedValueCredit.creditStoredValue(
        { orderId: multi.orderId, amountMinor: 500, idempotencyKey: "edge-multi" }, root,
      ),
      (m) => m === MULTIPLE_CLAIMS_REVIEW,
      before,
    );

    // --- Gift happy path: credit the SAME card; funding surfaced verbatim. ---
    const gift = await giftCheckoutFixture({ amountNaira: 5 });
    await Funding.create({
      _id: "paystack:platform:dhm-edge-giftfund", provider: "paystack",
      reference: "dhm-edge-giftfund", user: gift.buyer, amount: 5, currency: "NGN",
      kind: "gift_card_purchase", target: gift.giftCardId, state: "credited",
    });
    const giftPolicy = await recordPolicy("gift_card");
    const result = await storedValueCredit.creditStoredValue(
      { orderId: gift.orderId, amountMinor: 500, idempotencyKey: "gift-1" }, root,
    );
    assert.equal(result.status, "credited");
    assert.equal(result.kind, "gift_card");
    assert.equal(result.destination.type, "gift_card");
    assert.equal(String(result.destination.id), String(gift.giftCardId));
    assert.equal(result.remainderMinor, 0);
    assert.equal(result.reconciliation.state, "not_applicable");
    assert.equal(result.policy.version, giftPolicy.version);
    assert.equal(result.originalDebit.funding.status, "resolved");
    assert.match(result.originalDebit.funding.reason ?? "", /^$/);
    const card = await GiftCard.findById(gift.giftCardId).lean();
    assert.equal(card.balance, 5);
    assert.equal(card.status, "active");
    const row = await GiftTransaction.findOne({ type: "refund" }).lean();
    assert.equal(row.amount, 5);
    assert.equal(row.balanceAfter, 5);
    assert.equal(row.reference, gift.debitTxId);

    // --- Gift expiry honored ONLY from the recorded policy rule. ---
    const expired = await giftCheckoutFixture({
      amountNaira: 3, status: "active",
      expiresAt: new Date(Date.now() - 86400000),
    });
    before = await counts();
    // Recorded rule reject_if_expired → explicit refusal, zero writes.
    await rejectsWithZeroWrites(
      storedValueCredit.creditStoredValue(
        { orderId: expired.orderId, amountMinor: 300, idempotencyKey: "gift-exp-1" }, root,
      ),
      (m) => /expired; the recorded refund policy rejects/i.test(m),
      before,
    );
    // A new recorded version changes the outcome — never a default.
    await recordPolicy("gift_card", { version: 2, giftExpiryRule: "reactivate_expired_card" });
    const reactivated = await storedValueCredit.creditStoredValue(
      { orderId: expired.orderId, amountMinor: 300, idempotencyKey: "gift-exp-2" }, root,
    );
    assert.equal(reactivated.status, "credited");
    const expiredCard = await GiftCard.findById(expired.giftCardId).lean();
    assert.equal(expiredCard.balance, 3);
    assert.equal(expiredCard.status, "active");

    // --- Precision: only the recorded whole-naira rule executes. ---
    const precise = await giftCheckoutFixture({ amountNaira: 5 });
    before = await counts();
    await rejectsWithZeroWrites(
      storedValueCredit.creditStoredValue(
        { orderId: precise.orderId, amountMinor: 505, idempotencyKey: "prec-1" }, root,
      ),
      (m) => /precision rule/i.test(m),
      before,
    );
    await assert.rejects(
      () =>
        storedValueCredit.creditStoredValue(
          { orderId: precise.orderId, amountMinor: 0, idempotencyKey: "prec-2" }, root,
        ),
      (error) => error.statusCode === 400,
    );
    assert.deepEqual(await counts(), before);
  },
);
