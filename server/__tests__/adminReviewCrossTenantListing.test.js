// server/__tests__/adminReviewCrossTenantListing.test.js
//
// The "Review Sub-Product" drawer loads its detail via GET /api/subproducts/:id,
// whose service hard-scoped `{ _id, tenant: tenantId }`. A platform admin carries
// their OWN tenant claim (super_admin admin@drinksharbour.com is tenant=wyncity),
// so opening another tenant's listing threw NotFoundError and the drawer rendered
// "Failed to load sub-product details" — for the exact listings it exists to review.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const SubProduct = require('../models/SubProduct');
const subProductService = require('../services/subproduct.service');
const subProductController = require('../controllers/subproduct.controller');

const oid = () => new mongoose.Types.ObjectId();

function stubFindOne() {
  const original = SubProduct.findOne;
  const filters = [];
  const doc = { _id: oid(), shipping: null, warehouse: null, sizes: [] };
  SubProduct.findOne = (filter) => {
    filters.push(filter);
    const chain = {
      populate() { return chain; },
      lean: async () => ({ ...doc }),
    };
    // The first call is a bare .lean(); later ones populate first.
    chain.then = (resolve) => resolve({ ...doc });
    return chain;
  };
  return { filters, restore: () => { SubProduct.findOne = original; } };
}

test('a tenant admin only ever sees their own catalog', async () => {
  const { filters, restore } = stubFindOne();
  const tenantId = oid();
  try {
    await subProductService.getSubProduct(String(oid()), tenantId, {});
  } finally {
    restore();
  }
  assert.ok(filters.length > 0);
  for (const f of filters) {
    assert.strictEqual(String(f.tenant), String(tenantId), 'every lookup stays tenant-scoped');
  }
});

test('a platform admin can open another tenant\'s listing to review it', async () => {
  const { filters, restore } = stubFindOne();
  try {
    await subProductService.getSubProduct(String(oid()), oid(), { anyTenant: true });
  } finally {
    restore();
  }
  assert.ok(filters.length > 0);
  for (const f of filters) {
    assert.strictEqual(f.tenant, undefined, 'no ownership filter blocks the review');
  }
});

test('the route sets anyTenant from the caller\'s role', async () => {
  const original = subProductService.getSubProduct;
  const seen = [];
  subProductService.getSubProduct = async (id, tenantId, opts) => {
    seen.push(opts);
    return {};
  };
  const res = { status: () => res, json: () => res };
  const call = (role) =>
    subProductController.getSubProduct(
      { params: { id: String(oid()) }, query: {}, user: { role, tenant: oid() } },
      res,
      () => {},
    );
  try {
    await call('super_admin');
    await call('tenant_admin');
  } finally {
    subProductService.getSubProduct = original;
  }
  assert.strictEqual(seen[0].anyTenant, true);
  assert.strictEqual(seen[1].anyTenant, false);
});
