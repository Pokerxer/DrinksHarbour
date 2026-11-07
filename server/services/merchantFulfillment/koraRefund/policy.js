"use strict";
// Policy authority for the Kora refund adapter (workstream K). Recording is
// super_admin-only and audited; content is operator input — the service
// validates structure only (the six reviewed protocol-fact fields; the
// explicit identity decision; the shared fee-bearer vocabulary read-imported
// from the fee-treatment authority) and invents no policy content. Resolution
// (`active`) is read-only and returns null when no recorded, in-window version
// exists — the fail-closed default (production databases hold zero records).
const crypto = require("node:crypto"),
  mongoose = require("mongoose");
const MerchantKoraRefundPolicy = require("../../../models/MerchantKoraRefundPolicy");
const { ForbiddenError, ConflictError, ValidationError } = require("../../../utils/errors");
const MerchantFeeTreatmentPolicy = require("../../../models/MerchantFeeTreatmentPolicy");

// The recorded protocol facts — asserted (never invented) by the sealed
// transport adapter; see adapter.js.
const CONTRACT_FIELDS = [
  "endpointsShapeReference",
  "authMode",
  "refundRequestContract",
  "refundResponseContract",
  "uncertaintyBehavior",
  "idempotencyConvention",
];

function contentHash(input) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        ...CONTRACT_FIELDS.map((field) => input[field]),
        input.acceptFallbackTransactionId,
        input.refundFeeBearer ?? null,
        input.decisionReference ?? null,
        input.effectiveFrom ?? null,
        input.effectiveUntil ?? null,
      ]),
    )
    .digest("hex");
}

function assertSuperAdmin(actor) {
  if (actor?.role !== "super_admin")
    throw new ForbiddenError(
      "Platform super admin required to record Kora refund policies",
    );
}

// Validate the recorded content structurally. No field is defaulted: whatever
// the operator did not record stays unrecorded. Error messages name the field
// so the recording surface shows exactly which reviewed fact is missing.
function validated(input) {
  for (const field of CONTRACT_FIELDS) {
    if (typeof input?.[field] !== "string" || input[field].trim().length < 16)
      throw new ValidationError(
        `The recorded ${field} is required by the sealed Kora transport and must be a reviewed contract fact (at least 16 characters)`,
      );
    if (input[field].length > 2000)
      throw new ValidationError(`The recorded ${field} exceeds 2000 characters`);
  }
  if (typeof input?.acceptFallbackTransactionId !== "boolean")
    throw new ValidationError(
      "The recorded acceptFallbackTransactionId identity decision is required and must be an explicit boolean; anything other than true keeps the ambiguous fallback identity refused",
    );
  if (input.refundFeeBearer !== undefined) {
    if (
      typeof input.refundFeeBearer !== "string" ||
      !MerchantFeeTreatmentPolicy.BEARERS.includes(input.refundFeeBearer)
    )
      throw new ValidationError(
        "The recorded refund fee bearer must be one the shared fee-treatment authority records as data",
      );
  }
  return input;
}

// Record a new immutable version. The version number is mechanism sequencing
// (max+1 unless an explicit version is supplied); policy CONTENT is never
// defaulted. Audited via AuditLog.
async function record(input, actor, { session } = {}) {
  assertSuperAdmin(actor);
  validated(input);
  let version = input.version;
  if (version !== undefined) {
    if (!Number.isSafeInteger(version) || version < 1)
      throw new ValidationError("Recorded policy version must be a positive integer");
    if (await MerchantKoraRefundPolicy.exists({ version }).session(session))
      throw new ConflictError(
        "A recorded Kora refund policy version already exists; record a new version",
      );
  } else {
    const latest = await MerchantKoraRefundPolicy.findOne()
      .sort({ version: -1 })
      .session(session)
      .lean();
    version = latest ? latest.version + 1 : 1;
  }
  const [policy] = await MerchantKoraRefundPolicy.create(
    [
      {
        version,
        state: "recorded",
        endpointsShapeReference: input.endpointsShapeReference,
        authMode: input.authMode,
        refundRequestContract: input.refundRequestContract,
        refundResponseContract: input.refundResponseContract,
        uncertaintyBehavior: input.uncertaintyBehavior,
        idempotencyConvention: input.idempotencyConvention,
        acceptFallbackTransactionId: input.acceptFallbackTransactionId,
        ...(input.refundFeeBearer ? { refundFeeBearer: input.refundFeeBearer } : {}),
        ...(input.decisionReference ? { decisionReference: input.decisionReference } : {}),
        ...(input.effectiveFrom ? { effectiveFrom: input.effectiveFrom } : {}),
        ...(input.effectiveUntil ? { effectiveUntil: input.effectiveUntil } : {}),
        recordedBy: actor._id,
        recordedAt: new Date(),
        contentHash: contentHash(input),
      },
    ],
    { session },
  );
  await require("../../../models/AuditLog").create(
    [
      {
        actorUserId: actor._id,
        actorRole: actor.role,
        action: "MERCHANT_KORA_REFUND_POLICY_RECORD",
        actionCategory: "create",
        targetType: "MerchantKoraRefundPolicy",
        targetId: policy._id,
        justification: input.decisionReference || "Recorded Kora refund policy",
        changes: {
          after: {
            version: policy.version,
            acceptFallbackTransactionId: policy.acceptFallbackTransactionId,
            refundFeeBearer: policy.refundFeeBearer ?? null,
            contentHash: policy.contentHash,
          },
        },
      },
    ],
    session ? { session } : {},
  );
  return policy;
}

// Read-only resolution of the newest recorded, in-window version. Versions
// outside their recorded effective window are skipped (the newest in-window
// version governs); null when none qualifies — callers fail closed.
async function active({ session, now = new Date() } = {}) {
  const versions = await MerchantKoraRefundPolicy.find({ state: "recorded" })
    .sort({ version: -1 })
    .limit(100)
    .session(session)
    .lean();
  return (
    versions.find(
      (policy) =>
        (!policy.effectiveFrom || new Date(policy.effectiveFrom) <= now) &&
        (!policy.effectiveUntil || new Date(policy.effectiveUntil) > now),
    ) || null
  );
}

async function list(actor) {
  assertSuperAdmin(actor);
  return MerchantKoraRefundPolicy.find({}).sort({ version: -1 }).lean();
}

module.exports = { record, active, list, CONTRACT_FIELDS };
