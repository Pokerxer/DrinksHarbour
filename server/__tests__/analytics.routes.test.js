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
