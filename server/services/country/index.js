"use strict";
const Country = require("../../models/CountryConfiguration");
const {
  error,
  normalizeCode,
  normalizeConfiguration,
  publicCountry,
  assertReadiness,
  READINESS,
} = require("./validation");
const LEGACY_NG = Object.freeze({
  code: "NG",
  name: "Nigeria",
  currency: "NGN",
  locale: "en-NG",
  timezones: ["Africa/Lagos"],
  capabilities: { marketplace: true, storefront: true, erm: true },
  active: true,
  version: 0,
});
async function resolveCountry(code = "NG", { requireActive = true } = {}) {
  code = normalizeCode(code);
  let config = await Country.findOne({ code }).lean();
  if (
    !config &&
    code === "NG" &&
    process.env.MARKET_FOUNDATIONS_ENABLED !== "true"
  )
    config = structuredClone(LEGACY_NG);
  if (!config) throw error("Country is not configured", 404, "COUNTRY_UNKNOWN");
  if (requireActive && config.active !== true)
    throw error("Country is inactive", 403, "COUNTRY_INACTIVE");
  return config;
}
function authority(actor, reason) {
  if (actor?.role !== "super_admin" || !actor._id)
    throw error("Super-admin authority required", 403, "COUNTRY_FORBIDDEN");
  if (
    typeof reason !== "string" ||
    reason.trim().length < 5 ||
    reason.length > 1000
  )
    throw error("A review reason of 5–1000 characters is required");
}
function revision(state, action, actor, reason) {
  const { _id, createdAt, updatedAt, revisions, ...snapshot } = state;
  return {
    version: state.version,
    action,
    actor: actor._id,
    at: new Date(),
    reason: reason.trim(),
    snapshot,
  };
}
async function createCountry(input, actor, reason) {
  authority(actor, reason);
  const state = {
    ...normalizeConfiguration(input),
    version: 1,
    active: false,
    readiness: {},
  };
  await require("../marketIndexReadiness").assertUniqueIndexes(Country, [{ code: 1 }], "COUNTRY_INDEXES_REQUIRED");
  try {
    return (
      await Country.create({
        ...state,
        revisions: [revision(state, "create", actor, reason)],
      })
    ).toObject();
  } catch (e) {
    if (e.code === 11000)
      throw error("Country already exists", 409, "COUNTRY_CONFLICT");
    throw e;
  }
}
async function mutateCountry(
  code,
  expectedVersion,
  actor,
  reason,
  action,
  transform,
) {
  authority(actor, reason);
  code = normalizeCode(code);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)
    throw error("expectedVersion is required");
  await require("../marketIndexReadiness").assertUniqueIndexes(Country, [{ code: 1 }], "COUNTRY_INDEXES_REQUIRED");
  const current = await Country.findOne({ code }).lean();
  if (!current)
    throw error("Country is not configured", 404, "COUNTRY_UNKNOWN");
  if (current.version !== expectedVersion)
    throw error(
      "Country changed; reload before saving",
      409,
      "COUNTRY_CONFLICT",
    );
  const changes = transform(current);
  const state = { ...current, ...changes, version: expectedVersion + 1 };
  const updated = await Country.findOneAndUpdate(
    { code, version: expectedVersion },
    {
      $set: { ...changes, version: state.version },
      $push: { revisions: revision(state, action, actor, reason) },
    },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!updated)
    throw error(
      "Country changed; reload before saving",
      409,
      "COUNTRY_CONFLICT",
    );
  return updated;
}
function updateCountry(code, input, actor, reason) {
  return mutateCountry(
    code,
    input.expectedVersion,
    actor,
    reason,
    "configure",
    () => ({
      ...normalizeConfiguration({ ...input, code }),
      active: false,
      readiness: {},
    }),
  );
}
function reviewCountry(code, input, actor, reason) {
  return mutateCountry(
    code,
    input.expectedVersion,
    actor,
    reason,
    "review",
    (current) => {
      if (
        !READINESS.includes(input.prerequisite) ||
        typeof input.evidence !== "string" ||
        input.evidence.trim().length < 5 ||
        input.evidence.length > 1000
      )
        throw error(
          "A known prerequisite and evidence reference of 5–1000 characters are required",
        );
      return {
        readiness: {
          ...current.readiness,
          [input.prerequisite]: {
            evidence: input.evidence.trim(),
            reviewedBy: actor._id,
            reviewedAt: new Date(),
          },
        },
      };
    },
  );
}
function activateCountry(code, input, actor, reason) {
  return mutateCountry(
    code,
    input.expectedVersion,
    actor,
    reason,
    input.active ? "activate" : "deactivate",
    (current) => {
      if (typeof input.active !== "boolean")
        throw error("active must be a boolean");
      if (input.active) assertReadiness(current);
      return { active: input.active };
    },
  );
}
async function listCountries({ admin = false } = {}) {
  const configs = await Country.find(admin ? {} : { active: true })
    .sort({ code: 1 })
    .lean();
  if (
    !configs.some((c) => c.code === "NG") &&
    process.env.MARKET_FOUNDATIONS_ENABLED !== "true" &&
    !(await Country.exists({ code: "NG" }))
  )
    configs.push(structuredClone(LEGACY_NG));
  return admin ? configs : configs.map(publicCountry);
}
module.exports = {
  resolveCountry,
  publicCountry,
  normalizeConfiguration,
  assertReadiness,
  createCountry,
  updateCountry,
  reviewCountry,
  activateCountry,
  listCountries,
  READINESS,
};
