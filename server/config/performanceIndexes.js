'use strict';
// Additive, non-unique read indexes. Never drop existing indexes or build on
// request paths. This file is the source of truth for the explicit rollout.
const PERFORMANCE_INDEXES = {
  subproducts: [
    { key: { tenant: 1, isPublished: 1, status: 1, product: 1 }, name: 'tenant_public_catalog' },
    { key: { product: 1, isPublished: 1, status: 1, tenant: 1 }, name: 'product_public_offers' },
  ],
  sizes: [
    { key: { tenant: 1, subproduct: 1, status: 1, availability: 1 }, name: 'tenant_catalog_sizes' },
  ],
};
async function ensurePerformanceIndexes(connection) {
  for (const [collection, indexes] of Object.entries(PERFORMANCE_INDEXES)) {
    for (const { key, name } of indexes) {
      await connection.collection(collection).createIndex(key, { name });
    }
  }
}
module.exports = { PERFORMANCE_INDEXES, ensurePerformanceIndexes };
