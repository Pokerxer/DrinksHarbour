'use strict';
const { Types } = require('mongoose');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { objectId, pagination, publicProduct, id } = require('./storefrontPricing');
const { escapeRegex: escape } = require('../utils/escapeRegex');
const { createSingleFlight } = require('../utils/singleFlight');
const readOnce = createSingleFlight();
const SIZE_FIELDS = '_id tenant subproduct size volumeMl unitsPerPack sellingPrice costPrice availableStock availability maxOrderQuantity discountType discountValue discountStart discountEnd';
function catalogPipeline(tenant, query = {}, ids) {
  const match = { tenant: new Types.ObjectId(id(tenant)), isPublished: true, status: 'active' };
  if (ids) match._id = { $in: ids.map(value => new Types.ObjectId(value)) };
  const pipeline = [{ $match: match },
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $match: { $or: [
      { 'product.status': 'approved', 'product.isPublished': true },
      // Tenant submissions are immediately sellable in their own store only.
      { 'product.status': 'pending', 'product.submittingTenant': new Types.ObjectId(id(tenant)) },
    ] } }];
  for (const field of ['q', 'category', 'type']) {
    if (query[field] != null && (typeof query[field] !== 'string' || query[field].length > 100)) throw new ValidationError(`Invalid ${field}`);
  }
  if (query.q?.trim()) pipeline.push({ $match: { 'product.name': { $regex: escape(query.q.trim()), $options: 'i' } } });
  if (query.type) pipeline.push({ $match: { 'product.type': query.type } });
  if (query.category) {
    if (!objectId(query.category)) throw new ValidationError('Invalid category');
    pipeline.push({ $match: { 'product.category': new Types.ObjectId(query.category) } });
  }
  return pipeline;
}
async function loadProducts(tenant, ids, session = null) {
  return SubProduct.aggregate(catalogPipeline(tenant, {}, ids)).session(session).exec();
}
// Legacy imports used in_stock; catalogue reads retain sold-out prices while cart reads exclude them.
async function loadSizes(tenant, products, session = null, { includeOutOfStock = false } = {}) {
  return Size.find({ tenant: tenant._id, subproduct: { $in: products.map(p => p._id) }, status: 'active',
    availability: { $in: ['available', 'low_stock', 'limited_stock', 'in_stock', ...(includeOutOfStock ? ['out_of_stock'] : [])] } })
    .select(SIZE_FIELDS).session(session).lean();
}
async function listProducts(tenant, query = {}) {
  const { page, limit, skip } = pagination(query);
  // Validate before sharing so malformed input cannot piggyback a valid read.
  const pipeline = catalogPipeline(tenant, query);
  const key = JSON.stringify(['list', id(tenant), page, limit, query.q?.trim() || '', query.type || '', query.category?.toLowerCase() || '']);
  return readOnce(key, async () => {
    const [result] = await SubProduct.aggregate([...pipeline,
      { $sort: { 'product.name': 1, _id: 1 } },
      { $facet: { rows: [{ $skip: skip }, { $limit: limit }], count: [{ $count: 'total' }] } }]);
    const sizes = result.rows.length
      ? await loadSizes(tenant, result.rows, null, { includeOutOfStock: true }) : [];
    const byProduct = new Map();
    for (const size of sizes) {
      const productId = id(size.subproduct);
      if (!byProduct.has(productId)) byProduct.set(productId, []);
      byProduct.get(productId).push(size);
    }
    const total = result.count[0]?.total || 0;
    return { data: result.rows.map(sp => publicProduct(sp, byProduct.get(id(sp)) || [])),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  });
}
async function getProduct(tenant, value) {
  if (!objectId(value)) throw new ValidationError('Invalid product ID');
  return readOnce(JSON.stringify(['detail', id(tenant), value.toLowerCase()]), async () => {
    const [sp] = await loadProducts(tenant, [value]);
    if (!sp) throw new NotFoundError('Product not found');
    return publicProduct(sp, await loadSizes(tenant, [sp], null, { includeOutOfStock: true }));
  });
}
function publicStore(tenant) {
  return { id: id(tenant), name: tenant.name, slug: tenant.slug,
    logo: tenant.logo?.url ? { url: tenant.logo.url, alt: tenant.logo.alt || '' } : null,
    primaryColor: tenant.primaryColor, currency: 'NGN', paymentProvider: 'paystack',
    shippingMethods: ['standard', 'pickup'], ageVerificationRequired: true };
}
module.exports = { catalogPipeline, loadProducts, loadSizes, listProducts, getProduct, publicStore };
