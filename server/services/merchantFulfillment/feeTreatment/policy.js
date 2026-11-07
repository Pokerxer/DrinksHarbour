"use strict";
// Fee-treatment policy authority (workstream Fb). Recording is super_admin-only
// and audited; content is operator input — the service validates structure
// only (flows the projection can bind, bearer outcomes and fee treatments it
// can surface as recorded data) and invents no policy content. Resolution is
// read-only and returns null when no recorded, in-window version governs a
// flow — the fail-closed default.
//
// PURE RECORD AUTHORITY — documented choice: this module deliberately ships no
// execution flag. `MERCHANT_FEE_TREATMENT_*`-style flags exist to gate an
// EXECUTION surface; this package builds none (no fee journal writer exists in
// the marketplace path, historical fees stay unknown forever, and the
// mechanism only records decisions and projects them as data). If a future
// reviewed accounting adapter starts executing recorded treatments, THAT step
// must introduce its own default-off flag; importing this policy alone
// confers no authority to write anything.
const crypto = require("node:crypto");
const Policy = require("../../../models/MerchantFeeTreatmentPolicy");
const { ForbiddenError, ValidationError, ConflictError } = require("../../../utils/errors");

function contentHash(input) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        flows: [...input.flows].sort(),
        bearer: input.bearer,
        futureJournalTreatment: input.futureJournalTreatment,
        historicalFeeRule: input.historicalFeeRule,
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
      "Platform super admin required to record fee treatment policies",
    );
}

// Validate the recorded content structurally. Nothing is defaulted: whatever
// the operator did not record stays unrecorded.
function validate(input) {
  const flows = input?.flows;
  if (
    !Array.isArray(flows) ||
    flows.length < 1 ||
    new Set(flows).size !== flows.length ||
    !flows.every((flow) => Policy.FLOWS.includes(flow))
  )
    throw new ValidationError(
      "Recorded fee flows must be a non-empty duplicate-free set of flows the mechanism can bind",
    );
  if (!Policy.BEARERS.includes(input.bearer))
    throw new ValidationError(
      "Recorded fee bearer outcome is not one the mechanism can record as data",
    );
  if (!Policy.TREATMENTS.includes(input.futureJournalTreatment))
    throw new ValidationError(
      "Recorded future-journal fee treatment is not one the mechanism can record as data",
    );
  if (!Policy.HISTORICAL_RULES.includes(input.historicalFeeRule))
    throw new ValidationError(
      "Recorded historical-fee rule is not one the mechanism can record as data",
    );
  return input;
}

// Record a new immutable version. The version number is mechanism sequencing
// (max+1 unless an explicit version is supplied); policy CONTENT is never
// defaulted. Audited via AuditLog. Feasibility of the extra recordable values
// is enforced by the model enum — an amount cannot be invented here, and no
// artifact other than the policy + audit rows is ever written.
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
    const latest = await Policy.findOne().sort({ version: -1 }).session(session).lean();
    version = latest ? latest.version + 1 : 1;
  }
  const [policy] = await Policy.create(
    [
      {
        version,
        state: "recorded",
        flows: input.flows,
        bearer: input.bearer,
        futureJournalTreatment: input.futureJournalTreatment,
        historicalFeeRule: input.historicalFeeRule,
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
        action: "MERCHANT_FEE_TREATMENT_POLICY_RECORD",
        actionCategory: "create",
        targetType: "MerchantFeeTreatmentPolicy",
        targetId: policy._id,
        justification: input.decisionReference || "Recorded fee treatment policy",
        changes: {
          after: {
            version: policy.version,
            flows: policy.flows,
            bearer: policy.bearer,
            futureJournalTreatment: policy.futureJournalTreatment,
            historicalFeeRule: policy.historicalFeeRule,
            contentHash: policy.contentHash,
          },
        },
      },
    ],
    session ? { session } : {},
  );
  return policy;
}

// Read-only resolution of the newest recorded, in-window version binding a
// flow. Versions outside their recorded effective window are skipped (the
// newest in-window version governs); null when none qualifies — callers fail
// closed. DOCUMENTED IMPORT POINT for the other refund mechanisms (kora
// refund bearer fields, payout transfer gating) and readiness UI: import THIS
// function read-only; it never writes.
async function activeForFlow(flow, { session, now = new Date() } = {}) {
  const versions = await Policy.find({
    state: "recorded",
    flows: { $in: [String(flow)] },
  })
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

module.exports = { record, activeForFlow, list };
