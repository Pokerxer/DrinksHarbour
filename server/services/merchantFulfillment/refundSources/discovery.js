"use strict";
// Read-only original refund-source discovery for marketplace merchant orders.
// Resolves the exact original claim/debit identity for review queues. No writes,
// no refund execution, no provider calls. "unknown" and "ambiguous" are
// first-class outcomes — discovery never guesses an identity.
const Claim = require("../../../models/MarketplacePaymentClaim"),
  CheckoutDebit = require("../../../models/CheckoutDebit"),
  WalletTransaction = require("../../../models/PlatformWalletTransaction"),
  GiftTransaction = require("../../../models/GiftCardTransaction"),
  Funding = require("../../../models/StoredValueFunding");
const { validRefundId } = require("../refundProviders");

const SUPPORTED_REASON =
  "Original allocated receipt identity is supported for merchandise refunds.";
const TENDER_REVIEW =
  "Original tender refund capability requires review.";
const KORAPAY_FALLBACK_REVIEW =
  "Original tender refund capability requires review. Korapay fallback transactionId identity is ambiguous.";
const KORAPAY_PROTOCOL_REVIEW =
  "Original tender refund capability requires review. Korapay refund protocol and original identity policy require review.";
const PAYSTACK_IDENTITY_REVIEW =
  "Original verified Paystack transaction identity requires review.";
const MULTIPLE_CLAIMS_REVIEW =
  "Multiple allocated original payment claims require reconciliation.";
const NO_CLAIM_REVIEW =
  "No allocated original payment claim is recorded for this order.";
const WALLET_UNKNOWN_REVIEW =
  "Original wallet checkout debit requires review; the recorded original debit is missing or already bound to an order.";
const GIFT_UNKNOWN_REVIEW =
  "Original gift-card checkout debit requires review; the recorded original redeem is missing or already bound to an order.";
const WALLET_FUNDING_NOT_RECORDED =
  "Wallet checkout debits do not record a single funding identity; funding resolution requires the customer funding reference.";
const scoped = (query, session) => (session ? query.session(session) : query);
const cardIdentity = (claim) => ({
  id: claim._id,
  reference: claim.reference,
  transactionId: claim.receipt?.transactionId ?? null,
  amount: claim.amount,
  currency: claim.currency,
  paidAt: claim.receipt?.paidAt ?? null,
});
const walletFundingOutcome = () => ({
  status: "not_recorded",
  reason: WALLET_FUNDING_NOT_RECORDED,
});

async function resolveStoredValueFunding(provider, reference, { session } = {}) {
  if (typeof reference !== "string" || !reference)
    return {
      status: "unknown",
      reason:
        "No stored-value funding record matches the recorded funding identity.",
    };
  const row = scoped(Funding.findOne({ _id: `${provider}:platform:${reference}` }), session).lean();
  const funding = await row;
  if (!funding)
    return {
      status: "unknown",
      reason: "No stored-value funding record matches the recorded funding identity.",
    };
  return {
    status: "resolved",
    kind: funding.kind,
    target: funding.target,
    state: funding.state,
    id: funding._id,
    provider: funding.provider,
    reference: funding.reference,
  };
}

async function giftFundingOutcome(giftCardId, { session } = {}) {
  const rows = await scoped(
    Funding.find({ kind: "gift_card_purchase", target: giftCardId, state: "credited" }),
    session,
  ).lean();
  if (rows.length === 1)
    return {
      status: "resolved",
      kind: rows[0].kind,
      target: rows[0].target,
      state: rows[0].state,
      id: rows[0]._id,
      provider: rows[0].provider,
      reference: rows[0].reference,
    };
  if (!rows.length)
    return {
      status: "unknown",
      reason:
        "No credited gift-card funding record matches the original card; funding identity requires review.",
    };
  return {
    status: "ambiguous",
    reason:
      "Multiple credited gift-card funding records match; funding identity requires review.",
  };
}

async function storedValueOutcome(claim, { session } = {}) {
  const kind = claim.provider === "wallet" ? "wallet" : "gift_card";
  const Model = kind === "wallet" ? WalletTransaction : GiftTransaction;
  const filter =
    kind === "wallet"
      ? {
          _id: claim.reference,
          userId: claim.user,
          type: "debit",
          source: "online_checkout",
          relatedOrder: null,
        }
      : {
          _id: claim.reference,
          createdBy: claim.user,
          type: "redeem",
          checkoutReceipt: true,
          relatedOrder: null,
        };
  const ledger = await scoped(Model.findOne(filter), session).lean();
  if (!ledger)
    return {
      status: "unknown",
      kind,
      ledger: null,
      checkoutDebit: null,
      funding: null,
      reason: kind === "wallet" ? WALLET_UNKNOWN_REVIEW : GIFT_UNKNOWN_REVIEW,
    };
  const debit = await scoped(
    CheckoutDebit.findOne({
      user: claim.user,
      method: claim.provider,
      transaction: ledger._id,
    }),
    session,
  ).lean();
  return {
    status: "resolved",
    kind,
    ledger: {
      id: ledger._id,
      type: ledger.type,
      amount: ledger.amount,
      balanceAfter: ledger.balanceAfter,
      createdAt: ledger.createdAt,
    },
    checkoutDebit: debit ? { id: debit._id, method: debit.method } : null,
    funding:
      kind === "wallet"
        ? walletFundingOutcome()
        : await giftFundingOutcome(ledger.giftCardId, { session }),
  };
}

async function describeClaim(claim, { session } = {}) {
  const provider = claim.provider;
  if (provider === "stripe")
    return {
      provider,
      identity: "resolved",
      refundCapability: "supported",
      reason: SUPPORTED_REASON,
      claim: cardIdentity(claim),
      storedValue: null,
    };
  if (provider === "paystack") {
    const tx = claim.receipt?.transactionId;
    const resolved =
      tx != null &&
      String(tx) !== String(claim.reference) &&
      validRefundId("paystack", String(tx));
    return {
      provider,
      identity: resolved ? "resolved" : "ambiguous",
      refundCapability: resolved ? "supported" : "review_required",
      reason: resolved ? SUPPORTED_REASON : PAYSTACK_IDENTITY_REVIEW,
      claim: cardIdentity(claim),
      storedValue: null,
    };
  }
  if (provider === "korapay") {
    const tx = claim.receipt?.transactionId;
    const fallback = tx == null || String(tx) === String(claim.reference);
    return {
      provider,
      identity: fallback ? "ambiguous" : "resolved",
      refundCapability: "review_required",
      reason: fallback ? KORAPAY_FALLBACK_REVIEW : KORAPAY_PROTOCOL_REVIEW,
      claim: cardIdentity(claim),
      storedValue: null,
    };
  }
  if (provider === "wallet" || provider === "gift_card") {
    const storedValue = await storedValueOutcome(claim, { session });
    return {
      provider,
      identity: storedValue.status === "resolved" ? "resolved" : "unknown",
      refundCapability: "review_required",
      reason:
        storedValue.status === "resolved"
          ? TENDER_REVIEW
          : storedValue.reason,
      claim: cardIdentity(claim),
      storedValue,
    };
  }
  return {
    provider,
    identity: "unknown",
    refundCapability: "review_required",
    reason: TENDER_REVIEW,
    claim: cardIdentity(claim),
    storedValue: null,
  };
}

// Full identity resolution for review queues (internal). Read-only.
async function resolveOrderSources(orderId, { session } = {}) {
  const claims = await scoped(
    Claim.find({ order: orderId, state: "allocated" }),
    session,
  ).lean();
  if (!claims.length)
    return { status: "unknown", reason: NO_CLAIM_REVIEW, sources: [] };
  if (claims.length > 1)
    return { status: "ambiguous", reason: MULTIPLE_CLAIMS_REVIEW, sources: [] };
  const sources = [
    await describeClaim(claims[0], { session }),
  ];
  return { status: sources[0].identity, sources };
}

// Readiness-safe source descriptors: tender kind, state and recorded reason
// only — never claim references, transaction ids or other private identities.
async function describeOrderSources(orderId, { session } = {}) {
  const resolved = await resolveOrderSources(orderId, { session });
  if (resolved.reason === MULTIPLE_CLAIMS_REVIEW)
    return [
      {
        provider: "multiple",
        state: "review_required",
        reason: MULTIPLE_CLAIMS_REVIEW,
      },
    ];
  if (!resolved.sources.length)
    return [
      {
        provider: "unknown",
        state: "review_required",
        reason: resolved.reason,
      },
    ];
  if (resolved.sources.length > 1 || resolved.reason === MULTIPLE_CLAIMS_REVIEW)
    return [
      {
        provider: "multiple",
        state: "review_required",
        reason: MULTIPLE_CLAIMS_REVIEW,
      },
    ];
  return resolved.sources.map((source) => ({
    provider: source.provider,
    state:
      source.identity === "resolved" && source.refundCapability === "supported"
        ? "supported"
        : "review_required",
    reason: source.reason,
  }));
}

module.exports = {
  describeOrderSources,
  resolveOrderSources,
  resolveStoredValueFunding,
};
