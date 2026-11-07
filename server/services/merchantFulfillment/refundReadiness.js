"use strict";
const mongoose = require("mongoose"),
  Child = require("../../models/MerchantOrder"),
  Group = require("../../models/MerchantOrderSet");
const access = require("./access"),
  { ConflictError } = require("../../utils/errors");
// Readiness-safe original-tender source descriptors. Only tender kind, state and
// a recorded reason are disclosed — never claim references, transaction ids or
// other private provider identities.
const TENDER_REVIEW_REASON = "Original tender refund capability requires review.";
const supportedReason =
  "Original allocated receipt identity is supported for merchandise refunds.";
const korapayReason =
  "Original tender refund capability requires review. Korapay fallback transactionId identity is ambiguous.";
function sourceState(provider) {
  if (["stripe", "paystack"].includes(provider))
    return { provider, state: "supported", reason: supportedReason };
  if (provider === "korapay")
    return { provider, state: "review_required", reason: korapayReason };
  return { provider, state: "review_required", reason: TENDER_REVIEW_REASON };
}
function projectSources(sources, receipt) {
  if (!Array.isArray(sources)) return [sourceState(receipt?.provider || "unknown")];
  return sources.map((source) => {
    const entry = source && typeof source === "object" ? source : {};
    const safe = sourceState(
      typeof entry.provider === "string" ? entry.provider : "unknown",
    );
    return {
      provider: safe.provider,
      state: typeof entry.state === "string" ? entry.state : safe.state,
      reason: typeof entry.reason === "string" ? entry.reason : safe.reason,
    };
  });
}
function project(child, receipt, issue, sources) {
  const availableMinor =
    child.merchandiseMinor - child.refundReservedMinor - child.refundedMinor;
  const valid = [
    child.merchandiseMinor,
    child.shippingMinor,
    child.taxMinor,
    child.refundReservedMinor,
    child.refundedMinor,
    availableMinor,
  ].every((n) => Number.isSafeInteger(n) && n >= 0);
  const supported =
    valid && !issue && ["stripe", "paystack"].includes(receipt?.provider);
  const executionEnabled =
    supported &&
    process.env.MERCHANT_REFUNDS_ENABLED === "true" &&
    (receipt.provider !== "paystack" ||
      process.env.MERCHANT_PAYSTACK_REFUNDS_ENABLED === "true");
  return {
    currency: child.currency,
    merchandise: {
      availableMinor: valid ? availableMinor : 0,
      reservable: supported && availableMinor > 0,
      executionEnabled,
      state: supported ? "supported" : "review_required",
      reason:
        issue ||
        (!valid
          ? "Original financial component budgets require reconciliation."
          : !supported
            ? "Original tender refund capability requires review."
            : "Original receipt and journal shares govern merchandise refunds."),
    },
    shipping: {
      acceptedMinor: child.shippingMinor,
      state: child.shippingMinor > 0 ? "review_required" : "not_applicable",
      reason:
        "Original shipping refund and carrier-charge allocation policy requires review.",
    },
    tax: {
      acceptedMinor: child.taxMinor,
      state: child.taxMinor > 0 ? "review_required" : "not_applicable",
      reason:
        "Original tax refund and journal allocation policy requires review.",
    },
    payout: {
      state: "review_required",
      reason:
        "Saved tenant receivable and commission shares are reversed by verified merchandise settlement. Payout transfer, fee recovery and distribution approval remain separate.",
    },
    goods: {
      state: "independent",
      reason:
        "A monetary refund never confirms physical return, restores stock or reverses original goods cost. Returned goods require independently verified receipt and disposition.",
    },
    fullCancellationReady:
      !child.shippingMinor &&
      !child.taxMinor &&
      supported &&
      child.refundReservedMinor === 0 &&
      child.refundedMinor === child.merchandiseMinor,
    sources: projectSources(sources, receipt),
    zeroValueCancellation: {
      state: "review_required",
      reason:
        "Zero-only cancellation has no approved no-money policy; zero-value units release only within a positive supported refund.",
    },
  };
}
async function get(childId, actor) {
  access.scope(actor);
  const session = await mongoose.startSession();
  let output;
  try {
    await session.withTransaction(async () => {
      const child = access.assertOwned(
        await Child.findOne({ _id: childId, ...access.scope(actor) })
          .session(session)
          .lean(),
        actor,
      );
      let receipt,
        issue = "";
      try {
        ({ receipt } = await require("./refundAuthority").original(
          child,
          session,
        ));
        const group = await Group.findById(child.order).session(session).lean();
        if (
          !group ||
          !group.children.includes(childId) ||
          group.refundReservedMinor + group.refundedMinor > group.totalMinor
        )
          throw new ConflictError(
            "Original financial budgets require reconciliation",
          );
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error;
        issue =
          "Original payment, journal or budget evidence requires review before reserving a refund.";
      }
      let sources;
      try {
        sources = await require("./refundSources/discovery").describeOrderSources(
          child.order,
          { session },
        );
      } catch {
        sources = [
          {
            provider: "unknown",
            state: "review_required",
            reason: TENDER_REVIEW_REASON,
          },
        ];
      }
      output = project(child, receipt, issue, sources);
    });
    return output;
  } finally {
    await session.endSession();
  }
}
module.exports = { get, project, TENDER_REVIEW_REASON };
