'use strict';
const Size = require('../../models/Size');
const SubProduct = require('../../models/SubProduct');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const { assertServingIndexes } = require('./serving-indexes');
const MODES = ['sealed', 'pour', 'made_to_order', 'prepared_batch'];
const SALE_UNITS = [
  'portion',
  'plate',
  'bowl',
  'tray',
  'piece',
  'bottle',
  'glass',
];
function servingInput(raw) {
  const allowed = [
    'code',
    'displayName',
    'mode',
    'saleUnit',
    'weightGrams',
    'volumeMl',
    'servingsPerUnit',
    'sellingPrice',
    'costPrice',
  ];
  if (
    !raw ||
    typeof raw !== 'object' ||
    Array.isArray(raw) ||
    Object.keys(raw).some((key) => !allowed.includes(key))
  )
    fail('INVALID_INPUT', 'Unknown serving fields', 400);
  if (
    typeof raw.code !== 'string' ||
    raw.code.length > 50 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.code)
  )
    fail(
      'INVALID_INPUT',
      'Serving code must be lowercase ASCII words separated by hyphens',
      400,
    );
  if (
    typeof raw.displayName !== 'string' ||
    !raw.displayName.trim() ||
    raw.displayName.trim().length > 100 ||
    !MODES.includes(raw.mode) ||
    !SALE_UNITS.includes(raw.saleUnit)
  )
    fail('INVALID_INPUT', 'Choose serving name, mode and sale unit', 400);
  const input = {
    code: raw.code,
    displayName: raw.displayName.trim(),
    mode: raw.mode,
    saleUnit: raw.saleUnit,
  };
  for (const field of [
    'weightGrams',
    'volumeMl',
    'servingsPerUnit',
    'sellingPrice',
    'costPrice',
  ]) {
    if (raw[field] === undefined) continue;
    if (field === 'costPrice' && raw[field] === null) {
      input.costPrice = null;
      continue;
    }
    const amount = raw[field];
    const scaled = amount * 100;
    if (
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      !Number.isSafeInteger(Math.round(scaled)) ||
      Math.abs(scaled - Math.round(scaled)) > 1e-8 ||
      (field !== 'costPrice' && amount === 0)
    )
      fail(
        'INVALID_INPUT',
        'Serving measurements and money require valid positive values with at most two decimals',
        400,
      );
    input[field] = amount;
  }
  if (input.mode === 'pour' && !input.volumeMl)
    fail('INVALID_INPUT', 'Pour volume is required', 400);
  return input;
}
async function ownedSubProduct({ tenantId, subProductId }, mongoSession) {
  const row = await SubProduct.findOne({ _id: subProductId, tenant: tenantId })
    .populate('product', 'type catalogKind')
    .session(mongoSession)
    .lean();
  if (!row) fail('NOT_FOUND', 'Serving item not found', 404);
  require('./pricing').assertVenueProduct(row.product);
  return row;
}
async function servingSnapshot({
  tenantId,
  subProductId,
  sizeId,
  mongoSession = null,
}) {
  requireId(tenantId);
  requireId(subProductId);
  requireId(sizeId);
  await ownedSubProduct({ tenantId, subProductId }, mongoSession);
  const row = await Size.findOne({
    _id: sizeId,
    tenant: tenantId,
    subproduct: subProductId,
  })
    .session(mongoSession)
    .lean();
  if (!row) fail('NOT_FOUND', 'Serving not found', 404);
  if ((row.servingSchemaVersion || 1) === 1) return null;
  const serving = row.venueServing;
  if (
    row.size !== 'venue_serving' ||
    !serving ||
    serving.channels?.length !== 1 ||
    serving.channels[0] !== 'venue'
  )
    fail('VENUE_SERVINGS_NOT_READY', 'Serving metadata requires review', 503);
  const snapshot = {
    sizeId: id(row),
    servingVersion: serving.version,
    code: serving.code,
    displayName: row.displayName,
    saleUnit: serving.saleUnit,
    mode: serving.mode,
  };
  for (const field of ['weightGrams', 'volumeMl', 'servingsPerUnit'])
    if (row[field] != null && row[field] > 0) snapshot[field] = row[field];
  return snapshot;
}
async function readyContext(args, mongoSession = null) {
  const context = await loadVenueContext({
    ...args,
    action: 'servings.write',
    mongoSession,
  });
  await ownedSubProduct(args, mongoSession);
  if (
    args.sizeId &&
    !(await Size.exists({
      _id: args.sizeId,
      tenant: args.tenantId,
      subproduct: args.subProductId,
    }).session(mongoSession))
  )
    fail('NOT_FOUND', 'Serving not found', 404);
  if (
    process.env.VENUE_SERVINGS_V2_ENABLED !== 'true' ||
    context.location.venueServices?.catalogCosting?.servingsV2Enabled !== true
  )
    fail(
      'VENUE_SERVINGS_DISABLED',
      'Serving authoring is not enabled at this location',
      403,
    );
  await assertServingIndexes(Size.db.db);
  return context;
}
async function saveServing(args) {
  requireId(args.subProductId);
  if (args.sizeId !== undefined) requireId(args.sizeId);
  if (!Number.isSafeInteger(args.expectedVersion) || args.expectedVersion < 0)
    fail('STATE_CHANGED', 'Serving version required');
  const input = servingInput(args.input);
  const context = await readyContext(args);
  return runVenueOperation({
    tenantId: args.tenantId,
    locationId: args.locationId,
    actor: context.actor,
    operation: 'serving.save',
    key: args.idempotencyKey,
    targetType: 'Size',
    payload: {
      subProductId: args.subProductId,
      sizeId: args.sizeId,
      expectedVersion: args.expectedVersion,
      input,
    },
    execute: async ({ mongoSession }) => {
      await readyContext(args, mongoSession);
      await ownedSubProduct(args, mongoSession);
      let row = args.sizeId
        ? await Size.findOne({
            _id: args.sizeId,
            tenant: args.tenantId,
            subproduct: args.subProductId,
          }).session(mongoSession)
        : null;
      if (args.sizeId && !row) fail('NOT_FOUND', 'Serving not found', 404);
      if (row && row.servingSchemaVersion !== 2)
        fail(
          'SERVING_MIGRATION_REQUIRED',
          'Legacy sizes require reviewed migration',
        );
      if ((row?.venueServing?.version || 0) !== args.expectedVersion)
        fail('STATE_CHANGED', 'Serving changed; refresh');
      if (row && row.venueServing.code !== input.code)
        fail('SERVING_CODE_IMMUTABLE', 'Serving code cannot change');
      if (
        await Size.exists({
          tenant: args.tenantId,
          subproduct: args.subProductId,
          servingSchemaVersion: 2,
          'venueServing.code': input.code,
          ...(row ? { _id: { $ne: row._id } } : {}),
        }).session(mongoSession)
      )
        fail('SERVING_CODE_CONFLICT', 'Serving code is already used');
      if (!row)
        row = new Size({
          tenant: args.tenantId,
          subproduct: args.subProductId,
          size: 'venue_serving',
          servingSchemaVersion: 2,
          unitType: 'serving',
          servingsPerUnit: undefined,
          costPrice: null,
        });
      row.displayName = input.displayName;
      row.venueServing = {
        code: input.code,
        mode: input.mode,
        saleUnit: input.saleUnit,
        channels: ['venue'],
        version: args.expectedVersion + 1,
      };
      for (const field of ['weightGrams', 'volumeMl', 'servingsPerUnit'])
        row[field] = input[field];
      for (const field of ['sellingPrice', 'costPrice'])
        if (input[field] !== undefined) row[field] = input[field];
      await row.save({ session: mongoSession });
      await SubProduct.updateOne(
        { _id: args.subProductId, tenant: args.tenantId },
        { $addToSet: { sizes: row._id } },
        { session: mongoSession },
      );
      return { id: id(row), version: row.venueServing.version };
    },
  });
}
module.exports = { servingInput, saveServing, servingSnapshot };
