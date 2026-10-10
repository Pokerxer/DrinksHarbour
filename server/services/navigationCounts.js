'use strict';
const Product = require('../models/Product');
const { createNavigationCountsCache } = require('./navigationCountsCache');
const cache = createNavigationCountsCache();
async function navigationCounts(field) {
  return cache.read(field, async () => {
    const rows = await Product.aggregate([
      { $match: { status: 'approved', [field]: { $ne: null } } },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map(row => [String(row._id), row.count]));
  });
}
module.exports = { navigationCounts };
