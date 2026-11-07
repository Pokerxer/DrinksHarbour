'use strict';
const { isDeepStrictEqual } = require('node:util');
const { fail } = require('./errors');
const SERVING_MODEL_INDEXES = [
  {
    model: 'Size',
    collection: 'sizes',
    key: { subproduct: 1, size: 1, variantColorKey: 1 },
    unique: true,
    options: {
      name: 'size_retail_v1_color_unique',
      partialFilterExpression: { servingSchemaVersion: 1 },
    },
  },
  {
    model: 'Size',
    collection: 'sizes',
    key: { tenant: 1, subproduct: 1, 'venueServing.code': 1 },
    unique: true,
    options: {
      name: 'size_venue_v2_code_unique',
      partialFilterExpression: { servingSchemaVersion: 2 },
    },
  },
];
function exactIndex(index, definition) {
  return (
    JSON.stringify(index.key) === JSON.stringify(definition.key) &&
    index.unique === true &&
    !index.sparse &&
    !index.hidden &&
    index.expireAfterSeconds == null &&
    (!index.collation || index.collation.locale === 'simple') &&
    isDeepStrictEqual(
      index.partialFilterExpression,
      definition.options.partialFilterExpression,
    )
  );
}
async function previewServingIndexes(db) {
  const exists = await db.listCollections({ name: 'sizes' }).hasNext();
  const collection = db.collection('sizes');
  const indexes = exists ? await collection.listIndexes().toArray() : [];
  const missing = SERVING_MODEL_INDEXES.filter(
    (row) => !indexes.some((index) => exactIndex(index, row)),
  ).map((row) => row.options.name);
  const legacyNames = indexes
    .filter(
      (index) =>
        index.unique && JSON.stringify(index.key) ===
          JSON.stringify({ subproduct: 1, size: 1 }),
    )
    .map((index) => index.name);
  const unversioned = exists
    ? await collection.countDocuments({
        servingSchemaVersion: { $nin: [1, 2] },
      })
    : 0;
  return {
    ready:
      missing.length === 0 && legacyNames.length === 0 && unversioned === 0,
    missing,
    legacyNames,
    unversioned,
  };
}
async function assertServingIndexes(db) {
  const preview = await previewServingIndexes(db);
  if (!preview.ready)
    fail(
      'VENUE_SERVINGS_NOT_READY',
      'Serving indexes and reviewed version backfill are incomplete',
      503,
    );
  return preview;
}
module.exports = {
  SERVING_MODEL_INDEXES,
  exactIndex,
  previewServingIndexes,
  assertServingIndexes,
};
