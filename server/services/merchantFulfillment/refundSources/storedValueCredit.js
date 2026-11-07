"use strict";
// Original-source stored-value refund credit COMMAND (workstream W). Resolves
// the EXACT original checkout debit via refundSources/discovery.js (read-only
// import of the approved logic) and re-credits the SAME stored-value object —
// never cash, never a substituted tender. Executes only against a recorded,
// immutable, versioned StoredValueRefundPolicy AND the default-off execution
// flag; without either it fails closed with the existing readiness wording and
// zero writes. Resolution outcomes (resolved/ambiguous/unknown) are first
// class: ambiguous and unknown surface their recorded reason verbatim and are
// never guessed. Session-bound: runs inside the caller's session when one is
// passed, otherwise inside its own transaction. Once-only: the idempotency key
// is the StoredValueRefundCredit _id (Phase A CheckoutDebit primitive), so
// concurrent duplicates both resolve with exactly one ledger write, and the
// StoredValueRefundRemainder guard conserves the refundable remainder across
// multi-refunds.
const crypto = require("node:crypto"),
  mongoose = require("mongoose");
const { ConflictError, NotFoundError, ValidationError } = require("../../../utils/errors");
const discovery = require("./discovery");
const policyAuthority = require("./policyAuthority");
const CreditRecord = require("../../../models/StoredValueRefundCredit");
const { present, advanceRemainder, naira } = require("./storedValueCreditSupport");

const TENDER_REVIEW = "Original tender refund capability requires review.";
// Mirrors discovery.js verbatim — surfaced, never guessed.
const NO_CLAIM_REVIEW = "No allocated original payment claim is recorded for this order.";
const WALLET_UNKNOWN_REVIEW =
  "Original wallet checkout debit requires review; the recorded original debit is missing or already bound to an order.";
const GIFT_UNKNOWN_REVIEW =
  "Original gift-card checkout debit requires review; the recorded original redeem is missing or already bound to an order.";
const FLAG = "MERCHANT_STORED_VALUE_REFUNDS_ENABLED";
const minor = (n) => Math.round(Number(n) * 100);
const creditKey = (debitTxId, idempotencyKey) =>
  crypto
    .createHash("sha256")
    .update(`stored-value-refund-credit:${debitTxId}:${idempotencyKey}`)
    .digest("hex");

// The whole command runs on one coherent snapshot: discovery, policy
// resolution, verification and the credit itself share the session.
async function run(command, actor, session) {
  const { orderId, amountMinor, idempotencyKey } = command;
  const resolved = await discovery.resolveOrderSources(orderId, { session });
  if (resolved.status === "unknown" || resolved.status === "ambiguous") {
    const reason = resolved.reason ?? resolved.sources?.[0]?.reason ?? TENDER_REVIEW;
    throw new ConflictError(reason);
  }
  const source = resolved.sources[0];
  if (!["wallet", "gift_card"].includes(source.provider))
    throw new ConflictError(TENDER_REVIEW);
  if (source.storedValue?.status !== "resolved")
    throw new ConflictError(source.reason);
  const kind = source.provider === "wallet" ? "wallet" : "gift_card";
  const policy = await policyAuthority.active(kind, { session });
  if (!policy) throw new ConflictError(TENDER_REVIEW);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0)
    throw new ValidationError("Refund credit amount must be a positive integer minor amount");
  if (policy.amountPrecisionRule !== "whole_naira_units" || amountMinor % 100 !== 0)
    throw new ConflictError(
      "Refund credit amount violates the recorded amount precision rule; review required.",
    );
  if (source.claim.currency !== "NGN")
    throw new ConflictError(
      "Stored-value refund credit requires an NGN original receipt; the recorded currency requires review.",
    );
  const ledgerId = source.storedValue.ledger.id;
  const originalMinor = minor(source.storedValue.ledger.amount);
  if (minor(source.claim.amount) !== originalMinor)
    throw new ConflictError(
      "Original stored-value debit does not reconcile with the allocated receipt; review required.",
    );
  const debitTxId = String(ledgerId);
  const key = creditKey(debitTxId, idempotencyKey);

  // Replay first: the same idempotency key against the same debit is the same
  // command — rebuild the recorded result, write nothing.
  const prior = await CreditRecord.findById(key).session(session).lean();
  if (prior) return present(prior, "already_credited");

  // Re-read the exact original debit row under discovery's own filter —
  // binds destination object and settlement tenant exactly. (The owner
  // equality row↔claim is already enforced by discovery's resolved outcome
  // within this same snapshot; the row itself carries the owner.)
  const WalletModel = require("../../../models/PlatformWalletTransaction");
  const GiftModel = require("../../../models/GiftCardTransaction");
  const debitFilter =
    kind === "wallet"
      ? {
          _id: ledgerId,
          type: "debit",
          source: "online_checkout",
          relatedOrder: null,
        }
      : {
          _id: ledgerId,
          type: "redeem",
          checkoutReceipt: true,
          relatedOrder: null,
        };
  const Model = kind === "wallet" ? WalletModel : GiftModel;
  const debit = await Model.findOne(debitFilter).session(session).lean();
  if (!debit) throw new ConflictError(kind === "wallet" ? WALLET_UNKNOWN_REVIEW : GIFT_UNKNOWN_REVIEW);

  // Gift expiry is honored ONLY from the recorded policy rule. The expiry
  // lives on the GiftCard document, not the redeem transaction row.
  const now = new Date();
  let cardDoc = null;
  if (kind === "gift_card") {
    cardDoc = await require("../../../models/GiftCard")
      .findById(debit.giftCardId)
      .session(session)
      .lean();
    if (!cardDoc)
      throw new ConflictError(GIFT_UNKNOWN_REVIEW);
  }
  const expired =
    kind === "gift_card" &&
    cardDoc.expiresAt &&
    new Date(cardDoc.expiresAt) <= now;
  if (expired && policy.giftExpiryRule === "reject_if_expired")
    throw new ConflictError(
      "Gift card has expired; the recorded refund policy rejects credits to expired gift cards.",
    );

  // Once-only claim FIRST (unique _id), remainder guard second.
  const anchor = (
    await CreditRecord.create(
      [
        {
          _id: key,
          order: orderId,
          kind,
          destinationType: kind === "wallet" ? "wallet_user" : "gift_card",
          destinationId: kind === "wallet" ? debit.userId : debit.giftCardId,
          amountMinor,
          currency: "NGN",
          debitTransaction: ledgerId,
          debitCreatedAt: source.storedValue.ledger.createdAt,
          originalMinor,
          remainderMinorAfter: 0,
          fundingStatus: source.storedValue.funding?.status ?? null,
          fundingReason: source.storedValue.funding?.reason ?? null,
          ledgerModel: kind === "wallet" ? "PlatformWalletTransaction" : "GiftCardTransaction",
          reconciledTenant: debit.redeemedAtTenant ?? null,
          policyId: policy._id,
          policyVersion: policy.version,
          state: "credited",
          createdBy: actor._id,
        },
      ],
      { session },
    )
  )[0];

  const remainderRow = await advanceRemainder(ledgerId, originalMinor, amountMinor, session);
  if (remainderRow.originalMinor !== originalMinor)
    throw new ConflictError(
      "Original stored-value debit does not reconcile with the recorded refund remainder; review required.",
    );

  let ledgerRow;
  if (kind === "wallet") {
    const user = await require("../../../models/User").findOneAndUpdate(
      { _id: debit.userId },
      { $inc: { platformWalletBalance: naira(amountMinor) } },
      { new: true, session },
    );
    if (!user) throw new NotFoundError("Stored-value owner not found");
    [ledgerRow] = await WalletModel.create(
      [
        {
          userId: debit.userId,
          type: "refund",
          amount: naira(amountMinor),
          balanceAfter: user.platformWalletBalance,
          source: "refund",
          redeemedAtTenant: debit.redeemedAtTenant ?? null,
          relatedOrder: orderId,
          reference: debitTxId,
          createdBy: actor._id,
          reason: `Original checkout debit refund; stored-value refund policy v${policy.version}`,
        },
      ],
      { session },
    );
  } else {
    const cardFilter = expired
      ? { _id: debit.giftCardId }
      : { _id: debit.giftCardId, status: { $in: ["active", "redeemed"] } };
    const card = await require("../../../models/GiftCard").findOneAndUpdate(
      cardFilter,
      { $inc: { balance: naira(amountMinor) }, $set: { status: "active" } },
      { new: true, session },
    );
    if (!card)
      throw new ConflictError(
        "Gift card is unavailable for refund credit; its recorded status requires review.",
      );
    [ledgerRow] = await GiftModel.create(
      [
        {
          giftCardId: debit.giftCardId,
          type: "refund",
          amount: naira(amountMinor),
          balanceAfter: card.balance,
          redeemedAtTenant: debit.redeemedAtTenant ?? null,
          relatedOrder: orderId,
          reference: debitTxId,
          createdBy: actor._id,
        },
      ],
      { session },
    );
  }

  anchor.ledgerId = ledgerRow._id;
  anchor.balanceAfter = ledgerRow.balanceAfter;
  anchor.remainderMinorAfter = originalMinor - remainderRow.creditedMinor;
  await anchor.save({ session });
  return present(anchor.toObject(), "credited");
}

async function creditStoredValue(command, actor, { session } = {}) {
  require("../refundAuthority").platform(actor);
  if (typeof command?.idempotencyKey !== "string" || command.idempotencyKey.length < 1 || command.idempotencyKey.length > 128)
    throw new ValidationError("Idempotency-Key is required for stored-value refund credit");
  if (process.env[FLAG] !== "true") throw new ConflictError(TENDER_REVIEW);
  if (!mongoose.isValidObjectId(command.orderId))
    throw new ConflictError(NO_CLAIM_REVIEW);
  if (session) return run(command, actor, session);
  const own = await mongoose.startSession();
  try {
    let result;
    try {
      await own.withTransaction(async () => {
        result = await run(command, actor, own);
      });
    } catch (error) {
      // A parallel request may have won the unique idempotency anchor.
      if (error.code === 11000) {
        const resolved = await discovery
          .resolveOrderSources(command.orderId)
          .catch(() => null);
        const debitId = resolved?.sources?.[0]?.storedValue?.ledger?.id;
        const winner = debitId
          ? await CreditRecord.findById(creditKey(String(debitId), command.idempotencyKey)).lean()
          : null;
        if (winner) return present(winner, "already_credited");
      }
      throw error;
    }
    return result;
  } finally {
    await own.endSession();
  }
}

module.exports = { creditStoredValue };
