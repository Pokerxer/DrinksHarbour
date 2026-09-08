'use strict';

// Literal substring matching supports typeahead and does not depend on a text
// index. Escaping keeps punctuation from becoming executable regex syntax.
function buildBrandSearch(search) {
  if (typeof search !== 'string' || !search.trim()) return {};
  const literal = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { $or: ['name', 'slug', 'legalName', 'tradingAs', 'description',
    'shortDescription', 'tagline', 'countryOfOrigin', 'region'].map(field => ({
    [field]: { $regex: literal, $options: 'i' },
  })) };
}
module.exports = { buildBrandSearch };
