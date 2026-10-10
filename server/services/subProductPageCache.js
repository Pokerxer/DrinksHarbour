'use strict';
const { createAdminReportCache } = require('./adminReportCache');
const { enabled } = require('../config/redis');
const MODELS = { brand: 'Brand', category: 'Category', subCategory: 'SubCategory', tags: 'Tag', flavors: 'Flavor' };
const id = value => value == null ? null : String(value._id ?? value);
const wrap = data => ({ status: 200, body: { success: true, data } });
function createSubProductPageCache({
  cache = createAdminReportCache({ isEnabled: () => enabled() && process.env.REDIS_SUBPRODUCT_PAGE_CACHE !== 'false' }),
  SubProduct = require('../models/SubProduct'),
  modelFor = name => require(`../models/${name}`),
} = {}) {
  async function statistics(tenantId, { fresh = false } = {}) {
    const scope = tenantId ? `tenant:${id(tenantId)}` : 'platform';
    const base = tenantId ? { tenant: tenantId } : {};
    const result = await cache.read({ scope, resource: 'subproduct-stats-v1' }, async () => {
      const [active, lowStock, outOfStock] = await Promise.all([
        SubProduct.countDocuments({ ...base, status: 'active' }),
        SubProduct.countDocuments({ ...base, status: 'active', 'sizes.stock': { $lte: 10 } }),
        SubProduct.countDocuments({ ...base, status: 'out_of_stock' }),
      ]);
      return wrap({ active, lowStock, outOfStock });
    }, { fresh });
    return result.body.data;
  }
  async function populateReferences(products, specs, { fresh = false } = {}) {
    await Promise.all(specs.map(async spec => {
      if (!MODELS[spec.path]) throw new Error('Unsupported cached catalog reference');
      const ids = [...new Set(products.flatMap(product => {
        const value = product?.[spec.path];
        return (Array.isArray(value) ? value : [value]).map(id).filter(Boolean);
      }))].sort();
      if (!ids.length) return;
      const result = await cache.read({ scope: 'platform', resource: 'subproduct-reference-v1',
        query: { path: spec.path, select: spec.select, ids } }, async () =>
        wrap(await modelFor(MODELS[spec.path]).find({ _id: { $in: ids } }).select(spec.select).lean()), { fresh });
      const rows = new Map(result.body.data.map(row => [id(row), row]));
      for (const product of products) {
        if (!product || !Object.hasOwn(product, spec.path)) continue;
        const value = product[spec.path];
        product[spec.path] = Array.isArray(value)
          ? value.map(ref => rows.get(id(ref))).filter(Boolean) : rows.get(id(value)) ?? null;
      }
    }));
    return products;
  }
  return { statistics, populateReferences, invalidate: cache.invalidate, isEnabled: cache.isEnabled };
}
const subProductPageCache = createSubProductPageCache();
module.exports = { createSubProductPageCache, subProductPageCache };
