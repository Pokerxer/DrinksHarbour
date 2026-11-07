"use strict";
// Policy authority for shipping-refund allocations (workstream S2). Recording
// is super_admin-only and audited; content is operator input — the service
// validates structure only (conditions the mechanism can match, bearer
// outcomes and journal treatments it can record as data) and invents no policy
// content. Resolution (`active`) is read-only and returns null when no
// recorded, in-window version exists — the fail-closed default.
const crypto = require("node:crypto");
const Policy = require("../../../models/MerchantShippingRefundPolicy");
const { ForbiddenError, ValidationError, ConflictError } = require("../../../utils/errors");

function contentHash(input) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        eligibilityConditions: [...input.eligibilityConditions].sort(),
        bearerOutcome: input.bearerOutcome,
        journalTreatment: input.journalTreatment,
        decisionReference: input.decisionReference ?? null,
        effectiveFrom: input.effectiveFrom ?? null,
        effectiveUntil: input.effectiveUntil ?? null,
      }),
    )
    .digest("hex");
}

function assertSuperAdmin(actor) {
  if (actor?.role !== "super_admin")
    throw new ForbiddenError(
      "Platform super admin required to record shipping refund policies",
    );
}

// Validate the recorded content structurally. Nothing is defaulted: whatever
// the operator did not record stays unrecorded.
function validate(input) {
  const conditions = input?.eligibilityConditions;
  if (
    !Array.isArray(conditions) ||
    conditions.length < 1 ||
    !conditions.every((c) => Policy.CONDITIONS.includes(c))
  )
    throw new ValidationError(
      "Recorded eligibility conditions must be a non-empty set of conditions the mechanism can match",
    );
  if (!Policy.BEARERS.includes(input.bearerOutcome))
    throw new ValidationError(
      "Recorded bearer outcome is not one the mechanism can record as data",
    );
  if (!Policy.TREATMENTS.includes(input.journalTreatment))
    throw new ValidationError(
      "Recorded journal treatment is not executable by the mechanism",
    );
  return input;
}

// Record a new immutable version. The version number is mechanism sequencing
// (max+1 unless an explicit version is supplied); policy CONTENT is never
// defaulted. Audited via AuditLog.
async function record(input, actor, { session } = {}) {
  assertSuperAdmin(actor);
  validate(input);
  let version = input.version;
  if (version !== undefined) {
    if (!Number.isSafeInteger(version) || version < 1)
      throw new ValidationError("Recorded policy version must be a positive integer");
    if (await Policy.exists({ version }).session(session))
      throw new ConflictError(
        "A recorded policy version already exists; record a new version",
      );
  } else {
    const latest = await Policy.findOne()
      .sort({ version: -1 })
      .session(session)
      .lean();
    version = latest ? latest.version + 1 : 1;
  }
  const [policy] = await Policy.create(
    [
      {
        version,
        state: "recorded",
        eligibilityConditions: input.eligibilityConditions,
        bearerOutcome: input.bearerOutcome,
        journalTreatment: input.journalTreatment,
        ...(input.decisionReference
          ? { decisionReference: input.decisionReference }
          : {}),
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
        action: "MERCHANT_SHIPPING_REFUND_POLICY_RECORD",
        actionCategory: "create",
        targetType: "MerchantShippingRefundPolicy",
        targetId: policy._id,
        justification: input.decisionReference || "Recorded shipping refund policy",
        changes: {
          after: {
            version: policy.version,
            eligibilityConditions: policy.eligibilityConditions,
            bearerOutcome: policy.bearerOutcome,
            journalTreatment: policy.journalTreatment,
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
  const versions = await Policy.find({ state: "recorded" })
    .sort({ version: -1 })
    .limit(100)
    .session(session ?? null)
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
  return Policy.find({}).sort({ version: -1 }).lean();
}

module.exports = { record, active, list };
