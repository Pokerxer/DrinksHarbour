// server/services/featured.helpers.js

/**
 * Merge admin-flagged featured products with a bestseller fallback list.
 * Featured docs come first, fallback fills the remainder, de-duplicated by
 * _id (string-compared), capped at `limit`.
 *
 * @param {Array<{_id: any}>} featured
 * @param {Array<{_id: any}>} fallback
 * @param {number} limit
 * @returns {Array}
 */
function mergeFeaturedWithFallback(featured = [], fallback = [], limit = 12) {
  const out = [];
  const seen = new Set();
  for (const doc of [...featured, ...fallback]) {
    if (out.length >= limit) break;
    const key = doc && doc._id != null ? String(doc._id) : null;
    if (key === null || seen.has(key)) continue;
    seen.add(key);
    out.push(doc);
  }
  return out;
}

module.exports = { mergeFeaturedWithFallback };
