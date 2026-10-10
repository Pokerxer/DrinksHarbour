'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const catalog = require('../services/storefrontCatalog.service');
const { quoteCart } = require('../services/storefrontCart.service');
const tenant = { _id: 'a'.repeat(24), revenueModel: 'commission', commissionPercentage: 13 };
const spId = 'b'.repeat(24), sizeId = 'c'.repeat(24), pId = 'd'.repeat(24);
const sp = { _id: spId, tenant: tenant._id, product: { _id: pId, name: 'Wine', isAlcoholic: true },
  availableStock: 10, costPrice: 1000, baseSellingPrice: 5000, sellWithoutSizeVariants: false };
const sz = { _id: sizeId, tenant: tenant._id, subproduct: spId, sellingPrice: 5000, costPrice: 1000, availableStock: 8, maxOrderQuantity: 8 };
const input = { items: [{ subProductId: spId, sizeId, quantity: 2 }], shippingMethod: 'pickup', ageVerified: true };
function fixtures(t, products = [sp], sizes = [sz]) {
  t.mock.method(SubProduct, 'aggregate', () => ({ session() { return this; }, exec: async () => products }));
  t.mock.method(Size, 'find', () => ({ select() { return this; }, session() { return this; }, lean: async () => sizes }));
}
test('catalogue pipeline constrains tenant and approved central products before pagination', () => {
  const pipeline = catalog.catalogPipeline(tenant, {});
  assert.equal(String(pipeline[0].$match.tenant), tenant._id);
  assert.equal(pipeline[0].$match.isPublished, true);
  assert.equal(pipeline[0].$match.status, 'active');
  assert.ok(pipeline.some(stage => stage.$match?.$or?.some(branch => branch['product.status'] === 'approved' && branch['product.isPublished'] === true)));
});
test('quote uses retail, safe revenue snapshots and server totals', async t => {
  fixtures(t);
  const quote = await quoteCart(tenant, input);
  assert.equal(quote.total, 10000);
  assert.equal(quote.items[0].unitPrice, 5000);
  assert.equal(quote.orderItems[0].platformCommission, 1300);
  assert.equal(quote.orderItems[0].tenantRevenueShare, 8700);
});
test('quote rejects unpublished/foreign products and unrelated variants', async t => {
  fixtures(t, []);
  await assert.rejects(quoteCart(tenant, input), e => e.statusCode === 404);
  SubProduct.aggregate = () => ({ session() { return this; }, exec: async () => [sp] });
  Size.find = () => ({ select() { return this; }, session() { return this; }, lean: async () => [{ ...sz, subproduct: pId }] });
  await assert.rejects(quoteCart(tenant, input), /variant/);
});
test('age confirmation and selected variant are mandatory for alcoholic variant products', async t => {
  fixtures(t);
  await assert.rejects(quoteCart(tenant, { ...input, ageVerified: false }), /age/i);
  await assert.rejects(quoteCart(tenant, { ...input, items: [{ subProductId: spId, quantity: 1 }] }), /variant/i);
});
test('stock checks aggregate all variants sharing a parent and duplicate lines', async t => {
  fixtures(t);
  await assert.rejects(quoteCart(tenant, { ...input, items: [input.items[0], { ...input.items[0], quantity: 7 }] }), /stock|quantity/);
});
test('delivery cannot silently quote a missing state as free shipping', async t => {
  fixtures(t);
  await assert.rejects(quoteCart(tenant, { ...input, shippingMethod: 'standard', shipping: {} }), /state|shipping/i);
});
test('tenant-created pending products are sellable only in their submitting tenant store', () => {
  const pipeline = catalog.catalogPipeline(tenant, {});
  const branches = pipeline.find(stage => stage.$match?.$or)?.$match.$or;
  assert.ok(branches?.some(branch => branch['product.status'] === 'pending' && String(branch['product.submittingTenant']) === tenant._id));
});
test('delivery quotes accept finite map coordinates and reject invalid coordinate authority', async t => {
  fixtures(t);
  const shipping = { address: '12 City Road', city: 'Abuja', state: 'FCT', country: 'Nigeria', lga: 'Municipal Area Council', coordinates: { latitude: 9.0765, longitude: 7.3986 } };
  const quote = await quoteCart(tenant, { ...input, shippingMethod: 'standard', shipping });
  assert.ok(Number.isFinite(quote.total));
  for (const coordinates of [{ latitude: 91, longitude: 7 }, { latitude: 9 }, { latitude: 9, longitude: 7, price: 1 }])
    await assert.rejects(quoteCart(tenant, { ...input, shippingMethod: 'standard', shipping: { ...shipping, coordinates } }), /coordinate|field/i);
});
test('tenant REST quote charges the road fee in the server total', async t => {
  fixtures(t);
  const routing = require('../services/ors.service');
  t.mock.method(routing, 'getRoadDistanceKm', async () => 10);
  const quote = await quoteCart({ ...tenant, location: { lat: 9.1, lon: 7.5 } }, { ...input, shippingMethod: 'standard', shipping: { state: 'FCT', coordinates: { latitude: 9.2, longitude: 7.6 } } });
  assert.equal(quote.shippingFee, 4000);
  assert.equal(quote.total, 14000);
  assert.equal(quote.shipping.source, 'google');
});
