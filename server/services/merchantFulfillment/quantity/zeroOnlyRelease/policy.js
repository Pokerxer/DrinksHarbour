"use strict";
// Policy authority for zero-only no-money unit release (workstream Z).
// Recording is super_admin-only and audited; content is operator input — the
// service validates structure only (record shape and scope rule the release
// mechanism can actually execute) and invents no policy content. Resolution
// (`activePolicy`) is read-only and returns null when no recorded, in-window
// version recorded by a current active super_admin exists — the fail-closed
// default. Immutable versions: same or older version recording is rejected.
const crypto = require("node:crypto"),
  mongoose = require("mongoose");
const Policy = require("../../../../models/MerchantNoMoneyReleasePolicy");
const { ForbiddenError, ConflictError, ValidationError } = require(
  "../../../../utils/errors",
);
const SHAPES = ["zero_release_v1"];
const SCOPE_RULES = [
  "zero_merchandise_only",
  "zero_merchandise_any_shipping_tax",
];
const KEYS = [
  "tenant",
  "version",
  "recordShape",
  "scopeRule",
  "auditWording",
  "decisionReference",
  "effectiveFrom",
  "effectiveUntil",
];
const bounded = (value, min, max) =>
  typeof value === "string" &&
  value.trim().length >= min &&
  value.trim().length <= max;
const date = (value) =>
  value === undefined ||
  (value instanceof Date && !Number.isNaN(value.getTime())) ||
  (typeof value === "string" && Number.isFinite(new Date(value).getTime()));

function contentHash(input) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        String(input.tenant),
        input.recordShape,
        input.scopeRule,
        input.auditWording.trim(),
        input.decisionReference ?? null,
        input.effectiveFrom ?? null,
        input.effectiveUntil ?? null,
      ]),
    )
    .digest("hex");
}

function policyDTO(row) {
  const source = row.toObject ? row.toObject() : row;
  return {
    _id: source._id,
    tenant: String(source.tenant),
    version: source.version,
    state: source.state,
    recordShape: source.recordShape,
    scopeRule: source.scopeRule,
    auditWording: source.auditWording,
    ...(source.decisionReference
      ? { decisionReference: source.decisionReference }
      : {}),
    ...(source.effectiveFrom ? { effectiveFrom: source.effectiveFrom } : {}),
    ...(source.effectiveUntil ? { effectiveUntil: source.effectiveUntil } : {}),
    recordedBy: String(source.recordedBy),
    recordedAt: source.recordedAt,
    contentHash: source.contentHash,
  };
}

function assertSuperAdmin(actor) {
  if (actor?.role !== "super_admin")
    throw new ForbiddenError(
      "Platform super admin required to record no-money release policies",
    );
}

function validate(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !KEYS.includes(key)) ||
    !mongoose.isValidObjectId(input.tenant) ||
    !Number.isSafeInteger(input.version) ||
    input.version < 1 ||
    !SHAPES.includes(input.recordShape) ||
    !SCOPE_RULES.includes(input.scopeRule) ||
    !bounded(input.auditWording, 5, 300) ||
    (input.decisionReference !== undefined &&
      !bounded(input.decisionReference, 5, 280)) ||
    !date(input.effectiveFrom) ||
    !date(input.effectiveUntil)
  )
    throw new ValidationError(
      "Recorded no-money release shape, scope rule, audit wording and decision reference required",
    );
  if (
    input.effectiveFrom &&
    input.effectiveUntil &&
    new Date(input.effectiveFrom) >= new Date(input.effectiveUntil)
  )
    throw new ValidationError("Recorded policy effective interval is empty");
}

// Record a new immutable version. Version sequencing is operator-declared and
// monotonic per tenant; policy CONTENT is never defaulted.
async function recordPolicy(input, actor, { session } = {}) {
  assertSuperAdmin(actor);
  validate(input);
  const tenant = new mongoose.Types.ObjectId(input.tenant),
    identity = crypto
      .createHash("sha256")
      .update(`${tenant}:no-money-release-policy:v${input.version}`)
      .digest("hex");
  if (await Policy.exists({ _id: identity }).session(session))
    throw new ConflictError(
      "Recorded no-money release version already exists; record a newer version",
    );
  const latest = await Policy.findOne({ tenant })
    .sort({ version: -1 })
    .session(session)
    .lean();
  if (latest && latest.version >= input.version)
    throw new ConflictError("Recording requires a newer immutable version");
  const [row] = await Policy.create(
    [
      {
        _id: identity,
        tenant,
        version: input.version,
        state: "recorded",
        recordShape: input.recordShape,
        scopeRule: input.scopeRule,
        auditWording: input.auditWording.trim(),
        ...(input.decisionReference
          ? { decisionReference: input.decisionReference.trim() }
          : {}),
        ...(input.effectiveFrom
          ? { effectiveFrom: new Date(input.effectiveFrom) }
          : {}),
        ...(input.effectiveUntil
          ? { effectiveUntil: new Date(input.effectiveUntil) }
          : {}),
        recordedBy: actor._id,
        recordedAt: new Date(),
        contentHash: contentHash(input),
      },
    ],
    { session },
  );
  await require("../../../../models/AuditLog").create(
    [
      {
        actorUserId: actor._id,
        actorRole: actor.role,
        action: "MERCHANT_NO_MONEY_RELEASE_POLICY_RECORDED",
        actionCategory: "create",
        targetType: "MerchantNoMoneyReleasePolicy",
        targetTenantId: tenant,
        justification:
          input.decisionReference?.trim() ||
          "Authorized platform no-money release policy recording",
        changes: {
          after: {
            policyId: row._id,
            version: row.version,
            scopeRule: row.scopeRule,
            recordShape: row.recordShape,
            contentHash: row.contentHash,
          },
        },
      },
    ],
    session ? { session } : {},
  );
  return policyDTO(row);
}

async function listPolicies(actor) {
  assertSuperAdmin(actor);
  const rows = await Policy.find({}).sort({ tenant: 1, version: 1 }).lean();
  return rows.map(policyDTO);
}

// Single resolution authority for the release executor: the newest recorded
// version inside its reviewed effective interval, recorded by a current active
// super admin. Anything else resolves to "no recorded policy" (fail closed).
async function activePolicy(tenantId, session) {
  const rows = await Policy.find({ tenant: tenantId, state: "recorded" })
    .sort({ version: -1 })
    .session(session)
    .lean();
  const now = new Date();
  for (const row of rows) {
    if (
      (row.effectiveFrom && new Date(row.effectiveFrom) > now) ||
      (row.effectiveUntil && new Date(row.effectiveUntil) <= now)
    )
      continue;
    if (
      !(await require("../../../../models/User").exists({
        _id: row.recordedBy,
        role: "super_admin",
        status: "active",
      }).session(session))
    )
      continue;
    return row;
  }
  return null;
}

module.exports = { recordPolicy, listPolicies, activePolicy, policyDTO };
