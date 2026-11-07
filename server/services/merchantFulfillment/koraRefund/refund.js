"use strict";
// Kora (Korapay) original-tender refund COMMAND (workstream K). Resolves the
// EXACT original allocated receipt via refundSources/discovery.js (read-only
// import, unmodified) and executes only when (a) the default-off flag
// MERCHANT_KORA_REFUNDS_ENABLED is 'true', (b) an immutable recorded
// MerchantKoraRefundPolicy exists, and (c) the receipt identity is eligible —
// the ambiguous fallback transactionId identity stays REFUSED with the
// discovery wording unless the recorded policy decided
// `acceptFallbackTransactionId: true` (the reviewer's identity decision).
//
// Once-only, carrier precedent: the once-only anchor + exact conservation
// reserve are committed transactionally BEFORE the single provider POST
// happens outside the Mongo transaction (deliveryProviders/external
// book-then-post pattern). The anchor _id IS the idempotency key
// (Phase A CheckoutDebit primitive) so concurrent duplicates both resolve
// with exactly one provider request. Conservation is exact against the claim
// amount/currency via the conditional remainder guard. Unknown/late outcomes
// stay reserved-uncertain; reconcile (reconcile.js) settles once by the
// SAVED provider refund id. No real Korapay transport exists; the adapter is
// sealed and synthetic transports are injected in tests.
const crypto = require("node:crypto"),
  mongoose = require("mongoose");
const Claim = require("../../../models/MarketplacePaymentClaim");
const Allocation = require("../../../models/MerchantKoraRefundAllocation");
const Remainder = require("../../../models/MerchantKoraRefundRemainder");
const { ConflictError, ValidationError } = require("../../../utils/errors");
const discovery = require("../refundSources/discovery");
const authority = require("../refundAuthority");
const policyAuthority = require("./policy");
const adapter = require("./adapter");
const { minor } = require("../allocation");
const { present, advanceRemainder, settleEvidenceOnce, EXCEEDED } = require("./support");
const { reconcileKorapay } = require("./reconcile");

// Mirrors refundSources/discovery.js / refundReadiness.js VERBATIM — surfaced,
// never guessed or reworded.
const TENDER_REVIEW = "Original tender refund capability requires review.";
const KORAPAY_FALLBACK_REVIEW =
  "Original tender refund capability requires review. Korapay fallback transactionId identity is ambiguous.";
// Mirrors discovery.js verbatim.
const NO_CLAIM_REVIEW = "No allocated original payment claim is recorded for this order.";
const FLAG = "MERCHANT_KORA_REFUNDS_ENABLED";
const key = (claimId, idempotencyKey) =>
  crypto.createHash("sha256").update(`kora-refund:${claimId}:${idempotencyKey}`).digest("hex");

const replayed = (prior) =>
  present(prior, prior.state === "settled" ? "already_settled" : "replayed");

// PHASE 1 — one short transaction: discovery resolution, recorded-policy +
// identity gates, explicit conservation check, once-only anchor insert and
// the remainder advance. A replay returns write-free without any transport.
async function stage(command, actor, session, transport) {
  const resolved = await discovery.resolveOrderSources(command.orderId, { session });
  // Unknown discovery (missing claim rows, unknown tenders) is refused with
  // discovery's recorded reason. A Korapay fallback claim arrives here as
  // `ambiguous` by design — that is the RECORDED identity decision, so
  // resolution must proceed to the policy gate below (multi-claim ambiguity
  // returns no sources and is still refused verbatim via the source check).
  if (resolved.status === "unknown")
    throw new ConflictError(resolved.reason ?? resolved.sources?.[0]?.reason ?? TENDER_REVIEW);
  const source = resolved.sources[0];
  if (!source) throw new ConflictError(resolved.reason ?? TENDER_REVIEW);
  if (source.provider !== "korapay") throw new ConflictError(TENDER_REVIEW);

  const policy = await policyAuthority.active({ session });
  if (!policy) throw new ConflictError(TENDER_REVIEW);
  adapter.assertContract(policy);

  // Exact re-read of the allocated claim row (discovery's own filter) — binds
  // owner/amount/currency/receipt exactly and defends against drift.
  const claim = await Claim.findOne({
    _id: String(source.claim.id),
    provider: "korapay",
    account: "platform",
    state: "allocated",
  })
    .session(session)
    .lean();
  if (!claim) throw new ConflictError(NO_CLAIM_REVIEW);
  const tx = claim.receipt?.transactionId;
  const fallback = tx == null || String(tx) === String(claim.reference);
  if (fallback !== (source.identity === "ambiguous"))
    throw new ConflictError(
      "The original Korapay receipt identity changed between discovery and execution; reconciliation required.",
    );
  if (fallback && policy.acceptFallbackTransactionId !== true)
    throw new ConflictError(KORAPAY_FALLBACK_REVIEW);

  if (!Number.isSafeInteger(command.amountMinor) || command.amountMinor <= 0)
    throw new ValidationError("Refund amount must be a positive integer minor amount");
  if (
    claim.currency !== "NGN" ||
    claim.receipt?.currency !== "NGN" ||
    minor(claim.receipt?.amount) !== minor(claim.amount)
  )
    throw new ConflictError(
      "The original Korapay claim does not reconcile with its stored receipt; reconciliation required.",
    );
  const originalMinor = minor(claim.amount);
  const claimId = String(claim._id);
  const anchorKey = key(claimId, command.idempotencyKey);

  // Replay first: the same idempotency key against the same claim is the same
  // command — rebuild the recorded result, write nothing.
  const prior = await Allocation.findById(anchorKey).session(session).lean();
  if (prior) return { replay: replayed(prior) };

  // Explicit conservation pre-check before ANY mutation (the conditional
  // remainder advance below is the server-side double check).
  const priorRemainder = await Remainder.findById(claimId).session(session).lean();
  if (command.amountMinor > originalMinor - (priorRemainder?.refundedMinor ?? 0))
    throw new ConflictError(EXCEEDED);

  // Sealed-transport presence is checked after every recorded-wording gate
  // and BEFORE any write — a command without an (injected) transport never
  // claims the anchor or the conservation remainder.
  if (!transport) adapter.sealedTransport();

  // Recorded-not-executed fee data (read-import of the fee-treatment
  // authority; no fee movement is ever executed here).
  const feeFlow = await require("../feeTreatment/policy")
    .activeForFlow("kora_refund", { session })
    .catch(() => null);
  const feeBearer = policy.refundFeeBearer ?? feeFlow?.bearer ?? null;

  // Once-only anchor insert FIRST (unique _id), then the remainder advance.
  const anchor = (
    await Allocation.create(
      [
        {
          _id: anchorKey,
          order: command.orderId,
          claim: claimId,
          provider: "korapay",
          account: "platform",
          providerReference: claim.reference,
          receiptTransactionId: fallback ? null : String(claim.receipt.transactionId),
          fallbackAccepted: fallback,
          customer: claim.user,
          currency: "NGN",
          amountMinor: command.amountMinor,
          claimAmountMinor: originalMinor,
          policyId: policy._id,
          policyVersion: policy.version,
          feeBearer: feeBearer ?? undefined,
          feeBearerState: feeBearer ? "recorded_not_executed" : "not_applicable",
          ...(feeFlow
            ? {
                feeJournalTreatment: feeFlow.futureJournalTreatment,
                feeTreatmentPolicyId: feeFlow._id,
                feeTreatmentVersion: feeFlow.version,
              }
            : {}),
          state: "requested",
          remainderMinorAfter: 0,
          createdBy: actor._id,
        },
      ],
      { session },
    )
  )[0];
  const remainderRow = await advanceRemainder(claimId, originalMinor, command.amountMinor, session);
  if (remainderRow.originalMinor !== originalMinor)
    throw new ConflictError(
      "The original Korapay claim does not reconcile with the recorded refund remainder; review required.",
    );
  anchor.remainderMinorAfter = originalMinor - remainderRow.refundedMinor;
  await anchor.save({ session });
  return { anchorKey, policy, originalMinor, allocation: anchor.toObject() };
}

// PHASE 3 — finalize the provider outcome on the durably claimed anchor:
// unknown outcomes stay reserved-uncertain; success settles once-only with
// the `korapay:platform:<providerRefundId>` evidence record.
async function finalize(stageContext, outcome, session) {
  const row = await Allocation.findById(stageContext.anchorKey).session(session);
  if (!row) throw new ConflictError("Kora refund reservation requires reconciliation");
  if (row.state === "settled") return present(row.toObject(), "already_settled");
  const priorRemainder = await Remainder.findById(row.claim).session(session).lean();
  if (!priorRemainder || priorRemainder.originalMinor !== stageContext.originalMinor)
    throw new ConflictError(
      "The original Korapay claim does not reconcile with the recorded refund remainder; review required.",
    );
  if (outcome.status === "unknown") {
    row.state = "uncertain";
    row.issue = outcome.issue;
    if (outcome.providerRefundId) row.providerRefundId = outcome.providerRefundId;
    row.remainderMinorAfter = stageContext.originalMinor - priorRemainder.refundedMinor;
    await row.save({ session });
    return present(row.toObject(), "uncertain");
  }
  // The POST-settle path enforces the SAME evidence discipline as the
  // reconcile/verify path: the transport's reported amount/currency must match
  // the recorded allocation exactly before ANY settle/evidence write — a
  // mismatched success outcome is refused with the adapter's verbatim wording
  // and the reservation stays held. On this path the allocation has no
  // recorded provider refund id yet; the successful report IS the recorded id.
  adapter.assertEvidence(outcome, row);
  await settleEvidenceOnce(
    require("../../../models/MerchantKoraRefundEvidence"),
    adapter.evidenceId(outcome.providerRefundId),
    { allocation: String(row._id), order: row.order, amountMinor: row.amountMinor, currency: row.currency },
    session,
  );
  row.providerRefundId = outcome.providerRefundId;
  row.state = "settled";
  row.issue = "";
  row.processedAt = new Date();
  row.remainderMinorAfter = stageContext.originalMinor - priorRemainder.refundedMinor;
  await row.save({ session });
  return present(row.toObject(), "settled");
}

// The gated refund command: platform admin, idempotency key, default-off
// flag, sealed-transport presence, then the reserve-then-post lifecycle —
// every gate before execution fails closed with zero writes.
async function refundKorapay(command, actor, { session, transport } = {}) {
  authority.platform(actor);
  if (
    typeof command?.idempotencyKey !== "string" ||
    command.idempotencyKey.length < 1 ||
    command.idempotencyKey.length > 128
  )
    throw new ValidationError("Idempotency-Key is required for the original Kora refund command");
  if (process.env[FLAG] !== "true") throw new ConflictError(TENDER_REVIEW);
  if (!mongoose.isValidObjectId(command.orderId)) throw new ConflictError(NO_CLAIM_REVIEW);

  // Phase 1: the once-only + conservation claim transaction (rolls back on
  // every failure; the anchor idempotency claim is durable before any
  // provider request).
  let stageContext;
  const claim = session ?? (await mongoose.startSession());
  try {
    try {
      await claim.withTransaction(async () => {
        stageContext = await stage(command, actor, claim, transport);
      });
    } catch (failure) {
      // A parallel request may have durably won the same idempotency anchor.
      if (failure.code === 11000 && command.orderId) {
        const resolved = await discovery.resolveOrderSources(command.orderId).catch(() => null);
        const claimId = resolved?.sources?.[0]?.claim?.id;
        const prior = claimId
          ? await Allocation.findById(key(String(claimId), command.idempotencyKey)).lean()
          : null;
        if (prior) return replayed(prior);
      }
      throw failure;
    }
    if (stageContext?.replay) return stageContext.replay;
  } finally {
    if (!session) await claim.endSession();
  }

  // Phase 2 (carrier precedent): exactly ONE provider POST outside the Mongo
  // transaction. Outcome or exception is durably finalized in phase 3; the
  // conservation reservation is never released by this command.
  let outcome = null,
    submitIssue = null;
  try {
    outcome = await adapter.submit(
      { policy: stageContext.policy, allocation: stageContext.allocation },
      transport,
    );
  } catch (error) {
    submitIssue = error;
  }

  const commit = session ?? (await mongoose.startSession());
  try {
    let result;
    await commit.withTransaction(async () => {
      result = await finalize(
        stageContext,
        outcome ?? {
          status: "unknown",
          providerRefundId: null,
          issue:
            submitIssue?.message || "Provider refund outcome requires reconciliation.",
        },
        commit,
      );
    });
    return result;
  } catch (failure) {
    // A parallel finalize may have settled through the same evidence first —
    // rebuild the recorded result write-free.
    const row = await Allocation.findById(stageContext.anchorKey).lean().catch(() => null);
    if (row && row.state === "settled") return present(row, "already_settled");
    throw failure;
  } finally {
    if (!session) await commit.endSession();
  }
}

module.exports = { refundKorapay, reconcileKorapay, TENDER_REVIEW, KORAPAY_FALLBACK_REVIEW, NO_CLAIM_REVIEW };
