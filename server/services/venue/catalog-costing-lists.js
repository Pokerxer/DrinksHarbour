'use strict';
const { loadVenueContext } = require('./context');
const { id } = require('./eligibility');
const { listPage, pageRows } = require('./catalog-list-page');
async function listServings(args) {
  await loadVenueContext({ ...args, action: 'servings.write' });
  const { limit, after } = listPage(args);
  const rows = await require('../../models/Size')
    .find({ tenant: args.tenantId, servingSchemaVersion: 2, ...after })
    .select('_id subproduct displayName venueServing sellingPrice costPrice weightGrams volumeMl servingsPerUnit')
    .sort({ _id: 1 }).limit(limit + 1).lean();
  const page = pageRows(rows, limit);
  return { ...page, items: page.items.map(row => ({
    id: id(row), subProductId: id(row.subproduct), displayName: row.displayName,
    ...row.venueServing, sellingPrice: row.sellingPrice, costPrice: row.costPrice,
    weightGrams: row.weightGrams, volumeMl: row.volumeMl, servingsPerUnit: row.servingsPerUnit,
  })) };
}
async function listProduction(args) {
  await loadVenueContext({ ...args, action: 'production.write' });
  const { limit, after } = listPage(args, -1);
  const rows = await require('../../models/VenueProductionBatch')
    .find({ tenant: args.tenantId, location: args.locationId, ...after })
    .select('_id version state output expectedOutput actualOutput sourceCostMinor outputCostMinor lossCostMinor outputBatchId')
    .sort({ _id: -1 }).limit(limit + 1).lean();
  const page = pageRows(rows, limit);
  return { ...page, items: page.items.map(row => ({ ...row, id: id(row), _id: undefined })) };
}
module.exports = { listServings, listProduction };
