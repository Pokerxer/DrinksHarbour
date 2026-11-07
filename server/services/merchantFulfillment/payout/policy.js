"use strict";
// Policy authority for merchant payout transfers (workstream P). Recording is
// super_admin-only and audited; content is operator input — the service
// validates structure only (recorded contract fields the transfer command
// can consume) and invents no policy content. Resolution (`active`) is
// read-only and returns null when no recorded, in-window version exists —
// the fail-closed default, matching the recorded payout gates in the
// settlement statement. Mirrors the component-refund policy authority
// precedent (workstream T).
const crypto = require("node:crypto"),
  mongoose = require("mongoose");
const MerchantPayoutPolicy = require("../../../models/MerchantPayoutPolicy");
const { ForbiddenError, ConflictError, ValidationError } = require("../../../utils/errors");
const enums = require("../../../models/MerchantPayoutPolicy");

const conversionFields = enums.conversionFields;

function contentHash(input) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        input.scheduleRule ?? null,
        input.currencyMode ?? null,
        input.destinationCurrency ?? null,
        input.fxSourceName ?? null,
        input.fxRateTimestampPolicy ?? null,
        input.fxMaxAgeMinutes ?? null,
        input.fxRounding ?? null,
        input.destinationAccountSource ?? null,
        input.holdRegime ?? null,
        input.standingHoldMinor ?? null,
        input.clawbackRule ?? null,
        input.nettingRule ?? null,
        input.minimumThresholdMinor ?? null,
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
      "Platform super admin required to record merchant payout policies",
    );
}

// Validate the recorded content structurally. No field is defaulted: whatever
// the operator did not record stays unrecorded.
function validated(input) {
  if (!input) throw new ValidationError("Recorded payout policy content is required");
  const safeInteger = (field, min) =>
    typeof input[field] !== "number" ||
    !Number.isSafeInteger(input[field]) ||
    input[field] < min ||
    !Number.isInteger(input[field]);
  if (
    typeof input.scheduleRule !== "string" ||
    input.scheduleRule.trim().length === 0 ||
    input.scheduleRule.trim().length > 280
  )
    throw new ValidationError(
      "Recorded payout policies require a settlement schedule/timing rule",
    );
  if (!enums.currencyModes.includes(input.currencyMode))
    throw new ValidationError("Recorded payout currency mode is not supported by the mechanism");
  if (input.currencyMode === "recorded_fx_conversion") {
    if (!enums.fxTimestampPolicies.includes(input.fxRateTimestampPolicy))
      throw new ValidationError(
        "Recorded FX rate timestamp policy is not executable by the mechanism; only the recorded effective-date policy is",
      );
    if (!/^[A-Z]{3}$/.test(input.destinationCurrency || "")) {
      throw new ValidationError(
        "Recorded FX conversion policies require a recorded uppercase three-letter destination currency",
      );
    }
    if (
      typeof input.fxSourceName !== "string" ||
      input.fxSourceName.trim().length === 0 ||
      input.fxSourceName.trim().length > 280
    )
      throw new ValidationError(
        "Recorded FX conversion policies require a recorded FX source name",
      );
    if (safeInteger("fxMaxAgeMinutes", 1))
      throw new ValidationError(
        "Recorded FX conversion policies require a maximum rate age of at least one minute",
      );
    if (!enums.fxRoundings.includes(input.fxRounding))
      throw new ValidationError(
        "Recorded FX rounding rule is not executable by the mechanism",
      );
  } else {
    for (const field of conversionFields)
      if (input[field] !== undefined)
        throw new ValidationError(
          "FX conversion rules apply only to recorded_fx_conversion currency policies; an original-transaction-currency policy must not record one",
        );
  }
  if (!enums.destinationAccountSources.includes(input.destinationAccountSource))
    throw new ValidationError(
      "Recorded destination account source is not executable by the mechanism; the mechanism binds a recorded tenant payout account reference only",
    );
  if (!enums.holdRegimes.includes(input.holdRegime))
    throw new ValidationError("Recorded hold regime is not executable by the mechanism");
  if (
    input.standingHoldMinor !== undefined &&
    (typeof input.standingHoldMinor !== "number" ||
      !Number.isSafeInteger(input.standingHoldMinor) ||
      input.standingHoldMinor < 0 ||
      !Number.isInteger(input.standingHoldMinor))
  )
    throw new ValidationError("Recorded standing hold must be a non-negative minor amount");
  if (!enums.clawbackRules.includes(input.clawbackRule))
    throw new ValidationError("Recorded clawback rule is not executable by the mechanism; clawback operates only through subsequently recorded holds");
  if (!enums.nettingRules.includes(input.nettingRule))
    throw new ValidationError(
      "Recorded netting rule is not executable by the mechanism; the netting source is the settlement statement net receivable only",
    );
  if (
    typeof input.minimumThresholdMinor !== "number" ||
    !Number.isSafeInteger(input.minimumThresholdMinor) ||
    input.minimumThresholdMinor < 1 ||
    !Number.isInteger(input.minimumThresholdMinor)
  )
    throw new ValidationError(
      "Recorded payout minimum threshold must be at least one minor unit",
    );
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
        await MerchantPayoutPolicy.exists({ version }).session(session)
      )
        throw new ConflictError(
          "A recorded policy version already exists; record a new version",
        );
    } else {
      const latest = await MerchantPayoutPolicy.findOne({})
        .sort({ version: -1 })
        .session(session)
        .lean();
      version = latest ? latest.version + 1 : 1;
    }
    try {
      policy = await MerchantPayoutPolicy.create(
        [
          {
            version,
            state: "recorded",
            scheduleRule: input.scheduleRule.trim(),
            currencyMode: input.currencyMode,
            ...(input.currencyMode === "recorded_fx_conversion"
              ? {
                  destinationCurrency: input.destinationCurrency,
                  fxSourceName: input.fxSourceName.trim(),
                  fxRateTimestampPolicy: input.fxRateTimestampPolicy,
                  fxMaxAgeMinutes: input.fxMaxAgeMinutes,
                  fxRounding: input.fxRounding,
                }
              : {}),
            destinationAccountSource: input.destinationAccountSource,
            holdRegime: input.holdRegime,
            ...(input.standingHoldMinor !== undefined
              ? { standingHoldMinor: input.standingHoldMinor }
              : {}),
            clawbackRule: input.clawbackRule,
            nettingRule: input.nettingRule,
            minimumThresholdMinor: input.minimumThresholdMinor,
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
    } catch (error) {
      if (error.code !== 11000) throw error;
      if (input.version !== undefined || session || attempt === 7)
        throw new ConflictError("A recorded policy version already exists; record a new version");
    }
  }
  await require("../../../models/AuditLog").create(
    [
      {
        actorUserId: actor._id,
        actorRole: actor.role,
        action: "MERCHANT_PAYOUT_POLICY_RECORD",
        actionCategory: "create",
        targetType: "MerchantPayoutPolicy",
        targetId: policy._id,
        justification: input.decisionReference || "Recorded merchant payout policy",
        changes: {
          after: {
            version: policy.version,
            scheduleRule: policy.scheduleRule,
            currencyMode: policy.currencyMode,
            destinationAccountSource: policy.destinationAccountSource,
            holdRegime: policy.holdRegime,
            clawbackRule: policy.clawbackRule,
            nettingRule: policy.nettingRule,
            minimumThresholdMinor: policy.minimumThresholdMinor,
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
  return MerchantPayoutPolicy.findOne({
    state: "recorded",
    $and: [
      { $or: [{ effectiveFrom: null }, { effectiveFrom: { $lte: now } }] },
      { $or: [{ effectiveUntil: null }, { effectiveUntil: { $gt: now } }] },
    ],
  })
    .sort({ version: -1 })
    .session(session)
    .lean();
}

async function list(actor) {
  assertSuperAdmin(actor);
  return MerchantPayoutPolicy.find({}).sort({ version: -1 }).lean();
}

module.exports = { record, active, list, contentHash };
