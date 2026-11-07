"use strict";
// Sealed Kora (Korapay) refund transport adapter (workstream K), modeled on
// the deliveryProviders/external sealed-carrier precedent and the
// refundTransport Paystack/Stripe shapes. Deliberately SEALED: no real
// Korapay call exists here and no credential is ever read — the built-in
// transport is absent and refuses. Tests inject a synthetic Transport
// ({ request, verify }) whose outcomes move through the same normalization
// and evidence discipline a future certified transport would.
//
// The adapter asserts the RECORDED protocol contract fields are present and
// refuses when they are absent; it never interprets or completes the contract
// itself. Success outcomes must carry the matching amount/currency and a
// provider refund id; anything else is an uncertainty, never a settlement.
const { ConflictError } = require("../../../utils/errors");
const CONTRACT_FIELDS = require("./policy").CONTRACT_FIELDS;

// Mirrors MerchantRefundEvidence _id semantics; evidence is created by the
// command, not the transport.
const evidenceId = (providerRefundId) => `korapay:platform:${providerRefundId}`;

// The built-in production transport is deliberately not installed: wiring a
// real Korapay client requires the externally reviewed protocol certification
// gate and a separately reviewed infrastructure step. No network access here.
function sealedTransport() {
  throw new ConflictError(
    "Kora refund transport is not installed; the recorded protocol contract requires external certification before a real transport is wired.",
  );
}

// Refuse when the recorded protocol contract facts are absent.
function assertContract(policy) {
  const missing = CONTRACT_FIELDS.filter(
    (field) =>
      !policy ||
      typeof policy[field] !== "string" ||
      policy[field].trim().length < 16,
  );
  if (missing.length)
    throw new ConflictError(
      `Recorded Kora refund protocol contract is incomplete; the sealed transport requires the reviewed ${missing.join(", ")} field(s).`,
    );
}

// Envelope passed to the injected transport — it carries the recorded
// contract facts verbatim and the minimal refund facts; the adapter invents
// no provider payload detail beyond what has been reviewed and recorded.
function requestEnvelope(policy, allocation) {
  return {
    kind: "kora_refund.request",
    endpointsShapeReference: policy.endpointsShapeReference,
    authMode: policy.authMode,
    idempotencyConvention: policy.idempotencyConvention,
    payload: {
      reference: allocation.providerReference,
      amountMinor: allocation.amountMinor,
      currency: allocation.currency,
      note: `merchant-kora-refund:${allocation._id}`,
    },
  };
}

// Normalize a transport outcome. Only an explicit `success` with a saved
// provider refund id can settle; pending/failed/unknown/malformed outcomes
// become uncertainty (the reservation stays held — never released).
function normalizeOutcome(result) {
  if (!result || typeof result !== "object" || typeof result.status !== "string")
    throw new ConflictError(
      "Provider refund outcome requires reconciliation; the recorded Kora response contract is not satisfied.",
    );
  if (result.status === "success") {
    if (typeof result.providerRefundId !== "string" || !result.providerRefundId.trim() || result.providerRefundId.length > 128)
      throw new ConflictError(
        "Provider refund evidence requires a provider refund id; the recorded Kora response contract is not satisfied.",
      );
    return {
      status: "success",
      providerRefundId: result.providerRefundId,
      // Reported amount/currency facts are carried through for the evidence
      // assertion (assertEvidence) — never stripped, never normalized.
      amountMinor: typeof result.amountMinor === "number" ? result.amountMinor : undefined,
      currency: typeof result.currency === "string" ? result.currency : undefined,
      issue: "",
    };
  }
  if (result.status === "unknown")
    return {
      status: "unknown",
      providerRefundId:
        typeof result.providerRefundId === "string" && result.providerRefundId.trim()
          ? result.providerRefundId
          : null,
      issue:
        typeof result.issue === "string" && result.issue
          ? result.issue
          : "Provider refund outcome requires reconciliation.",
    };
  throw new ConflictError(
    "Provider refund outcome requires reconciliation; the recorded Kora response contract is not satisfied.",
  );
}

// The settle paths' verbatim evidence-mismatch conflict wording (the
// reconcile/verify path AND the POST-settle path in refund.js finalize both
// refuse through this exact string).
const EVIDENCE_MISMATCH = "Provider refund evidence does not match the recorded Kora allocation.";

// Assert provider evidence against the recorded allocation — the settled
// outcome must match the exact saved amount/currency and refund id. On the
// reserve-then-post POST-settle path the allocation has no recorded provider
// refund id yet (the transport's successful report IS the recorded id — there
// is nothing it can mismatch), so the id comparison binds only when an id was
// already recorded (reconcile/verify path — its behavior is byte-unchanged);
// the reported amount/currency must match the recorded allocation exactly on
// EVERY settle path.
function assertEvidence(outcome, allocation) {
  if (
    outcome.status !== "success" ||
    (allocation.providerRefundId && outcome.providerRefundId !== allocation.providerRefundId)
  )
    throw new ConflictError(EVIDENCE_MISMATCH);
  if (outcome.amountMinor !== allocation.amountMinor || outcome.currency !== allocation.currency)
    throw new ConflictError(EVIDENCE_MISMATCH);
}

// One provider refund request. Transport is injected (synthetic in tests);
// without one the sealed adapter refuses.
async function submit({ policy, allocation }, transport) {
  assertContract(policy);
  if (!transport || typeof transport.request !== "function") sealedTransport();
  // Amount authority is the recorded request envelope itself (exact
  // amountMinor/currency of the allocation); the command asserts outcome
  // evidence on authenticated retrieval (verify below).
  return normalizeOutcome(await transport.request(requestEnvelope(policy, allocation)));
}

// Authenticated retrieval of the SAVED provider refund id — the only
// reconciliation route. No lookup by internal key is attempted and provider
// ids are never discovered or invented.
function savedId(allocation) {
  if (!allocation?.providerRefundId || !String(allocation.providerRefundId).trim())
    throw new ConflictError(
      "Reconciliation requires the saved provider refund id; the mechanism never discovers or invents one.",
    );
  return String(allocation.providerRefundId);
}

async function verify({ policy, allocation }, transport) {
  assertContract(policy);
  savedId(allocation);
  if (!transport || typeof transport.verify !== "function") sealedTransport();
  const outcome = normalizeOutcome(await transport.verify({
    kind: "kora_refund.retrieval",
    endpointsShapeReference: policy.endpointsShapeReference,
    authMode: policy.authMode,
    providerRefundId: String(allocation.providerRefundId),
  }));
  if (outcome.status === "success") {
    const verified = {
      ...outcome,
      providerRefundId:
        typeof outcome.providerRefundId === "string" && outcome.providerRefundId.trim()
          ? outcome.providerRefundId
          : String(allocation.providerRefundId),
    };
    assertEvidence(verified, allocation);
    return verified;
  }
  return outcome;
}

module.exports = { submit, verify, assertContract, assertEvidence, evidenceId, savedId, sealedTransport };
