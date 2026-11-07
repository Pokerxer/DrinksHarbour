"use strict";
// Merchant disposition policy authority: immutable versioned records binding
// post-quarantine treatment per condition. Recording is super-admin-only,
// audited, monotonic in version and never updates existing content; the
// executor (effects.js) is the only consumer. Mechanism, not policy: no
// default content exists anywhere and production databases hold no records.
const mongoose = require("mongoose"),
  { ConflictError, ForbiddenError, ValidationError } = require("../../../utils/errors"),
  { hash, id } = require("../../merchantFulfillment/allocation"),
  gates = require("./validate"),
  Policy = require("../../../models/MerchantDispositionPolicy");
const KEYS = [
  "tenant",
  "version",
  "treatmentByCondition",
  "restockLocationRule",
  "cogsTreatment",
  "reviewReference",
  "effectiveFrom",
  "effectiveUntil",
];
const TREATMENTS = ["restock", "write_off", "retain_quarantine"];
const bounded = (value, min, max) =>
  typeof value === "string" && value.trim().length >= min && value.length <= max;
const date = (value) =>
  value === undefined || (typeof value === "string" && Number.isFinite(new Date(value).getTime()));
function policyDTO(row) {
  const source = row.toObject ? row.toObject() : row;
  return {
    _id: source._id,
    tenant: id(source.tenant),
    version: source.version,
    status: source.status,
    treatmentByCondition: { ...source.treatmentByCondition },
    restockLocationRule: source.restockLocationRule,
    cogsTreatment: source.cogsTreatment,
    reviewReference: source.reviewReference,
    ...(source.effectiveFrom ? { effectiveFrom: source.effectiveFrom } : {}),
    ...(source.effectiveUntil ? { effectiveUntil: source.effectiveUntil } : {}),
    recordedBy: id(source.recordedBy),
    recordedAt: source.recordedAt,
    ...(source.revokedBy ? { revokedBy: id(source.revokedBy) } : {}),
    ...(source.revokedAt ? { revokedAt: source.revokedAt } : {}),
  };
}
function platformAuthority(actor) {
  if (actor?.role !== "super_admin")
    throw new ForbiddenError("Platform disposition policy authority required");
}
function validate(input) {
  const treatments = input?.treatmentByCondition;
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !KEYS.includes(key)) ||
    !mongoose.isValidObjectId(input.tenant) ||
    !Number.isSafeInteger(input.version) ||
    input.version < 1 ||
    !treatments ||
    typeof treatments !== "object" ||
    Array.isArray(treatments) ||
    Object.keys(treatments).length !== gates.CONDITIONS.length ||
    gates.CONDITIONS.some(
      (condition) =>
        !TREATMENTS.includes(treatments[condition]) ||
        !gates.ELIGIBLE[treatments[condition]].includes(condition),
    ) ||
    !bounded(input.restockLocationRule, 1, 100) ||
    !bounded(input.cogsTreatment, 1, 100) ||
    !bounded(input.reviewReference, 5, 500) ||
    !date(input.effectiveFrom) ||
    !date(input.effectiveUntil)
  )
    throw new ValidationError(
      "Complete recorded disposition treatment, location rule, COGS treatment and review reference required",
    );
  if (
    input.effectiveFrom &&
    input.effectiveUntil &&
    new Date(input.effectiveFrom) >= new Date(input.effectiveUntil)
  )
    throw new ValidationError("Recorded policy effective interval is empty");
}
async function recordPolicy(input, actor) {
  platformAuthority(actor);
  validate(input);
  const tenant = id(input.tenant),
    identity = hash(`${tenant}:disposition-policy:v${input.version}`);
  if (await Policy.exists({ _id: identity }))
    throw new ConflictError("Recorded disposition version already exists");
  const latest = await Policy.findOne({ tenant }).sort({ version: -1 }).lean();
  if (latest && latest.version >= input.version)
    throw new ConflictError("Recording requires a newer immutable version");
  const row = await Policy.create({
    _id: identity,
    tenant,
    version: input.version,
    status: "recorded",
    treatmentByCondition: { ...input.treatmentByCondition },
    restockLocationRule: input.restockLocationRule,
    cogsTreatment: input.cogsTreatment,
    reviewReference: input.reviewReference,
    ...(input.effectiveFrom ? { effectiveFrom: new Date(input.effectiveFrom) } : {}),
    ...(input.effectiveUntil ? { effectiveUntil: new Date(input.effectiveUntil) } : {}),
    recordedBy: actor._id,
    recordedAt: new Date(),
  });
  await require("../../../models/AuditLog").create([
    {
      actorUserId: actor._id,
      actorRole: actor.role,
      action: "RETURN_DISPOSITION_POLICY_RECORDED",
      actionCategory: "create",
      targetType: "MerchantDispositionPolicy",
      targetTenantId: row.tenant,
      justification: "Authorized platform disposition policy recording",
      changes: {
        after: {
          policyId: row._id,
          version: row.version,
          reviewReference: row.reviewReference,
        },
      },
    },
  ]);
  return policyDTO(row);
}
async function revokePolicy(id, actor) {
  platformAuthority(actor);
  let row = await Policy.findOneAndUpdate(
    { _id: id, status: { $ne: "revoked" } },
    { $set: { status: "revoked", revokedBy: actor._id, revokedAt: new Date() } },
    { returnDocument: "after" },
  ).lean();
  if (!row) {
    row = await Policy.findOne({ _id: id, status: "revoked" }).lean();
    if (row) return policyDTO(row);
    throw new ConflictError("Recorded disposition policy not found");
  }
  await require("../../../models/AuditLog").create([
    {
      actorUserId: actor._id,
      actorRole: actor.role,
      action: "RETURN_DISPOSITION_POLICY_REVOKED",
      actionCategory: "update",
      targetType: "MerchantDispositionPolicy",
      targetTenantId: row.tenant,
      justification: "Authorized platform disposition policy revocation",
      changes: {
        after: { policyId: row._id, version: row.version, status: "revoked" },
      },
    },
  ]);
  return policyDTO(row);
}
async function listPolicies(actor) {
  platformAuthority(actor);
  const rows = await Policy.find({}).sort({ tenant: 1, version: 1 }).lean();
  return rows.map(policyDTO);
}
// Single resolution authority for the effects executor: the newest recorded
// version inside its reviewed effective interval, recorded by a current active
// super-admin. Anything else resolves to "no recorded policy" (fail closed).
async function activePolicy(tenantId, session) {
  const row = await Policy.findOne({ tenant: tenantId, status: "recorded" })
    .sort({ version: -1 })
    .session(session)
    .lean();
  if (!row) return null;
  const now = new Date();
  if (
    (row.effectiveFrom && new Date(row.effectiveFrom) > now) ||
    (row.effectiveUntil && new Date(row.effectiveUntil) <= now)
  )
    return null;
  if (
    !(await require("../../../models/User").exists({
      _id: row.recordedBy,
      role: "super_admin",
      status: "active",
    }).session(session))
  )
    return null;
  return row;
}
module.exports = { recordPolicy, revokePolicy, listPolicies, activePolicy, policyDTO };
