'use strict';
// services/venue/recipes.js — versioned recipe authoring for venue outputs (S2, spec §5).
//
// Versions are append-only and immutable: a saved RecipeVersion row is never rewritten.
// New knowledge lands as a NEW version row (version is monotonic per output) that
// supersedes the previous latest through `supersededBy`; that pointer is the only field
// ever moved after creation. `expectedVersion` is the caller's view of the current latest
// version (0 = none) — optimistic concurrency — and any drift fails STATE_CHANGED.
//
// `costMinorPerUnit` is a PROJECTED authoring input: passed numbers are stored as given,
// absence is stored as null. Cost is never calculated silently from unknown data.
//
// Recipes are tenant-global (they source from stock items anywhere in the tenant); the
// locationId routes are only the eligibility/context anchor, exactly like other
// venue-ops commands.

const RecipeVersion = require('../../models/RecipeVersion');
const IngredientProfile = require('../../models/IngredientProfile');
const SubProduct = require('../../models/SubProduct');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const units = require('./units');
const { isVenueServiceProduct } = require('../../constants/catalogKind');

function versionDTO(version) {
  return {
    id: id(version),
    subProductId: id(version.output ? version.output.subProduct : null),
    sizeId: id(version.output ? version.output.size : null),
    version: version.version,
    components: (version.components || []).map(component => ({ profileId: id(component.profile), quantity: component.quantity, unit: component.unit, ...(component.stockMapping ? { stockMapping: component.stockMapping } : {}) })),
    yieldAssumption: {
      units: version.yieldAssumption && version.yieldAssumption.units != null ? version.yieldAssumption.units : null,
      lossMl: version.yieldAssumption && version.yieldAssumption.lossMl != null ? version.yieldAssumption.lossMl : null,
    },
    method: version.method == null ? null : version.method,
    costMinorPerUnit: version.costMinorPerUnit == null ? null : version.costMinorPerUnit,
    effectiveFrom: version.effectiveFrom ? new Date(version.effectiveFrom).toISOString() : null,
    supersededBy: version.supersededBy == null ? null : id(version.supersededBy),
    createdBy: id(version.createdBy),
    createdAt: version.createdAt ? new Date(version.createdAt).toISOString() : null,
  };
}
module.exports.versionDTO = versionDTO;

// Latest tenant-owned version for one output — null when the recipe does not (yet) exist.
// Accepts {subProduct, size} or {subProductId, sizeId} so fire-time (Task 5) and clients
// can call it with whichever shape is at hand.
async function resolveActiveVersion(tenantId, output, mongoSession = null) {
  if (!output) fail('INVALID_ID', 'Recipe output is required', 400);
  const subProductId = id(output.subProduct != null ? output.subProduct : output.subProductId);
  const sizeId = id(output.size != null ? output.size : output.sizeId);
  let query = RecipeVersion.findOne({ tenant: tenantId, 'output.subProduct': subProductId, 'output.size': sizeId, supersededBy: null }).sort({ version: -1 });
  if (mongoSession) query = query.session(mongoSession);
  return query.lean();
}
module.exports.resolveActiveVersion = resolveActiveVersion;

function requireExpectedVersion(expectedVersion) {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) fail('STATE_CHANGED', 'Recipe version required; reload before saving');
}

// Authoring input: components [{profile, quantity, unit('count'|'ml'|'g'|'l')}],
// yieldAssumption {units, lossMl?}, method ≤2000 chars, costMinorPerUnit (null|number≥0).
// 'l' collapses to 'ml' here so the stored enum stays exactly count|ml|g; validation and
// duplicate detection ride units.assertRecipeQuantities on the normalized list.
function recipeInput(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.components)) fail('INVALID_INPUT', 'Recipe components are required', 400);
  const components = raw.components.map(component => {
    if (!component || typeof component !== 'object') fail('INVALID_INPUT', 'Each recipe component needs a profile', 400);
    const quantity = Number(component.quantity);
    if (component.unit === 'l') {
      const converted = units.convert(quantity, 'l', 'ml');
      return { profile: component.profile, quantity: converted.quantity, unit: 'ml', ...(component.stockMapping ? { stockMapping: require('./recipe-mapping').normalizeMapping(component.stockMapping) } : {}) };
    }
    return { profile: component.profile, quantity, unit: component.unit, ...(component.stockMapping ? { stockMapping: require('./recipe-mapping').normalizeMapping(component.stockMapping) } : {}) };
  });
  units.assertRecipeQuantities(components);
  const assumption = normalizeYield({ yieldAssumption: raw.yieldAssumption });
  let method = null;
  if (raw.method != null) {
    if (typeof raw.method !== 'string' || raw.method.length > 2000) fail('INVALID_INPUT', 'Recipe method is limited to 2000 characters', 400);
    method = raw.method;
  }
  let costMinorPerUnit = null;
  if (raw.costMinorPerUnit != null) {
    if (!Number.isInteger(raw.costMinorPerUnit) || raw.costMinorPerUnit < 0) fail('INVALID_INPUT', 'costMinorPerUnit is a non-negative integer in minor units, or absent for unknown cost', 400);
    costMinorPerUnit = raw.costMinorPerUnit;
  }
  // Note: only an EXPLICIT effectiveFrom participates in the idempotency payload —
  // an implicit now() here would make replay fingerprints drift (spec §5 preserved).
  let effectiveFrom = raw.effectiveFrom == null ? null : new Date(raw.effectiveFrom);
  if (raw.effectiveFrom != null && Number.isNaN(effectiveFrom.getTime())) fail('INVALID_INPUT', 'effectiveFrom must be a valid date', 400);
  return { components, yieldAssumption: assumption, method, costMinorPerUnit, effectiveFrom };
}

function normalizeYield(input) {
  const assumption = input && input.yieldAssumption;
  if (!assumption || !Number.isInteger(assumption.units) || assumption.units < 1) fail('INVALID_INPUT', 'yieldAssumption.units is a whole number of servings >= 1', 400);
  if (assumption.lossMl != null && (typeof assumption.lossMl !== 'number' || !Number.isFinite(assumption.lossMl) || assumption.lossMl < 0)) {
    fail('INVALID_INPUT', 'yieldAssumption.lossMl is a non-negative number of millilitres', 400);
  }
  return assumption.lossMl != null ? { units: assumption.units, lossMl: assumption.lossMl } : { units: assumption.units };
}

// The output SubProduct must belong to the tenant ({_id, tenant} lookup) and its Product
// must satisfy the S1 venue-service predicate. The Size must be the tenant's size of that
// very SubProduct.
async function resolveOutput({ tenantId, subProductId, sizeId }, mongoSession) {
  const subproduct = await SubProduct.findOne({ _id: subProductId, tenant: tenantId }).session(mongoSession).lean();
  if (!subproduct) fail('NOT_FOUND', 'Set output not found for this tenant', 404);
  const product = await require('../../models/Product').findOne({ _id: subproduct.product }).session(mongoSession).lean();
  if (!isVenueServiceProduct(product)) fail('INVALID_INPUT', 'This product cannot be a recipe output', 400);
  const size = await require('../../models/Size').findOne({ _id: sizeId, tenant: tenantId, subproduct: subProductId }).session(mongoSession).lean();
  if (!size) fail('NOT_FOUND', 'Set output size not found for this tenant', 404);
  return subproduct;
}

// Component profiles must exist in the component caller's tenant — an profile that belongs
// to another tenant is, from this tenant, simply unknown (NOT_FOUND, never 403 finance
// enumeration).
async function assertProfiles(tenantId, components, mongoSession) {
  const profileIds = [...new Set(components.map(component => String(component.profile)))];
  const rows = await IngredientProfile.find({ tenant: tenantId, _id: { $in: profileIds } }).select('_id').session(mongoSession).lean();
  if (rows.length !== profileIds.length) fail('NOT_FOUND', 'Ingredient profile not found', 404);
}

// Monotonic append inside the operation transaction: read latest, guard expectedVersion,
// create version n+1, then point the previous latest at it. On success every version
// except the newest has supersededBy set.
async function recordVersion({ tenantId, locationId, subProductId, sizeId, expectedVersion, input, actor }, mongoSession) {
  const latest = await RecipeVersion.findOne({ tenant: tenantId, 'output.subProduct': subProductId, 'output.size': sizeId }).sort({ version: -1 }).session(mongoSession).lean();
  const currentLatest = latest ? latest.version : 0;
  if (currentLatest !== expectedVersion) fail('STATE_CHANGED', 'Recipe changed elsewhere; reload before saving');
  const [row] = await RecipeVersion.create([{
    tenant: tenantId, output: { subProduct: subProductId, size: sizeId }, version: currentLatest + 1,
    components: await require('./recipe-mapping').reviewMappings({ tenantId, locationId, actor }, input.components, mongoSession),
    yieldAssumption: input.yieldAssumption, method: input.method, costMinorPerUnit: input.costMinorPerUnit,
    effectiveFrom: input.effectiveFrom || new Date(), supersededBy: null, createdBy: actor.userId,
  }], { session: mongoSession });
  if (currentLatest > 0) {
    await RecipeVersion.updateOne({ tenant: tenantId, 'output.subProduct': subProductId, 'output.size': sizeId, version: currentLatest },
      { $set: { supersededBy: row._id } }, { session: mongoSession });
  }
  return versionDTO(row);
}

// Author (or supersede-through) a recipe version inside runVenueOperation idempotency:
// { tenantId, locationId, subProductId, sizeId, expectedVersion, input, actor, idempotencyKey }.
async function createVersion(args) {
  requireId(args.subProductId); requireId(args.sizeId);
  requireExpectedVersion(args.expectedVersion);
  const input = recipeInput(args.input);
  const context = await loadVenueContext({ ...args, action: 'recipes.write' });
  return runVenueOperation({
    targetType: 'RecipeVersion', tenantId: args.tenantId, locationId: args.locationId, actor: context.actor,
    operation: 'recipe.record', key: args.idempotencyKey,
    payload: { subProductId: args.subProductId, sizeId: args.sizeId, expectedVersion: args.expectedVersion, input },
    execute: async ({ mongoSession }) => {
      await loadVenueContext({ ...args, action: 'recipes.write', mongoSession });
      await resolveOutput(args, mongoSession);
      await assertProfiles(args.tenantId, input.components, mongoSession);
      return recordVersion({ ...args, input, actor: context.actor }, mongoSession);
    },
  });
}
module.exports.createVersion = createVersion;

// List the tenant's recipes grouped by output: every version plus a convenience
// activeVersion pointer (newest non-superseded). Read action enforced at context load.
async function listRecipes(args) {
  const context = await loadVenueContext({ ...args, action: 'recipes.read' });
  void context;
  const versions = await RecipeVersion.find({ tenant: args.tenantId }).sort({ 'output.subProduct': 1, 'output.size': 1, version: -1 }).lean();
  const groups = new Map();
  for (const row of versions) {
    const key = `${id(row.output.subProduct)}:${id(row.output.size)}`;
    const group = groups.get(key) || { subProductId: id(row.output.subProduct), sizeId: id(row.output.size), versions: [] };
    group.versions.push(versionDTO(row));
    groups.set(key, group);
  }
  const servings = await require('../../models/Size').find({ tenant: args.tenantId, servingSchemaVersion: 2, 'venueServing.mode': { $in: ['made_to_order','prepared_batch'] } }).select('_id subproduct displayName').lean();
  for (const serving of servings) { const key = `${id(serving.subproduct)}:${id(serving)}`;const group = groups.get(key) || { subProductId: id(serving.subproduct), sizeId: id(serving), versions: [] };group.isVenueServing = true;group.displayName = serving.displayName;groups.set(key,group); }
  const items = [...groups.values()].map(group => ({ ...group, activeVersion: group.versions.find(version => version.supersededBy === null) || null }));
  return { items };
}
module.exports.listRecipes = listRecipes;
