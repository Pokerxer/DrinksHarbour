"use strict";
const Contract = require("../../../models/MerchantLocalDispatchContract");
const {
  ValidationError,
  ForbiddenError,
  ConflictError,
} = require("../../../utils/errors");
const { hash } = require("../scope");
const { effectivePermissions } = require("../../effectivePermissions.service");
function platform(actor) {
  if (
    !["admin", "super_admin"].includes(actor?.role) ||
    !effectivePermissions(actor).includes("settings:write")
  )
    throw new ForbiddenError("Platform review authority required");
}
const positive = (n) => Number.isSafeInteger(n) && n > 0;
async function reviewContract(input, actor) {
  platform(actor);
  const keys = [
    "tenant",
    "location",
    "version",
    "currency",
    "amountMinor",
    "maxUnits",
    "maxWeightGrams",
    "vehicleTypes",
    "coverage",
    "capabilities",
    "reviewReference",
    "validUntil",
  ];
  const oid = (n) => typeof n === "string" && /^[a-f0-9]{24}$/i.test(n);
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !keys.includes(k)) ||
    !oid(input.tenant) ||
    !oid(input.location) ||
    !positive(input.version) ||
    input.currency !== "NGN" ||
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor < 0 ||
    !positive(input.maxUnits) ||
    !positive(input.maxWeightGrams) ||
    typeof input.reviewReference !== "string" ||
    input.reviewReference.trim().length < 5 ||
    input.reviewReference.length > 500 ||
    !Array.isArray(input.vehicleTypes) ||
    !input.vehicleTypes.length ||
    input.vehicleTypes.some(
      (v) => !["bike", "tricycle", "car", "van", "truck"].includes(v),
    ) ||
    !Array.isArray(input.coverage) ||
    !input.coverage.length ||
    input.coverage.length > 30 ||
    !Number.isFinite(new Date(input.validUntil).getTime()) ||
    new Date(input.validUntil) <= new Date()
  )
    throw new ValidationError(
      "Complete reviewed local dispatch rate and capabilities required",
    );
  if (
    !input.capabilities ||
    typeof input.capabilities !== "object" ||
    Array.isArray(input.capabilities) ||
    Object.keys(input.capabilities).some(
      (k) => !["alcohol", "ageVerification", "fragile"].includes(k),
    ) ||
    ["alcohol", "ageVerification", "fragile"].some(
      (k) => typeof input.capabilities[k] !== "boolean",
    ) ||
    (input.capabilities.alcohol && !input.capabilities.ageVerification)
  )
    throw new ValidationError(
      "Explicit reviewed alcohol, age verification and fragile capabilities required",
    );
  for (const r of input.coverage) {
    if (
      !r || typeof r !== "object" || Array.isArray(r) ||
      Object.keys(r).some(
        (k) =>
          ![
            "country",
            "state",
            "city",
            "minLat",
            "maxLat",
            "minLon",
            "maxLon",
          ].includes(k),
      ) ||
      ["country", "state", "city"].some(
        (k) => typeof r[k] !== "string" || !r[k].trim() || r[k].length > 100,
      ) ||
      !["Nigeria", "NG"].includes(r.country) ||
      !["minLat", "maxLat", "minLon", "maxLon"].every((k) =>
        Number.isFinite(r[k]),
      ) ||
      r.minLat < -90 ||
      r.maxLat > 90 ||
      r.minLon < -180 ||
      r.maxLon > 180 ||
      r.minLat >= r.maxLat ||
      r.minLon >= r.maxLon
    )
      throw new ValidationError(
        "Exact Nigerian address and coordinate coverage required",
      );
  }
  const warehouse = await require("../../../models/Warehouse")
    .findOne({ _id: input.location, tenant: input.tenant, isActive: true })
    .lean();
  if (!warehouse)
    throw new ConflictError("Reviewed location ownership unavailable");
  const identity = hash([input.tenant, input.location, input.version]);
  if (await Contract.exists({ _id: identity }))
    throw new ConflictError("Reviewed dispatch version already exists");
  const latest = await Contract.findOne({
    tenant: input.tenant,
    location: input.location,
  })
    .sort({ version: -1 })
    .lean();
  if (latest && latest.version >= input.version)
    throw new ConflictError("Review requires a newer immutable version");
  const row = await Contract.create({
    _id: identity,
    ...input,
    status: "reviewed",
    reviewedBy: actor._id,
    reviewedAt: new Date(),
  });
  await require("../../merchantFulfillment/access").audit(
    { ...row.toObject(), order: undefined },
    actor,
    "LOCAL_DISPATCH_CONTRACT_REVIEWED",
  );
  return row.toObject();
}
async function revokeContract(id, actor) {
  platform(actor);
  let row = await Contract.findOneAndUpdate(
    { _id: id, status: { $ne: "revoked" } },
    {
      $set: { status: "revoked", revokedBy: actor._id, revokedAt: new Date() },
    },
    { returnDocument: "after" },
  ).lean();
  if (!row) {
    row = await Contract.findOne({ _id: id, status: "revoked" }).lean();
    if (row) return row;
    throw new ConflictError("Reviewed contract not found");
  }
  await require("../../merchantFulfillment/access").audit(
    row,
    actor,
    "LOCAL_DISPATCH_CONTRACT_REVOKED",
  );
  return row;
}
module.exports = { reviewContract, revokeContract, platform };
