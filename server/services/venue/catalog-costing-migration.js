'use strict';
const { ObjectId } = require('mongoose').Types;
const { fail } = require('./errors');
const { fingerprint } = require('./operations');
const {
  validateMapping,
  requireCatalogCostingUri,
} = require('./catalog-costing-mapping');
const {
  SERVING_MODEL_INDEXES,
  exactIndex,
  previewServingIndexes,
} = require('./serving-indexes');
const sameKey = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function target(args) {
  const mapping = validateMapping(args.mapping);
  const uri = requireCatalogCostingUri({
    VENUE_CATALOG_COSTING_MONGO_URI: args.targetUri,
  });
  let database;
  try {
    database = decodeURIComponent(new URL(uri).pathname.slice(1));
  } catch {
    fail('CATALOG_COSTING_TARGET_REQUIRED', 'Invalid explicit target', 400);
  }
  if (
    database !== mapping.expectedDatabase ||
    args.db.databaseName !== database
  )
    fail(
      'CATALOG_COSTING_TARGET_MISMATCH',
      'Connected database differs from reviewed target',
      400,
    );
  const location = await args.db.collection('warehouses').findOne({
    _id: new ObjectId(mapping.locationId),
    tenant: new ObjectId(mapping.tenantId),
  });
  if (!location) fail('NOT_FOUND', 'Reviewed location not found', 404);
  return mapping;
}
async function listIndexes(db, name) {
  const exists = await db.listCollections({ name }).hasNext();
  return exists ? db.collection(name).indexes() : [];
}
async function previewCatalogCosting(args) {
  const mapping = await target(args);
  const db = args.db;
  const sizes = await db
    .collection('sizes')
    .find({})
    .sort({ _id: 1 })
    .toArray();
  const subs = await db
    .collection('subproducts')
    .find({})
    .project({ _id: 1, tenant: 1 })
    .toArray();
  const indexes = await listIndexes(db, 'sizes');
  const blockers = [];
  const legacy = sizes.filter((row) => row.servingSchemaVersion == null);
  const unreviewed = legacy.filter(
    (row) =>
      !mapping.reviewedLegacySizeIds.includes(String(row._id)) ||
      !mapping.reviewedTenantIds.includes(String(row.tenant)),
  );
  if (unreviewed.length) blockers.push('UNREVIEWED_LEGACY_SIZE');
  if (
    sizes.some(
      (row) =>
        !subs.some(
          (sub) =>
            String(sub._id) === String(row.subproduct) &&
            String(sub.tenant) === String(row.tenant),
        ),
    )
  )
    blockers.push('ORPHAN_SIZE');
  if (
    sizes.some(
      (row) =>
        row.servingSchemaVersion != null &&
        ![1, 2].includes(row.servingSchemaVersion),
    )
  )
    blockers.push('UNSUPPORTED_SERVING_VERSION');
  const seen = new Set();
  for (const row of sizes) {
    const version = row.servingSchemaVersion || 1;
    const key =
      version === 1
        ? `v1:${row.subproduct}:${row.size}`
        : `v2:${row.tenant}:${row.subproduct}:${row.venueServing?.code}`;
    if (seen.has(key))
      blockers.push(
        version === 1 ? 'DUPLICATE_LEGACY_SIZE' : 'DUPLICATE_VENUE_CODE',
      );
    seen.add(key);
  }
  const old = indexes.find((index) => index.name === mapping.legacyIndexName);
  if (
    old &&
    (!old.unique ||
      old.sparse ||
      old.partialFilterExpression ||
      !sameKey(old.key, { subproduct: 1, size: 1 }))
  )
    blockers.push('LEGACY_INDEX_NOT_EXACT');
  for (const definition of SERVING_MODEL_INDEXES)
    if (
      indexes.some(
        (index) =>
          index.name === definition.options.name &&
          !exactIndex(index, definition),
      )
    )
      blockers.push('REPLACEMENT_INDEX_CONFLICT');
  const readiness = await previewServingIndexes(db);
  if (!old && !readiness.ready) blockers.push('LEGACY_GUARD_MISSING');
  const menus = await db
    .collection('venuelocationprofiles')
    .find({
      tenant: new ObjectId(mapping.tenantId),
      location: new ObjectId(mapping.locationId),
    })
    .toArray();
  for (const profile of menus)
    for (const section of profile.menu?.sections || [])
      for (const item of section.items || []) {
        if (
          !sizes.some(
            (size) =>
              String(size._id) === String(item.sizeId) &&
              String(size.tenant) === mapping.tenantId &&
              String(size.subproduct) === String(item.subProductId),
          )
        )
          blockers.push('ORPHAN_MENU_REFERENCE');
        if (profile.menu.schemaVersion !== 2 && item.category)
          blockers.push('AMBIGUOUS_MENU_CATEGORY');
      }
  const costIndexes =
    await require('./costing-indexes').previewCostingIndexes(db);
  if (costIndexes.some((row) => row.conflict || row.duplicates))
    blockers.push('COST_INDEX_CONFLICT');
  const normalizedSizes = sizes.map((row) => ({
    ...row,
    servingSchemaVersion: row.servingSchemaVersion ?? 1,
  }));
  const otherIndexes = indexes.filter(
    (index) =>
      index.name !== mapping.legacyIndexName &&
      !SERVING_MODEL_INDEXES.some((def) => exactIndex(index, def)),
  );
  const previewHash = fingerprint({
    mapping,
    sizes: normalizedSizes,
    subs,
    otherIndexes,
    menus,
    costIndexConflicts: costIndexes.map((row) => ({
      collection: row.collection,
      otherIndexes: row.otherIndexes,
      duplicates: row.duplicates,
      conflict: row.conflict,
    })),
  });
  return {
    safe: blockers.length === 0,
    blockers: [...new Set(blockers)],
    previewHash,
    target: {
      database: db.databaseName,
      tenantId: mapping.tenantId,
      locationId: mapping.locationId,
    },
    impact: {
      legacySizeIds: legacy.map((row) => String(row._id)),
      unreviewedSizeIds: unreviewed.map((row) => String(row._id)),
      totalSizes: sizes.length,
    },
    readiness,
    costIndexesReady: costIndexes.every((row) => row.ready),
  };
}
async function applyCatalogCosting(args) {
  const mapping = await target(args);
  if (
    args.mappingReviewed !== true ||
    args.indexChangeReviewed !== true ||
    args.writersPaused !== true
  )
    fail(
      'CATALOG_COSTING_REVIEW_REQUIRED',
      'Reviewed mapping, exact DDL and paused writers required',
      409,
    );
  const reviewer = await args.db.collection('users').findOne({
    _id: new ObjectId(mapping.reviewedBy),
    role: 'super_admin',
    status: 'active',
  });
  if (!reviewer)
    fail(
      'CATALOG_COSTING_REVIEW_REQUIRED',
      'Current super-admin review required',
      403,
    );
  const preview = await previewCatalogCosting(args);
  if (!preview.safe)
    fail(
      'CATALOG_COSTING_REVIEW_REQUIRED',
      'Resolve preview blockers before apply',
    );
  if (args.expectedHash !== preview.previewHash)
    fail('CATALOG_COSTING_PREVIEW_CHANGED', 'Reviewed preview inputs changed');
  if (preview.readiness.ready && preview.costIndexesReady)
    return { applied: true, replay: true, previewHash: preview.previewHash };
  await args.db.collection('sizes').updateMany(
    {
      _id: {
        $in: mapping.reviewedLegacySizeIds.map((value) => new ObjectId(value)),
      },
      tenant: {
        $in: mapping.reviewedTenantIds.map((value) => new ObjectId(value)),
      },
      // Mongo equality with null also includes missing legacy versions.
      servingSchemaVersion: null,
    },
    { $set: { servingSchemaVersion: 1 } },
  );
  await args.afterStage?.('backfilled');
  for (const [index, definition] of SERVING_MODEL_INDEXES.entries()) {
    await args.db
      .collection('sizes')
      .createIndex(definition.key, { unique: true, ...definition.options });
    await args.afterStage?.(
      index === 0 ? 'legacy_guard_installed' : 'venue_guard_installed',
    );
  }
  const fresh = await previewCatalogCosting(args);
  if (!fresh.safe || fresh.previewHash !== args.expectedHash)
    fail(
      'CATALOG_COSTING_PREVIEW_CHANGED',
      'Inputs changed during index preparation',
    );
  const installed = await args.db.collection('sizes').indexes();
  if (
    !SERVING_MODEL_INDEXES.every((def) =>
      installed.some((index) => exactIndex(index, def)),
    )
  )
    fail('CATALOG_COSTING_REVIEW_REQUIRED', 'Replacement guards incomplete');
  if (installed.some((index) => index.name === mapping.legacyIndexName))
    await args.db.collection('sizes').dropIndex(mapping.legacyIndexName);
  await require('./costing-indexes').prepareCostingIndexes(args.db);
  const result = await previewServingIndexes(args.db);
  if (!result.ready)
    fail('CATALOG_COSTING_REVIEW_REQUIRED', 'Readiness remains incomplete');
  return { applied: true, replay: false, previewHash: args.expectedHash };
}
async function pauseCatalogCosting(args) {
  const mapping = await target(args);
  if (args.mappingReviewed !== true) fail('CATALOG_COSTING_REVIEW_REQUIRED');
  const reviewer = await args.db.collection('users').findOne({
    _id: new ObjectId(mapping.reviewedBy),
    role: 'super_admin',
    status: 'active',
  });
  if (!reviewer) fail('CATALOG_COSTING_REVIEW_REQUIRED');
  await args.db.collection('warehouses').updateOne(
    {
      _id: new ObjectId(mapping.locationId),
      tenant: new ObjectId(mapping.tenantId),
    },
    {
      $set: {
        'venueServices.catalogCosting.servingsV2Enabled': false,
        'venueServices.catalogCosting.actualCostingEnabled': false,
      },
    },
  );
  return { paused: true };
}
module.exports = {
  previewCatalogCosting,
  applyCatalogCosting,
  pauseCatalogCosting,
};
