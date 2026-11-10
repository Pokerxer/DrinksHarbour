'use strict';
const Product = require('../models/Product');
const { marketplaceWhereClause } = require('../constants/catalogKind');
const { createNavigationCountsCache } = require('./navigationCountsCache');
const cache = createNavigationCountsCache();
// Approximate public navigation counts only. Never cache operational documents.
//
// Two flavors (2026-11-10): `navigationCounts(field)` is the legacy all-product
// tally for tenant-storefront callers — retail chips there are truthful (DRI-4
// tenant stores sell retail stock). `marketplaceOnly: true` applies the DRI-5
// beverage-only clause for main-marketplace navigation and the public sitemap
// the same controllers feed, so retail-kind-only categories/subcategories
// (beauty-grooming, home-living, glassware — created for tenant gift shops)
// no longer leak marketplace URLs with counts their grids cannot back up.
async function navigationCounts(field, { marketplaceOnly = false } = {}) {
  return cache.read(field, async () => {
    const match = { status: 'approved', [field]: { $ne: null } };
    if (marketplaceOnly) Object.assign(match, marketplaceWhereClause());
    const rows = await Product.aggregate([
      { $match: match },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map(row => [String(row._id), row.count]));
  }, marketplaceOnly ? '-marketplace' : '');
}
module.exports = { navigationCounts };
