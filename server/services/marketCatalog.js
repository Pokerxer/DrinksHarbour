'use strict';
const mongoose = require('mongoose');
const context = require('./marketContext');
const registry = require('../config/marketCategories');
const { categoryFor } = require('./marketIngress');
const active = () => context.enabled() && context.publicScope();
// Supply categories derive from the registry (fallback included) so a newly
// registered vertical needs no edit here — listingFilter/offerStages stay
// consistent with config/marketCategories.js (review 2026-11-02 finding 8).
const SUPPLY_CATEGORIES = () => [...registry.categories];
async function eligibleGroups({ market = context.currentMarket(), channel = 'marketplace' } = {}) {
  const policy = require('./marketPolicy');
  const rows = await Promise.all(SUPPLY_CATEGORIES().map(async category => [category,
    (await policy.getEligibleTenantIds({ market, channel, category })).map(id => new mongoose.Types.ObjectId(String(id))) ]));
  return Object.fromEntries(rows);
}
function offerStages(groups) {
  const type = '$_marketProduct.type';
  const category = { $switch: { branches: Object.entries(registry.typesByCategory)
    .map(([label, types]) => ({ case: { $in: [type, types] }, then: label })),
    default: registry.FALLBACK_CATEGORY } };
  return [
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: '_marketProduct' } },
    { $unwind: '$_marketProduct' },
    // Tenant-private identities never appear in marketplace offer assembly,
    // regardless of eligibility/enrollment outcomes (see constants/catalogScope.js).
    { $match: { '_marketProduct.publicationScope': { $ne: 'tenant_private' } } },
    { $match: { $expr: { $or: Object.entries(groups).map(([key, ids]) => ({ $and: [
      { $eq: [category, key] }, { $in: ['$tenant', ids] },
    ] })) } } },
    { $unset: '_marketProduct' },
  ];
}
function constrainLookups(stages, groups) {
  return stages.map(stage => {
    if (stage.$lookup?.from === 'subproducts') {
      return { $lookup: { ...stage.$lookup, pipeline: [...offerStages(groups), ...(stage.$lookup.pipeline || [])] } };
    }
    if (stage.$facet) return { $facet: Object.fromEntries(Object.entries(stage.$facet).map(([key, value]) => [key, constrainLookups(value, groups)])) };
    return stage;
  });
}
function productPipeline(pipeline, groups) {
  // Eligibility precedes count/limit/facet, so an ineligible offer cannot occupy a page.
  const prefix = [{ $lookup: { from: 'subproducts', localField: '_id', foreignField: 'product', as: '_marketOffers', pipeline: [
    { $match: { isPublished: true, status: { $in: ['active', 'low_stock', 'out_of_stock'] }, visibleInOnlineStore: { $ne: false } } },
    ...offerStages(groups), { $limit: 1 }, { $project: { _id: 1 } },
  ] } }, { $match: { '_marketOffers.0': { $exists: true } } }, { $unset: '_marketOffers' }];
  const result = constrainLookups(pipeline, groups);
  if (['$geoNear', '$search', '$vectorSearch'].some(key => result[0]?.[key])) return [result[0], ...prefix, ...result.slice(1)];
  return [...prefix, ...result];
}
async function productAggregate(pipeline) {
  return require('../models/Product').aggregate(active() ? productPipeline(pipeline, await eligibleGroups()) : pipeline);
}
async function subproductAggregate(pipeline) {
  return require('../models/SubProduct').aggregate(active() ? [...offerStages(await eligibleGroups()), ...pipeline] : pipeline);
}
async function listingFilter(product) {
  if (!active()) return {};
  const groups = await eligibleGroups();
  return { $and: [{ tenant: { $in: groups[categoryFor(product)] } }] };
}
async function productCount(query) {
  if (!active()) return require('../models/Product').countDocuments(query);
  const rows = await productAggregate([{ $match: query }, { $count: 'total' }]);
  return rows[0]?.total || 0;
}
async function productFilter() {
  if (!active()) return {};
  const rows = await require('../models/SubProduct').aggregate([
    { $match: { isPublished: true, status: { $in: ['active', 'low_stock', 'out_of_stock'] }, visibleInOnlineStore: { $ne: false } } },
    ...offerStages(await eligibleGroups()), { $group: { _id: '$product' } }, { $limit: 20001 },
  ]);
  if (rows.length > 20000) throw new (require('../utils/errors').ValidationError)('Market catalogue query requires a narrower scope');
  return { $and: [{ _id: { $in: rows.map(row => row._id) } }] };
}
async function query(value) { return active() ? { $and: [value, await productFilter()] } : value; }
module.exports = { productCount, productFilter, query, active, eligibleGroups, offerStages, productPipeline, productAggregate, subproductAggregate, listingFilter };
