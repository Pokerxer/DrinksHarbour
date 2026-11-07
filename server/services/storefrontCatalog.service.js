'use strict';
const { Types } = require('mongoose');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { objectId, pagination, publicProduct, id } = require('./storefrontPricing');
const { escapeRegex: escape } = require('../utils/escapeRegex');
const { createSingleFlight } = require('../utils/singleFlight');
const readOnce = createSingleFlight();
const { catalogRows } = require('./storefrontMetadata.service');
const { retailSizeWhereClause } = require('../constants/sizeChannels');
const SIZE_FIELDS = '_id tenant subproduct size volumeMl unitsPerPack sellingPrice costPrice availableStock availability maxOrderQuantity discountType discountValue discountStart discountEnd';
function catalogPipeline(tenant, query = {}, ids) {
  const match = { tenant: new Types.ObjectId(id(tenant)), isPublished: true, status: 'active', visibleInOnlineStore: { $ne: false } };
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
  const products = await SubProduct.aggregate([...await require('./marketCommitment').directOfferStages(tenant), ...catalogPipeline(tenant, {}, ids)]).session(session).exec();
  await projectLocation(tenant, products, [], session);
  return products;
}
// Legacy imports used in_stock; catalogue reads retain sold-out prices while cart reads exclude them.
async function loadSizes(tenant, products, session = null, { includeOutOfStock = false } = {}) {
  const sizes = await Size.find({ ...retailSizeWhereClause(), tenant: tenant._id, subproduct: { $in: products.map(p => p._id) }, status: 'active',
    availability: { $in: ['available', 'low_stock', 'limited_stock', 'in_stock', ...(includeOutOfStock || tenant.storefrontChannel ? ['out_of_stock'] : [])] } })
    .select(SIZE_FIELDS).session(session).lean();
  await projectLocation(tenant, products, sizes, session);
  return sizes;
}
async function projectLocation(tenant, products, sizes, session) {
  if (!tenant.storefrontChannel) return;
  const rows = await require('./storefrontLocationStock').availability(tenant, products, session);
  for (const product of products) {
    product.availableStock = rows.filter(r => id(r.subProduct) === id(product)).reduce((sum, r) => sum + r.available, 0);
    // Physical stock is always variant-scoped, including internal default sizes.
    product.sellWithoutSizeVariants = false;
  }
  for (const size of sizes) {
    size.availableStock = rows.find(r => id(r.subProduct) === id(size.subproduct) && id(r.size) === id(size))?.available || 0;
    size.availability = size.availableStock > 0 ? 'available' : 'out_of_stock';
  }
}
async function listProducts(tenant, query = {}) {
  const { page, limit, skip } = pagination(query);
  // Validate before sharing so malformed input cannot piggyback a valid read.
  const pipeline = [...await require('./marketCommitment').directOfferStages(tenant), ...catalogPipeline(tenant, query)];
  const key = JSON.stringify(['list', id(tenant), id(tenant.storefrontChannel?.warehouse), page, limit, query.q?.trim() || '', query.type || '', query.category?.toLowerCase() || '', pipeline]);
  return readOnce(key, async () => {
    const [result] = await catalogRows(tenant, [...pipeline,
      { $sort: { 'product.name': 1, _id: 1 } },
      { $facet: { rows: [{ $skip: skip }, { $limit: limit }], count: [{ $count: 'total' }] } }], { facet: true });
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
  const marketStages = await require('./marketCommitment').directOfferStages(tenant);
  return readOnce(JSON.stringify(['detail', id(tenant), id(tenant.storefrontChannel?.warehouse), value.toLowerCase(), marketStages]), async () => {
    const [sp] = await catalogRows(tenant, [...marketStages, ...catalogPipeline(tenant, {}, [value])]);
    if (!sp) throw new NotFoundError('Product not found');
    return publicProduct(sp, await loadSizes(tenant, [sp], null, { includeOutOfStock: true }));
  });
}
function publicStore(tenant) {
  return { id: id(tenant), name: tenant.name, slug: tenant.slug,
    logo: tenant.logo?.url ? { url: tenant.logo.url, alt: tenant.logo.alt || '' } : null,
    primaryColor: tenant.primaryColor, currency: 'NGN', paymentProvider: 'paystack',
    shippingMethods: ['standard', 'pickup'], ageVerificationRequired: true,
    ...(tenant.storefrontChannel ? { salesChannel: tenant.storefrontChannel.code, stockLocationId: id(tenant.storefrontChannel.warehouse) } : {}) };
}
module.exports = { catalogPipeline, loadProducts, loadSizes, listProducts, getProduct, publicStore };
