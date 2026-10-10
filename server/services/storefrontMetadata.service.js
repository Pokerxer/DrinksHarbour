'use strict';
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const { metadataEnabled } = require('../config/redis');
const { createMetadataCache } = require('./publicMetadataCache');
const cache = createMetadataCache();
const LIVE_FIELDS = ['_id', 'updatedAt', 'name', 'slug', 'category', 'type', 'status', 'isPublished',
  'submittingTenant', 'isAlcoholic', 'abv', 'volumeMl', 'originCountry', 'shelfLife', 'barcode'];
const PUBLIC_FIELDS = [...LIVE_FIELDS, 'description', 'shortDescription', 'images', 'flavorProfile'].join(' ');
async function catalogRows(tenant, pipeline, { facet = false } = {}) {
  if (!metadataEnabled()) return SubProduct.aggregate(pipeline);
  // Keep MongoDB's equality lookup optimization; trim heavy fields before the facet.
  const trim = { $unset: ['product.description', 'product.shortDescription', 'product.images', 'product.flavorProfile'] };
  const projected = [];
  for (const stage of pipeline) { if (stage.$facet) projected.push(trim); projected.push(stage); }
  if (!facet) projected.push(trim);
  const result = await SubProduct.aggregate(projected);
  const rows = facet ? result[0].rows : result;
  const unique = [...new Map(rows.map(row => [String(row.product._id), row.product])).values()];
  const metadata = await cache.read(tenant._id, 'product', unique, refs => Product.find({
    _id: { $in: refs.map(row => row._id) },
  }).select(PUBLIC_FIELDS).lean());
  // Concurrent edits/deletions invalidate the probe; repeat the authoritative query.
  if (!metadata) return SubProduct.aggregate(pipeline);
  const byId = new Map(metadata.map(row => [String(row._id), row]));
  for (const row of rows) row.product = { ...byId.get(String(row.product._id)), ...row.product };
  return result;
}
module.exports = { catalogRows };
