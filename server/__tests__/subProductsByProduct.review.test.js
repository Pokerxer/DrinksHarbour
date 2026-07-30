// server/__tests__/subProductsByProduct.review.test.js
//
// The admin "Sub-Products" review panel (product edit page → "Review Sub-Product"
// drawer) loads its rows from GET /api/subproducts/product/:productId. That handler
// was written as a storefront endpoint and filtered `{ isPublished: true, status:
// 'active' }` — so a tenant listing awaiting approval (status defaults to 'pending')
// was never returned, and the panel's "Needs Review" / Approve / Decline UI could
// never appear. Platform admins must see every listing linked to the product.
const test = require('node:test');
const assert = require('node:assert');

const SubProduct = require('../models/SubProduct');
const subProductService = require('../services/subproduct.service');
const subProductController = require('../controllers/subproduct.controller');

function stubFind(docs = []) {
  const original = SubProduct.find;
  const captured = { filter: null };
  const chain = {
    populate() { return chain; },
    select()   { return chain; },
    lean: async () => docs,
  };
  SubProduct.find = (filter) => { captured.filter = filter; return chain; };
  return { captured, restore: () => { SubProduct.find = original; } };
}

test('storefront callers still only get published, active listings', async () => {
  const { captured, restore } = stubFind();
  try {
    await subProductService.getSubProductsByProduct('6a6bc1cb5b63d0435cd06eca');
  } finally {
    restore();
  }
  assert.strictEqual(captured.filter.isPublished, true);
  assert.strictEqual(captured.filter.status, 'active');
});

test('admin review callers get every listing, including pending ones', async () => {
  const { captured, restore } = stubFind();
  try {
    await subProductService.getSubProductsByProduct('6a6bc1cb5b63d0435cd06eca', {
      includeAll: true,
    });
  } finally {
    restore();
  }
  assert.strictEqual(captured.filter.isPublished, undefined);
  assert.strictEqual(captured.filter.status, undefined);
  assert.ok(captured.filter.product, 'still scoped to the product');
});

test('the route asks for every listing when a platform admin is signed in', async () => {
  const original = subProductService.getSubProductsByProduct;
  const seen = [];
  subProductService.getSubProductsByProduct = async (id, opts) => {
    seen.push(opts);
    return [];
  };
  const res = { status: () => res, json: () => res };
  try {
    await subProductController.getSubProductsByProduct(
      { params: { productId: 'p1' }, user: { role: 'super_admin' } }, res, () => {}
    );
    await subProductController.getSubProductsByProduct(
      { params: { productId: 'p1' }, user: { role: 'tenant_admin' } }, res, () => {}
    );
    await subProductController.getSubProductsByProduct(
      { params: { productId: 'p1' } }, res, () => {}
    );
  } finally {
    subProductService.getSubProductsByProduct = original;
  }
  assert.strictEqual(seen[0].includeAll, true, 'super_admin sees pending listings');
  assert.strictEqual(seen[1].includeAll, false, 'tenant admin gets the storefront view');
  assert.strictEqual(seen[2].includeAll, false, 'anonymous gets the storefront view');
});
