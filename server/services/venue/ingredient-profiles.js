'use strict';
const Profile = require('../../models/IngredientProfile');
const { id } = require('./eligibility');
const { fail, requireId } = require('./errors');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { listPage, pageRows } = require('./catalog-list-page');
async function listProfiles(args) {
  await loadVenueContext({ ...args, action: 'recipes.read' });
  const { limit, after } = listPage(args);
  const page = pageRows(await Profile.find({ tenant: args.tenantId, ...after })
    .sort({ _id: 1 }).limit(limit + 1).lean(), limit);
  const rows = page.items;
  const items = [];
  for (const row of rows) {
    const sub = await require('../../models/SubProduct')
      .findOne({ _id: row.subProduct, tenant: args.tenantId })
      .select('product')
      .populate('product', 'name')
      .lean();
    const stocks = await require('../../models/WarehouseStock')
      .find({
        tenant: args.tenantId,
        warehouse: args.locationId,
        subProduct: row.subProduct,
      })
      .select('size')
      .lean();
    const forms = await require('../../models/Size')
      .find({
        _id: { $in: stocks.map((stock) => stock.size) },
        tenant: args.tenantId,
        subproduct: row.subProduct,
      })
      .select('displayName size')
      .lean();
    items.push({
      id: id(row),
      subProductId: id(row.subProduct),
      name: sub?.product?.name || 'Ingredient',
      dimension: row.dimension,
      gramsPerMl: row.gramsPerMl ?? null,
      perishable: row.perishable ?? null,
      allergenSource: row.allergenSource || [],
      stockForms: forms.map((form) => ({
        id: id(form),
        name: form.displayName || form.size || 'Stock unit',
      })),
    });
  }
  return { items, nextCursor: page.nextCursor };
}
async function sourceCandidates(args) {
  await loadVenueContext({ ...args, action: 'experience.manage' });
  const { limit, after } = listPage(args);
  const ObjectId = require('mongoose').Types.ObjectId;
  const keys = await require('../../models/WarehouseStock').aggregate([
    { $match: { tenant: new ObjectId(args.tenantId), warehouse: new ObjectId(args.locationId) } },
    { $group: { _id: '$subProduct' } },
    ...(after._id ? [{ $match: after }] : []),
    { $sort: { _id: 1 } }, { $limit: limit + 1 },
  ]);
  const page = pageRows(keys, limit);
  const rows = await require('../../models/SubProduct')
    .find({ _id: { $in: page.items.map(row => row._id) }, tenant: args.tenantId })
    .select('product').populate('product', 'name').lean();
  const byId = new Map(rows.map(row => [id(row), row]));
  return { items: page.items.flatMap(key => {
    const row = byId.get(id(key));
    return row ? [{ id: id(row), name: row.product?.name || 'Stock item' }] : [];
  }), nextCursor: page.nextCursor };
}

async function createProfile(args) {
  const raw = args.input;
  if (
    !raw ||
    Object.keys(raw).some(
      (key) =>
        ![
          'subProductId',
          'dimension',
          'gramsPerMl',
          'perishable',
          'allergenSource',
        ].includes(key),
    )
  )
    fail('INVALID_INPUT', 'Ingredient facts only', 400);
  requireId(raw.subProductId);
  if (
    !['count', 'volume', 'mass'].includes(raw.dimension) ||
    typeof raw.perishable !== 'boolean' ||
    !Array.isArray(raw.allergenSource) ||
    new Set(raw.allergenSource).size !== raw.allergenSource.length ||
    raw.allergenSource.some((value) => !Profile.ALLERGEN_CODES.includes(value))
  )
    fail(
      'INVALID_INPUT',
      'Choose ingredient measurement and explicit known facts',
      400,
    );
  if (
    raw.gramsPerMl != null &&
    (typeof raw.gramsPerMl !== 'number' ||
      !Number.isFinite(raw.gramsPerMl) ||
      raw.gramsPerMl <= 0)
  )
    fail('INVALID_INPUT', 'Item-specific grams per ml must be positive', 400);
  const context = await loadVenueContext({
    ...args,
    action: 'experience.manage',
  });
  const indexes = await Profile.collection
    .listIndexes()
    .toArray()
    .catch((error) => {
      if (error.code === 26) return [];
      throw error;
    });
  if (
    !indexes.some(
      (index) =>
        index.unique &&
        !index.partialFilterExpression &&
        !index.sparse &&
        JSON.stringify(index.key) ===
          JSON.stringify({ tenant: 1, subProduct: 1 }),
    )
  )
    fail(
      'RECIPE_INDEX_REVIEW_REQUIRED',
      'Reviewed ingredient identity index required',
      503,
    );
  return runVenueOperation({
    ...args,
    actor: context.actor,
    operation: 'ingredient.create',
    key: args.idempotencyKey,
    payload: raw,
    targetType: 'IngredientProfile',
    execute: async ({ mongoSession }) => {
      const fresh = await loadVenueContext({
        ...args,
        action: 'experience.manage',
        mongoSession,
      });
      if (
        !(await require('../../models/SubProduct')
          .exists({ _id: raw.subProductId, tenant: args.tenantId })
          .session(mongoSession))
      )
        fail('NOT_FOUND', 'Owned ingredient not found', 404);
      if (
        await Profile.exists({
          tenant: args.tenantId,
          subProduct: raw.subProductId,
        }).session(mongoSession)
      )
        fail(
          'INGREDIENT_ALREADY_CONFIGURED',
          'This item already has an ingredient profile',
        );
      const [row] = await Profile.create(
        [
          {
            tenant: args.tenantId,
            subProduct: raw.subProductId,
            dimension: raw.dimension,
            gramsPerMl: raw.gramsPerMl,
            perishable: raw.perishable,
            allergenSource: raw.allergenSource,
            createdBy: fresh.actor.userId,
          },
        ],
        { session: mongoSession },
      );
      return { id: id(row), version: 0 };
    },
  });
}
module.exports = { listProfiles, sourceCandidates, createProfile };
