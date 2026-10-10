const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildPlan } = require('../services/restock/plan');
function imageFor(product) {
  return buildPlan({ tenantId: 't', products: [{ _id: 'p', ...product }],
    warehouses: [{ _id: 'w', name: 'Main' }],
    snapshots: new Map([['p', { stock: [{ sizeId: 's', warehouseId: 'w', available: 0, threshold: 10 }] }]]),
    sales: { rows: [], uncertain: new Set() }, purchases: [], transfers: [], pricelists: [],
  }).lines[0].productImage;
}
test('warehouse plans use actual tenant imagery before the central catalogue fallback', () => {
  assert.equal(imageFor({ imagesOverride: [{ url: 'https://example.com/tenant.jpg', isPrimary: true }],
    product: { name: 'Wine', images: [{ url: 'https://example.com/catalogue.jpg' }] } }), 'https://example.com/tenant.jpg');
  assert.equal(imageFor({ product: { name: 'Wine', images: [{ url: 'https://example.com/catalogue.jpg' }] } }), 'https://example.com/catalogue.jpg');
  assert.equal(imageFor({ product: { name: 'Wine' } }), null);
});
