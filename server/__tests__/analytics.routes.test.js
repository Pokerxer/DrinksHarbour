// __tests__/analytics.routes.test.js
//
// Regression test for the ten read endpoints the admin analytics dashboard has
// always called and that were never registered. Each one answered 404 with an
// error envelope carrying no `data` key, which the client unwrapped into
// `undefined` and rendered as a TypeError inside StatCards — three layers from
// the real cause. Asserting on the router stack is the only place that failure
// was actually visible.
const test = require('node:test');
const assert = require('node:assert');
const router = require('../routes/analytics.routes');

const READ_PATHS = [
  '/web-overview',
  '/acquisition',
  '/devices',
  '/traffic-sources',
  '/audience',
  '/conversions',
  '/goals',
  '/pages',
  '/retention',
  '/channels',
];

function getRoutes() {
  return router.stack
    .filter((l) => l.route && l.route.methods.get)
    .map((l) => ({ path: l.route.path, handlers: l.route.stack.map((s) => s.handle) }));
}

test('every endpoint the dashboard fetches is registered', () => {
  const registered = new Set(getRoutes().map((r) => r.path));
  const missing = READ_PATHS.filter((p) => !registered.has(p));
  assert.deepEqual(missing, [], `unregistered read endpoints: ${missing.join(', ')}`);
});

test('the read endpoints are behind authentication, not public', () => {
  // Each must carry the protect/authorize pair. A bare handler would be an
  // anonymous dump of platform-wide storefront traffic.
  for (const { path, handlers } of getRoutes()) {
    if (!READ_PATHS.includes(path)) continue;
    assert.ok(
      handlers.length >= 2,
      `${path} is registered with a single handler and no auth middleware`,
    );
  }
});

test('/dashboard keeps its tenant-scoped guards', () => {
  const dash = getRoutes().find((r) => r.path === '/dashboard');
  assert.ok(dash, '/dashboard must still be registered');
  assert.ok(dash.handlers.length >= 3, 'dashboard keeps protect + attachTenant + role guard');
});

test('the /track write endpoints stay public for anonymous storefronts', () => {
  // Deliberate: page views arrive from logged-out visitors, so requiring a
  // token here would silently stop all collection.
  const postRoutes = router.stack
    .filter((l) => l.route && l.route.methods.post)
    .map((l) => l.route.path);
  assert.ok(postRoutes.includes('/track'));
  assert.ok(postRoutes.includes('/track/conversion'));
});

// ─── /dashboard topProducts.productSlug ──────────────────────────────────────
//
// The ecommerce dashboard's Top Products widget deep-links to the public
// product page, so every topProducts row now carries the central catalog's
// product slug. The slug comes from the $lookup on products (which projects no
// fields, so the full product doc is already there) — these tests pin down the
// controller's mapping layer only, with the DB replaced by stubs, using the
// handlers exactly as they sit on the registered route.

function getDashboardHandler() {
  const dash = getRoutes().find((r) => r.path === '/dashboard');
  assert.ok(dash, '/dashboard must stay registered');
  return dash.handlers[dash.handlers.length - 1];
}

function stubDashboardModels(t, topProductRows) {
  const Order = require('../models/Order');
  const SubProduct = require('../models/SubProduct');
  const Tenant = require('../models/Tenant');

  // Every order aggregation resolves to [] except the topProducts pipeline,
  // which is recognisable by its products $lookup and returns given rows there.
  t.mock.method(Order, 'aggregate', (pipeline) => {
    if (Array.isArray(pipeline) && pipeline.some((s) => s.$lookup && s.$lookup.from === 'products')) {
      return Promise.resolve(topProductRows);
    }
    return Promise.resolve([]);
  });
  t.mock.method(Order, 'countDocuments', () => Promise.resolve(0));

  // recentOrdersAgg / Tenant hydration: chainable query ending in lean().
  const emptyQuery = {
    sort() { return emptyQuery; },
    limit() { return emptyQuery; },
    select() { return emptyQuery; },
    populate() { return emptyQuery; },
    lean() { return Promise.resolve([]); },
  };
  t.mock.method(Order, 'find', () => emptyQuery);
  t.mock.method(SubProduct, 'countDocuments', () => Promise.resolve(0));
  t.mock.method(Tenant, 'find', () => ({
    select() { return { lean: () => Promise.resolve([]) }; },
  }));
}

function runDashboard(t, topProductRows) {
  stubDashboardModels(t, topProductRows);
  const getDashboard = getDashboardHandler();
  let payload;
  const res = {
    json(obj) { payload = obj; },
    status() { return this; },
  };
  const req = { user: { role: 'super_admin' }, query: {} };

  return Promise.resolve(getDashboard(req, res, () => {})).then(() => {
    assert.ok(payload && payload.success === true, 'dashboard handler must answer success');
    return payload.data;
  });
}

const spRow = (prod) => ({
  _id: 'sp1',
  sold: 2,
  revenue: 3000,
  sp: { sku: 'JAM-70CL', availableStock: 11, stockStatus: 'in_stock' },
  prod,
  ten: null,
});

test('topProducts rows carry the matched product slug for deep links', async (t) => {
  const data = await runDashboard(t, [spRow({ name: 'Jameson 70cl', slug: 'jameson-70cl', images: [] })]);
  const row = data.topProducts[0];
  assert.equal(row.productSlug, 'jameson-70cl');
  // Existing fields untouched by the addition.
  assert.equal(row.sku, 'JAM-70CL');
  assert.equal(row.name, 'Jameson 70cl');
  assert.equal(row.id, 'sp1');
});

test('topProducts degrade to an empty slug when the product doc is unmatched', async (t) => {
  // preserveNullAndEmptyArrays on the products $lookup → no `prod` key at all.
  const data = await runDashboard(t, [spRow(undefined)]);
  assert.equal(data.topProducts[0].productSlug, '');
});

