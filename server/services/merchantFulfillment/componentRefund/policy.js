"use strict";
// Policy authority for merchant order component refunds (workstream T).
// Recording is super_admin-only and audited; content is operator input — the
// service validates structure only (per-kind recorded rules the mechanism can
// represent) and invents no policy content. Resolution (`active`) is
// read-only and returns null when no recorded, in-window version exists —
// the fail-closed default. Mirrors the stored-value policy authority
// precedent (workstream W).
const crypto = require("node:crypto"),
  mongoose = require("mongoose");
const MerchantComponentRefundPolicy = require("../../../models/MerchantComponentRefundPolicy");
const { ForbiddenError, ConflictError, ValidationError } = require("../../../utils/errors");
const kinds = ["tax", "discount"];
const reversalTreatments = [
  "no_output_vat_captured",
  "reverse_captured_output_vat",
  "retroactive_capture_then_reverse",
];
const recreditPaths = [
  "component_record_only",
  "original_tender_recredit",
  "stored_value_recredit",
];
const fundingValues = ["shared_by_agreement", "platform"];

function contentHash(input) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        input.kind,
        input.jurisdiction ?? null,
        input.rateAuthority ?? null,
        input.bearer ?? null,
        input.reversalTreatment ?? null,
        input.eligibleFunding ?? null,
        input.platformRecreditPath ?? null,
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
      "Platform super admin required to record merchant component refund policies",
    );
}

// Validate the recorded content structurally. No field is defaulted: whatever
// the operator did not record stays unrecorded.
function validated(input) {
  if (!kinds.includes(input?.kind))
    throw new ValidationError("Recorded policy kind must be tax or discount");
  const text = (field) =>
    typeof input[field] === "string" && input[field].trim().length > 0 && input[field].trim().length <= 280;
  if (input.kind === "tax") {
    for (const field of ["jurisdiction", "rateAuthority", "bearer"])
      if (!text(field)) throw new ValidationError(`Tax policies require a recorded ${field}`);
    if (!reversalTreatments.includes(input.reversalTreatment))
      throw new ValidationError(
        "Recorded tax reversal treatment is not executable by the mechanism",
      );
    if (input.eligibleFunding !== undefined || input.platformRecreditPath !== undefined)
      throw new ValidationError(
        "Discount component rules apply only to discount policies; tax policies must not record one",
      );
  } else {
    if (
      !Array.isArray(input.eligibleFunding) ||
      input.eligibleFunding.length === 0 ||
      new Set(input.eligibleFunding).size !== input.eligibleFunding.length ||
      input.eligibleFunding.some((value) => !fundingValues.includes(value))
    )
      throw new ValidationError(
        "Recorded component eligibility must be a discount funding value (shared_by_agreement or platform)",
      );
    if (!recreditPaths.includes(input.platformRecreditPath))
      throw new ValidationError(
        "Recorded platform-funded share re-credit path is not executable by the mechanism",
      );
    if (
      input.jurisdiction !== undefined ||
      input.rateAuthority !== undefined ||
      input.bearer !== undefined ||
      input.reversalTreatment !== undefined
    )
      throw new ValidationError(
        "Tax component rules apply only to tax policies; discount policies must not record one",
      );
  }
  if (
    input.effectiveFrom &&
    input.effectiveUntil &&
    new Date(input.effectiveFrom) > new Date(input.effectiveUntil)
  )
    throw new ValidationError("Recorded effective window is inverted");
  return input;
}

// Record a new immutable version. The version number is mechanism sequencing
// (max+1 unless an explicit version is supplied); policy CONTENT is never
// defaulted. Audited via AuditLog.
async function record(input, actor, { session } = {}) {
  assertSuperAdmin(actor);
  validated(input);
  let policy;
  for (let attempt = 0; attempt < 8; attempt++) {
  let version = input.version;
  if (version !== undefined) {
    if (!Number.isSafeInteger(version) || version < 1)
      throw new ValidationError("Recorded policy version must be a positive integer");
    if (
      await MerchantComponentRefundPolicy.exists({ kind: input.kind, version }).session(session)
    )
      throw new ConflictError(
        "A recorded policy version already exists for this kind; record a new version",
      );
  } else {
    const latest = await MerchantComponentRefundPolicy.findOne({ kind: input.kind })
      .sort({ version: -1 })
      .session(session)
      .lean();
    version = latest ? latest.version + 1 : 1;
  }
  try {
  policy = await MerchantComponentRefundPolicy.create(
    [
      {
        kind: input.kind,
        version,
        state: "recorded",
        ...(input.jurisdiction ? { jurisdiction: input.jurisdiction } : {}),
        ...(input.rateAuthority ? { rateAuthority: input.rateAuthority } : {}),
        ...(input.bearer ? { bearer: input.bearer } : {}),
        ...(input.reversalTreatment ? { reversalTreatment: input.reversalTreatment } : {}),
        ...(input.eligibleFunding ? { eligibleFunding: input.eligibleFunding } : {}),
        ...(input.platformRecreditPath ? { platformRecreditPath: input.platformRecreditPath } : {}),
        ...(input.decisionReference ? { decisionReference: input.decisionReference } : {}),
        ...(input.effectiveFrom ? { effectiveFrom: input.effectiveFrom } : {}),
        ...(input.effectiveUntil ? { effectiveUntil: input.effectiveUntil } : {}),
        recordedBy: actor._id,
        recordedAt: new Date(),
        contentHash: contentHash(input),
      },
    ],
    { session },
  ).then((rows) => rows[0]);
    break;
    } catch(error) {
      if(error.code !== 11000) throw error;
      if(input.version !== undefined || session || attempt === 7) throw new ConflictError("A recorded policy version already exists for this kind; record a new version");
    }
  }
  await require("../../../models/AuditLog").create(
    [
      {
        actorUserId: actor._id,
        actorRole: actor.role,
        action: "MERCHANT_COMPONENT_REFUND_POLICY_RECORD",
        actionCategory: "create",
        targetType: "MerchantComponentRefundPolicy",
        targetId: policy._id,
        justification: input.decisionReference || "Recorded merchant component refund policy",
        changes: {
          after: {
            kind: policy.kind,
            version: policy.version,
            jurisdiction: policy.jurisdiction ?? null,
            rateAuthority: policy.rateAuthority ?? null,
            bearer: policy.bearer ?? null,
            reversalTreatment: policy.reversalTreatment ?? null,
            eligibleFunding: policy.eligibleFunding ?? null,
            platformRecreditPath: policy.platformRecreditPath ?? null,
            contentHash: policy.contentHash,
          },
        },
      },
    ],
    session ? { session } : {},
  );
  return policy;
}

// Read-only resolution of the newest recorded, in-window version for a kind.
// Versions outside their recorded effective window are skipped (the newest
// in-window version governs); null when none qualifies — callers fail closed.
async function active(kind, { session, now = new Date() } = {}) {
  if (!kinds.includes(kind)) return null;
  return MerchantComponentRefundPolicy.findOne({ kind, state: "recorded", $and: [
    { $or: [{ effectiveFrom: null }, { effectiveFrom: { $lte: now } }] },
    { $or: [{ effectiveUntil: null }, { effectiveUntil: { $gt: now } }] },
  ] }).sort({ version: -1 }).session(session).lean();
}

async function list(actor) {
  assertSuperAdmin(actor);
  return MerchantComponentRefundPolicy.find({})
    .sort({ kind: 1, version: -1 })
    .lean();
}

module.exports = { record, active, list };
