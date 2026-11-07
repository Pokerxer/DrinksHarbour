"use strict";
// Policy authority for original-source stored-value refund credits (workstream
// W). Recording is super_admin-only and audited; content is operator input —
// the service validates structure only (destination = original object; rules
// the mechanism can execute) and invents no policy content. Resolution
// (`active`) is read-only and returns null when no recorded, in-window version
// exists — the fail-closed default.
const crypto = require("node:crypto"),
  mongoose = require("mongoose");
const StoredValueRefundPolicy = require("../../../models/StoredValueRefundPolicy");
const { ForbiddenError, ConflictError, ValidationError } = require("../../../utils/errors");
const kinds = ["wallet", "gift_card"];
const precisionRules = ["whole_naira_units"];
const giftExpiryRules = ["reactivate_expired_card", "reject_if_expired"];

function contentHash(input) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        input.kind,
        input.destination,
        input.amountPrecisionRule,
        input.giftExpiryRule ?? null,
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
      "Platform super admin required to record stored-value refund policies",
    );
}

// Validate the recorded content structurally. No field is defaulted: whatever
// the operator did not record stays unrecorded.
function validated(input) {
  if (!kinds.includes(input?.kind))
    throw new ValidationError("Recorded policy kind must be wallet or gift_card");
  if (input.destination !== "original_object")
    throw new ValidationError(
      "Recorded destination must be the original stored-value object; the mechanism does not offer substitution",
    );
  if (!precisionRules.includes(input.amountPrecisionRule))
    throw new ValidationError(
      "Recorded amount precision rule is not executable by the mechanism",
    );
  if (input.kind === "gift_card") {
    if (!giftExpiryRules.includes(input.giftExpiryRule))
      throw new ValidationError(
        "Gift-card policies require a recorded executable gift expiry rule",
      );
  } else if (input.giftExpiryRule)
    throw new ValidationError(
      "Gift expiry rules apply only to gift_card policies; wallet policies must not record one",
    );
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
    if (
      await StoredValueRefundPolicy.exists({ kind: input.kind, version }).session(session)
    )
      throw new ConflictError(
        "A recorded policy version already exists for this kind; record a new version",
      );
  } else {
    const latest = await StoredValueRefundPolicy.findOne({ kind: input.kind })
      .sort({ version: -1 })
      .session(session)
      .lean();
    version = latest ? latest.version + 1 : 1;
  }
  const policy = await StoredValueRefundPolicy.create(
    [
      {
        kind: input.kind,
        destination: input.destination,
        version,
        state: "recorded",
        amountPrecisionRule: input.amountPrecisionRule,
        ...(input.giftExpiryRule ? { giftExpiryRule: input.giftExpiryRule } : {}),
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
  await require("../../../models/AuditLog").create(
    [
      {
        actorUserId: actor._id,
        actorRole: actor.role,
        action: "STORED_VALUE_REFUND_POLICY_RECORD",
        actionCategory: "create",
        targetType: "StoredValueRefundPolicy",
        targetId: policy._id,
        justification: input.decisionReference || "Recorded stored-value refund policy",
        changes: {
          after: {
            kind: policy.kind,
            version: policy.version,
            destination: policy.destination,
            amountPrecisionRule: policy.amountPrecisionRule,
            giftExpiryRule: policy.giftExpiryRule ?? null,
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
  const versions = await StoredValueRefundPolicy.find({ kind, state: "recorded" })
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
  return StoredValueRefundPolicy.find({})
    .sort({ kind: 1, version: -1 })
    .lean();
}

module.exports = { record, active, list };
