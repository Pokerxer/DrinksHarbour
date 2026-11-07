'use strict';
const DEFINITIONS = [
  {
    collection: 'ingredientprofiles',
    key: { tenant: 1, subProduct: 1 },
    name: 'tenant_1_subProduct_1',
  },
  {
    collection: 'recipeversions',
    key: { tenant: 1, 'output.subProduct': 1, 'output.size': 1, version: 1 },
    name: 'tenant_1_output.subProduct_1_output.size_1_version_1',
  },
  {
    collection: 'venueconsumptionevents',
    key: { tenant: 1, effectKey: 1 },
    name: 'tenant_1_effectKey_1',
  },
  {
    collection: 'venuecostsnapshots',
    key: { tenant: 1, effectKey: 1 },
    name: 'tenant_1_effectKey_1',
  },
  {
    collection: 'venueproductionbatches',
    key: { tenant: 1, productionKey: 1 },
    name: 'tenant_1_productionKey_1',
  },
  {
    collection: 'venueinventorycounts',
    key: { tenant: 1, location: 1, countKey: 1 },
    name: 'tenant_1_location_1_countKey_1',
  },
];
const exact = (index, definition) =>
  index.unique === true &&
  !index.sparse &&
  !index.hidden &&
  !index.partialFilterExpression &&
  JSON.stringify(index.key) === JSON.stringify(definition.key);
async function previewCostingIndexes(db) {
  const rows = [];
  for (const definition of DEFINITIONS) {
    const exists = await db
      .listCollections({ name: definition.collection })
      .hasNext();
    const indexes = exists
      ? await db.collection(definition.collection).indexes()
      : [];
    let duplicates = [];
    if (exists)
      duplicates = await db
        .collection(definition.collection)
        .aggregate([
          {
            $group: {
              _id: Object.fromEntries(
                Object.keys(definition.key).map((key, index) => [
                  `field${index}`,
                  `$${key}`,
                ]),
              ),
              count: { $sum: 1 },
            },
          },
          { $match: { count: { $gt: 1 } } },
          { $limit: 1 },
        ])
        .toArray();
    rows.push({
      ...definition,
      ready: indexes.some((index) => exact(index, definition)),
      conflict: indexes.some(
        (index) => index.name === definition.name && !exact(index, definition),
      ),
      duplicates: duplicates.length > 0,
      otherIndexes: indexes.filter(
        (index) => index.name !== '_id_' && !exact(index, definition),
      ),
    });
  }
  return rows;
}
async function prepareCostingIndexes(db) {
  for (const row of await previewCostingIndexes(db))
    if (!row.ready)
      await db
        .collection(row.collection)
        .createIndex(row.key, { unique: true, name: row.name });
}
async function assertCostingIndexes(db) {
  for (const definition of DEFINITIONS) {
    const exists = await db
      .listCollections({ name: definition.collection })
      .hasNext();
    if (
      !exists ||
      !(await db.collection(definition.collection).indexes()).some((index) =>
        exact(index, definition),
      )
    )
      require('./errors').fail(
        'COST_INDEX_REVIEW_REQUIRED',
        'Reviewed physical effect and costing uniqueness guards required',
        503,
      );
  }
}
module.exports = {
  DEFINITIONS,
  previewCostingIndexes,
  prepareCostingIndexes,
  assertCostingIndexes,
};
