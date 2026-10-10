'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Size = require('../models/Size');
const catalog = require('../services/storefrontCatalog.service');
const { publicProduct } = require('../services/storefrontPricing');
test('legacy in_stock sizes remain tenant-scoped and expose their real retail price', async t => {
  const tenant = { _id: 'a'.repeat(24) }, productId = 'b'.repeat(24);
  let filter;
  t.mock.method(Size, 'find', value => { filter = value; return { select() { return this; }, session() { return this; }, lean: async () => [{ _id: 'c'.repeat(24), tenant: tenant._id, subproduct: productId, status: 'active', availability: 'in_stock', sellingPrice: 115300, availableStock: 11, size: '75cl' }].filter(row => value.availability.$in.includes(row.availability)) }; });
  const sizes = await catalog.loadSizes(tenant, [{ _id: productId }]);
  const offer = publicProduct({ _id: productId, product: { name: 'Pineapple Tequila' }, availableStock: 11, sellWithoutSizeVariants: false }, sizes);
  assert.equal(offer.sellingPrice, 115300); assert.equal(offer.availability, true);
  assert.equal(filter.tenant, tenant._id); assert.deepEqual(filter.subproduct, { $in: [productId] }); assert.equal(filter.status, 'active');
  for (const status of ['discontinued', 'pre_order', 'out_of_stock', 'coming_soon']) assert.equal(filter.availability.$in.includes(status), false);
});
test('REST catalogue search uses the shared literal regex escaper', () => {
  const pipeline = catalog.catalogPipeline({ _id: 'a'.repeat(24) }, { q: 'MODA (pineapple)' });
  const search = pipeline.find(stage => stage.$match?.['product.name']);
  assert.equal(search.$match['product.name'].$regex, 'MODA \\(pineapple\\)');
});
test('catalogue can display sold-out variant prices without making stale stock purchasable', async t => {
  let filter, projection;
  t.mock.method(Size, 'find', value => { filter = value; return { select(value) { projection = value; return this; }, session() { return this; }, lean: async () => [] }; });
  await catalog.loadSizes({ _id: 'a'.repeat(24) }, [], null, { includeOutOfStock: true });
  assert.equal(filter.availability.$in.includes('out_of_stock'), true);
  assert.ok(projection.split(' ').includes('availability'));
  const offer = publicProduct({ _id: 'b'.repeat(24), product: { name: 'Sold out bottle' }, availableStock: 11, sellWithoutSizeVariants: false }, [{ sellingPrice: 115300, availability: 'out_of_stock', availableStock: 11 }]);
  assert.equal(offer.sellingPrice, 115300); assert.equal(offer.variants[0].availableStock, 0); assert.equal(offer.availability, false);
});
