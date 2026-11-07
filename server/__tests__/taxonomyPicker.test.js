const test = require('node:test');
const assert = require('node:assert/strict');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');
const Tenant = require('../models/Tenant');
const categories = require('../controllers/category.controller');
const subcategories = require('../controllers/subcategory.controller');

const category = '507f1f77bcf86cd799439011';

function emptyQuery() {
  const query = {
    select: () => query,
    sort: () => query,
    populate: () => query,
    lean: async () => [],
  };
  return query;
}

async function request(handler, req) {
  let body;
  let status = 200;
  const res = {
    status(code) { status = code; return this; },
    json(value) { body = value; },
  };
  await handler(req, res, (error) => { throw error; });
  return { status, body };
}

test('public taxonomy defaults to published for both lists', async (t) => {
  const findCategories = t.mock.method(Category, 'find', emptyQuery);
  const findSubcategories = t.mock.method(SubCategory, 'find', emptyQuery);
  t.mock.method(Product, 'aggregate', async () => []);
  await request(categories.getCategories, { query: {} });
  await request(subcategories.getSubCategories, { query: { category } });

  assert.deepEqual(findCategories.mock.calls[0].arguments[0], { status: 'published' });
  assert.deepEqual(findSubcategories.mock.calls[0].arguments[0], { status: 'published', parent: category });
});

test('catalog pickers include seeded active and published rows within the authenticated tenant industry', async (t) => {
  const previous = process.env.INDUSTRY_TAXONOMY_SCOPE_ENABLED;
  process.env.INDUSTRY_TAXONOMY_SCOPE_ENABLED = 'true';
  t.after(() => {
    if (previous === undefined) delete process.env.INDUSTRY_TAXONOMY_SCOPE_ENABLED;
    else process.env.INDUSTRY_TAXONOMY_SCOPE_ENABLED = previous;
  });
  const findTenant = t.mock.method(Tenant, 'findById', () => ({
    select: () => ({ lean: async () => ({ industries: ['home'] }) }),
  }));
  const findCategories = t.mock.method(Category, 'find', emptyQuery);
  const exists = t.mock.method(Category, 'exists', async () => true);
  const findSubcategories = t.mock.method(SubCategory, 'find', emptyQuery);
  t.mock.method(Product, 'aggregate', async () => []);
  const req = {
    user: { role: 'tenant_owner', tenant: 'verified-tenant' },
    query: { category, status: 'draft', tenant: 'untrusted-tenant' },
  };

  const root = await request(categories.getCategoryPicker, req);
  const children = await request(subcategories.getSubCategoryPicker, req);
  const expected = {
    $and: [
      { $or: [{ status: 'published' }, { status: 'active', displayOrder: 500, industry: { $ne: null } }] },
      { $or: [{ industry: { $exists: false } }, { industry: null }, { industry: { $in: ['home'] } }] },
    ],
  };

  assert.deepEqual(root.body.meta.industries, ['home']);
  assert.deepEqual(children.body.meta.industries, ['home']);
  assert.deepEqual(findCategories.mock.calls[0].arguments[0], expected);
  assert.deepEqual(exists.mock.calls[0].arguments[0], { _id: category, ...expected });
  assert.deepEqual(findSubcategories.mock.calls[0].arguments[0], { parent: category, ...expected });
  assert.deepEqual(findTenant.mock.calls.map((call) => call.arguments[0]), ['verified-tenant', 'verified-tenant']);

  exists.mock.mockImplementation(async () => false);
  const inaccessible = await request(subcategories.getSubCategoryPicker, req);
  assert.deepEqual(inaccessible.body.data, []);
  assert.equal(findSubcategories.mock.callCount(), 1);
});

test('subcategory picker requires a scalar category ID', async (t) => {
  const find = t.mock.method(SubCategory, 'find', emptyQuery);
  const response = await request(subcategories.getSubCategoryPicker, { query: { category: { $ne: null } } });
  assert.equal(response.status, 400);
  assert.equal(find.mock.callCount(), 0);
});

test('product creation and editing can resolve seeded category and subcategory IDs', async (t) => {
  const productService = require('../services/product.service');
  const subCategory = '507f1f77bcf86cd799439012';
  const selected = {
    $or: [{ status: 'published' }, { status: 'active', displayOrder: 500, industry: { $ne: null } }],
  };
  t.mock.method(Product, 'findOne', () => ({ select: () => ({ lean: async () => null }) }));
  t.mock.method(Product, 'findById', async () => ({ status: 'pending' }));
  const findCategory = t.mock.method(Category, 'findOne', (query) => {
    assert.deepEqual(query, { _id: category, ...selected });
    return { lean: async () => ({ _id: category, industry: 'home' }) };
  });
  const reachedSubcategory = new Error('reached valid subcategory selection');
  const findSubcategory = t.mock.method(SubCategory, 'findOne', (query) => {
    assert.deepEqual(query, { _id: subCategory, parent: category, ...selected });
    throw reachedSubcategory;
  });
  const user = { role: 'super_admin' };

  await assert.rejects(productService.createProduct({
    name: 'Home picker fixture', type: 'home_kitchen', category, subCategory,
  }, user), reachedSubcategory);
  await assert.rejects(productService.updateProduct(category, { category, subCategory }, user), reachedSubcategory);
  assert.equal(findCategory.mock.callCount(), 2);
  assert.equal(findSubcategory.mock.callCount(), 2);
});

test('picker routes require authentication and an authorized catalogue role', async () => {
  const categoryRoutes = require('../routes/category.routes');
  const subCategoryRoutes = require('../routes/subcategory.routes');
  for (const router of [categoryRoutes, subCategoryRoutes]) {
    const route = router.stack.find((layer) => layer.route?.path === '/picker').route;
    const [authenticate, authorize] = route.stack.map((layer) => layer.handle);
    await assert.rejects(request(authenticate, { headers: {} }), { statusCode: 401 });
    await assert.rejects(request(authorize, { user: { role: 'customer' } }), { statusCode: 403 });
    for (const role of ['super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'tenant_staff']) {
      let allowed = false;
      authorize({ user: { role } }, {}, () => { allowed = true; });
      assert.equal(allowed, true, role);
    }
  }
});

test('picker preserves the unfiltered view for platform users and flag-off tenants', async (t) => {
  const previous = process.env.INDUSTRY_TAXONOMY_SCOPE_ENABLED;
  t.after(() => {
    if (previous === undefined) delete process.env.INDUSTRY_TAXONOMY_SCOPE_ENABLED;
    else process.env.INDUSTRY_TAXONOMY_SCOPE_ENABLED = previous;
  });
  const findTenant = t.mock.method(Tenant, 'findById', () => { throw new Error('unexpected tenant lookup'); });
  const findCategories = t.mock.method(Category, 'find', emptyQuery);
  t.mock.method(Product, 'aggregate', async () => []);
  const cases = [
    { flag: 'true', role: 'super_admin' },
    { flag: 'false', role: 'tenant_owner' },
  ];
  for (const { flag, role } of cases) {
    process.env.INDUSTRY_TAXONOMY_SCOPE_ENABLED = flag;
    const result = await request(categories.getCategoryPicker, { user: { role, tenant: 'context' }, query: {} });
    assert.equal(result.body.meta.industries, null);
  }
  assert.equal(findTenant.mock.callCount(), 0);
  const expected = {
    $or: [{ status: 'published' }, { status: 'active', displayOrder: 500, industry: { $ne: null } }],
  };
  assert.deepEqual(findCategories.mock.calls.map((call) => call.arguments[0]), [expected, expected]);
});
