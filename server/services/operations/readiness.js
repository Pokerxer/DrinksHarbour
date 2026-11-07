"use strict";
// Platform-ops readiness snapshot. v1 aggregated the existing fail-closed
// gates with their exact recorded wording plus default-off flag states.
// v2 (final-mechanisms package, workstream UI-W) concatenates additively: the
// kora-refund, payout-transfer and fee-treatment mechanism states (each in
// that mechanism's own verbatim gate wordings), the two new mechanism flags,
// the return-effects flag state and the mechanisms' unresolved reservation
// counts. Nothing here enables, flips or executes anything — readiness
// evidence is NOT activation permission.
const Booking = require("../../models/MerchantCarrierBooking"),
  Review = require("../../models/MerchantCarrierReview"),
  { ForbiddenError } = require("../../utils/errors");
const VERSION = 2;
const NOTICE = "Readiness evidence is not activation permission.";
const SUPPORTED_REASON =
  "Original allocated receipt identity is supported for merchandise refunds.";
const KORAPAY_REASON =
  "Original tender refund capability requires review. Korapay fallback transactionId identity is ambiguous.";
const TENDER_REVIEW_REASON = "Original tender refund capability requires review.";
const SHIPPING_REASON =
  "Original shipping refund and carrier-charge allocation policy requires review.";
const TAX_REASON = "Original tax refund and journal allocation policy requires review.";
const PAYOUT_REASON =
  "Saved tenant receivable and commission shares are reversed by verified merchandise settlement. Payout transfer, fee recovery and distribution approval remain separate.";
const GOODS_REASON =
  "A monetary refund never confirms physical return, restores stock or reverses original goods cost. Returned goods require independently verified receipt and disposition.";
const ZERO_VALUE_REASON =
  "Zero-only cancellation has no approved no-money policy; zero-value units release only within a positive supported refund.";
const CARRIER_RECONCILE_REASON =
  "Known original provider shipment ID required; responsibility remains uncertain";
// Mechanism gate wordings for the v2 additive block — every string below is
// the mechanism's own recorded fail-closed/sealed wording, reused verbatim
// (never paraphrased). TENDER_REVIEW_REASON / PAYOUT_REASON are the kora and
// payout commands' verbatim flag-off/no-policy wordings; the seal wordings are
// the instances' transport-refusal strings provenance-pinned to their source
// files (they are runtime refusal outputs, quoted exactly).
const KORA_SEAL =
  "Kora refund transport is not installed; the recorded protocol contract requires external certification before a real transport is wired.";
// provenance: koraRefund/adapter.js sealedTransport() refusal (exact).
const PAYOUT_SEAL =
  "Payout transfer transport is sealed; no reviewed provider money-rails contract exists for this payout policy (recorded external evidence gate).";
// provenance: payout/transport.js submit() seal refusal (exact).
// The payout MECHANISM's own verbatim no-execution posture — distinct from the
// legacy refund-readiness payout gate above; sourced from the mechanism
// module (exported) so the wording cannot drift.
const {
  PAYOUT_REASON: PAYOUT_MECHANISM_POSTURE,
} = require("../merchantFulfillment/payout/support");
const flag = (name) => process.env[name] === "true";
function refundSources() {
  return [
    { provider: "stripe", state: "supported", reason: SUPPORTED_REASON },
    { provider: "paystack", state: "supported", reason: SUPPORTED_REASON },
    { provider: "korapay", state: "review_required", reason: KORAPAY_REASON },
    { provider: "wallet", state: "review_required", reason: TENDER_REVIEW_REASON },
    { provider: "gift_card", state: "review_required", reason: TENDER_REVIEW_REASON },
  ];
}
async function snapshot(actor) {
  if (!["super_admin", "admin"].includes(actor?.role))
    throw new ForbiddenError("Platform operations access required");
  const queue = require("./exceptionsQueue");
  const now = new Date();
  const [
    refundCount,
    carrierCount,
    returnCount,
    unresolvedCarrier,
    reviewedContracts,
    koraActive,
    payoutActive,
    koraRecordedVersions,
    payoutRecordedVersions,
    mechanismCounts,
  ] = await Promise.all([
    require("../../models/MerchantRefundAllocation").countDocuments({
      state: { $in: ["submitting", "uncertain"] },
    }),
    Booking.countDocuments({
      state: { $in: ["submitting", "uncertain", "cancel_pending", "cancel_requested"] },
    }),
    require("../../models/MerchantDeliveryReturn").countDocuments({
      disposition: "quarantined",
    }),
    Booking.countDocuments({ state: { $in: ["submitting", "uncertain"] } }),
    Review.countDocuments({ status: "reviewed", validUntil: { $gt: now } }),
    // v2 mechanism states — read-only resolution through each mechanism's own
    // documented read path (nothing is executed by reading it).
    require("../merchantFulfillment/koraRefund/policy").active(),
    require("../merchantFulfillment/payout/policy").active(),
    require("../../models/MerchantKoraRefundPolicy").countDocuments({
      state: "recorded",
    }),
    require("../../models/MerchantPayoutPolicy").countDocuments({
      state: "recorded",
    }),
    require("./mechanismsQueue").counts(),
  ]);
  return {
    readinessVersion: VERSION,
    notice: NOTICE,
    flags: {
      merchantRefundsEnabled: flag("MERCHANT_REFUNDS_ENABLED"),
      merchantPaystackRefundsEnabled: flag("MERCHANT_PAYSTACK_REFUNDS_ENABLED"),
      merchantExternalCarrierEnabled: flag("MERCHANT_EXTERNAL_CARRIER_ENABLED"),
      merchantKoraRefundsEnabled: flag("MERCHANT_KORA_REFUNDS_ENABLED"),
      merchantPayoutTransfersEnabled: flag("MERCHANT_PAYOUT_TRANSFERS_ENABLED"),
    },
    refundSources: refundSources(),
    shipping: { state: "review_required", reason: SHIPPING_REASON },
    tax: { state: "review_required", reason: TAX_REASON },
    payout: { state: "review_required", reason: PAYOUT_REASON },
    goods: { state: "independent", reason: GOODS_REASON },
    zeroValueCancellation: {
      state: "review_required",
      reason: ZERO_VALUE_REASON,
    },
    carrier: {
      enabled: flag("MERCHANT_EXTERNAL_CARRIER_ENABLED"),
      reviewedContracts,
      unresolvedBookings: unresolvedCarrier,
      reconcileRequirement: CARRIER_RECONCILE_REASON,
    },
    returns: {
      effectsSupported: false,
      reason: queue.RETURN_EFFECTS_UNSUPPORTED,
      // v2 additive: state-only flag read (never flipped by this display).
      effectsFlagEnabled: flag("MERCHANT_RETURN_EFFECTS_ENABLED"),
    },
    // v2 additive: the final-mechanisms package's operator-facing mechanism
    // states in the exact idiom above. Each reason is the mechanism's own
    // fail-closed/sealed wording (verbatim, gate-order respected: the flag
    // gate precedes the policy gate, so flag-off states surface the flag
    // wording even for recorded policies). Reading any of this executes
    // NOTHING — the commands stay service-level and the transports sealed.
    mechanisms: {
      koraRefund: {
        state: koraActive ? "recorded_not_executed" : "none_recorded",
        flag: {
          name: "MERCHANT_KORA_REFUNDS_ENABLED",
          enabled: flag("MERCHANT_KORA_REFUNDS_ENABLED"),
        },
        policy: {
          state: koraActive ? "recorded" : "none_recorded",
          recordedVersions: koraRecordedVersions,
          activeVersion: koraActive ? koraActive.version : null,
        },
        unresolvedReservations: mechanismCounts.kora_refund,
        reason:
          koraActive && flag("MERCHANT_KORA_REFUNDS_ENABLED")
            ? KORA_SEAL
            : TENDER_REVIEW_REASON,
      },
      payoutTransfer: {
        state: payoutActive ? "recorded_not_executed" : "none_recorded",
        flag: {
          name: "MERCHANT_PAYOUT_TRANSFERS_ENABLED",
          enabled: flag("MERCHANT_PAYOUT_TRANSFERS_ENABLED"),
        },
        policy: {
          state: payoutActive ? "recorded" : "none_recorded",
          recordedVersions: payoutRecordedVersions,
          activeVersion: payoutActive ? payoutActive.version : null,
        },
        unresolvedTransfers: mechanismCounts.payout_transfer,
        reason:
          payoutActive && flag("MERCHANT_PAYOUT_TRANSFERS_ENABLED")
            ? PAYOUT_SEAL
            : PAYOUT_MECHANISM_POSTURE,
      },
      // The fee-treatment projection is itself the operator-facing recorded
      // view (workstream Fb); it is embedded verbatim — zero drift by
      // construction. It never outputs a fee figure.
      feeTreatment: await require("../merchantFulfillment/feeTreatment/projection").projectView(),
    },
    queueCounts: { refund: refundCount, carrier: carrierCount, return: returnCount },
  };
}
module.exports = {
  snapshot,
  NOTICE,
  SHIPPING_REASON,
  TAX_REASON,
  TENDER_REVIEW_REASON,
  ZERO_VALUE_REASON,
};
