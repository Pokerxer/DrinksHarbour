// __tests__/accounting.routes.test.js
//
// Route registration for the credit note surface. Registration is easy to get
// wrong in a way no type checker notices: a handler exists, a controller export
// exists, and the path 404s. That is exactly how the analytics dashboard broke.
const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../routes/accounting.routes');

const layers = router.stack || router.router?.stack || [];

/** [method, path] for every routed (non-middleware) layer, in declaration order. */
const routes = layers
  .filter((l) => l.route)
  .map((l) => [Object.keys(l.route.methods)[0].toUpperCase(), l.route.path]);

const middlewares = layers.filter((l) => !l.route).length;

test('the credit note endpoints are all registered', () => {
  const declared = new Set(routes.map(([m, p]) => `${m} ${p}`));
  for (const [method, path] of [
    ['GET', '/credit-notes'],
    ['POST', '/credit-notes'],
    ['POST', '/credit-notes/apply'],
    ['POST', '/credit-notes/:id/post'],
    ['POST', '/credit-notes/:id/cancel'],
  ]) {
    assert.ok(declared.has(`${method} ${path}`), `${method} ${path} is not registered`);
  }
});

test('the per-customer credit panel endpoint is registered', () => {
  assert.ok(routes.some(([m, p]) => m === 'GET' && p === '/customer-credits/:customerId'));
});

test('the literal apply path is declared before anything that could capture it', () => {
  // `/credit-notes/apply` and `/credit-notes/:id/...` differ in segment count, so
  // Express would not confuse them today. Declaring the literal first means a
  // future single-segment `/:id` route cannot swallow it.
  const applyAt = routes.findIndex(([m, p]) => m === 'POST' && p === '/credit-notes/apply');
  assert.ok(applyAt >= 0, 'apply is not registered');
  const idAt = routes.findIndex(([, p]) => p.startsWith('/credit-notes/:'));
  assert.ok(idAt >= 0, 'no parametrised credit note route to compare against');
  assert.ok(applyAt < idAt, 'apply must be declared before the :id routes');
});

test('every route sits behind the auth and plan guards', () => {
  // Accounting is tenant money: protect → attachTenant → requireOwnTenant →
  // tenantAdminOrSuperAdmin → requireCapability. None may be dropped.
  assert.ok(middlewares >= 5, `expected at least 5 guard layers, found ${middlewares}`);
  const firstRoute = layers.findIndex((l) => l.route);
  const guardsBefore = layers.slice(0, firstRoute).filter((l) => !l.route).length;
  assert.equal(guardsBefore, middlewares, 'a route is declared before a guard');
});

test('a drafted note needs no id segment, so post is a separate action', () => {
  // Creating and posting are deliberately different calls so a credit can be
  // reviewed before it reaches the ledger.
  assert.ok(!routes.some(([m, p]) => m === 'POST' && p === '/credit-notes/:id'),
    'an implicit post route would bypass the review step');
});
