// server/__tests__/adminApproveListingPublishesProduct.test.js
//
// A tenant listing a product the catalog doesn't have yet creates the Product with
// status 'pending' / isPublished false. The ONLY review surface in the admin app is
// the "Review Sub-Product" drawer, and its Approve button reported "now live on the
// store" while only ever flipping the SubProduct to 'active' — the parent Product
// stayed 'pending', so the listing stayed invisible everywhere (storefront queries
// and getProductById both require status 'approved').
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const Product = require('../models/Product');
const subProductService = require('../services/subproduct.service');
const productService = require('../services/product.service');

const oid = () => new mongoose.Types.ObjectId();

// Stands in for the Mongoose doc adminSetSubProductStatus loads and saves.
function fakeSubProduct(productId) {
  return {
    _id: oid(),
    status: 'pending',
    tenant: { revenueModel: 'markup', markupPercentage: 10 },
    product: { _id: productId, platformMarkup: 0 },
    metadata: {},
    costPrice: 1000,
    baseSellingPrice: 1500,
    save: async function () { return this; },
  };
}

function harness({ productStatus }) {
  const productId = oid();
  const sp = fakeSubProduct(productId);
  const calls = { approved: [] };

  const original = {
    findById: SubProduct.findById,
    sizeUpdateMany: Size.updateMany,
    productFindById: Product.findById,
    approveProduct: productService.approveProduct,
  };

  SubProduct.findById = () => {
    const chain = { populate() { return chain; }, then: (r) => r(sp) };
    return chain;
  };
  Size.updateMany = async () => ({});
  Product.findById = () => ({
    select: () => ({ lean: async () => ({ _id: productId, status: productStatus }) }),
  });
  productService.approveProduct = async (id, user) => {
    calls.approved.push({ id: String(id), role: user?.role });
    return {};
  };

  return {
    sp,
    productId,
    calls,
    restore() {
      SubProduct.findById = original.findById;
      Size.updateMany = original.sizeUpdateMany;
      Product.findById = original.productFindById;
      productService.approveProduct = original.approveProduct;
    },
  };
}

test('approving a listing also approves its still-pending parent product', async () => {
  const h = harness({ productStatus: 'pending' });
  const user = { _id: oid(), role: 'super_admin' };
  try {
    await subProductService.adminSetSubProductStatus(String(h.sp._id), 'active', {}, null, user);
  } finally {
    h.restore();
  }
  assert.strictEqual(h.sp.status, 'active');
  assert.deepStrictEqual(
    h.calls.approved,
    [{ id: String(h.productId), role: 'super_admin' }],
    'the parent product must be approved so the listing is actually visible',
  );
});

test('an already-approved parent product is left alone', async () => {
  const h = harness({ productStatus: 'approved' });
  try {
    await subProductService.adminSetSubProductStatus(
      String(h.sp._id), 'active', {}, null, { _id: oid(), role: 'super_admin' },
    );
  } finally {
    h.restore();
  }
  assert.deepStrictEqual(h.calls.approved, [], 'no redundant approval (it would double-count brand/category totals)');
});

test('a tenant admin approving their own listing does not touch the product', async () => {
  // The route admits tenant admins, and approveProduct throws ForbiddenError for
  // them — attempting it would turn a normal approval into a hard failure.
  const h = harness({ productStatus: 'pending' });
  try {
    await subProductService.adminSetSubProductStatus(
      String(h.sp._id), 'active', {}, null, { _id: oid(), role: 'tenant_admin' },
    );
  } finally {
    h.restore();
  }
  assert.strictEqual(h.sp.status, 'active');
  assert.deepStrictEqual(h.calls.approved, []);
});

test('declining a listing does not publish the product', async () => {
  const h = harness({ productStatus: 'pending' });
  try {
    await subProductService.adminSetSubProductStatus(
      String(h.sp._id), 'archived', {}, 'poor images', { _id: oid(), role: 'super_admin' },
    );
  } finally {
    h.restore();
  }
  assert.strictEqual(h.sp.status, 'archived');
  assert.deepStrictEqual(h.calls.approved, []);
});
