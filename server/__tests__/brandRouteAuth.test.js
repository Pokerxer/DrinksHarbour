// server/routes/brand.routes.js declared five brand-mutation routes under a
// comment reading "// Protected routes (existing)" with no guard at all:
//
//   POST /  ·  PUT /:id  ·  PATCH /:id  ·  DELETE /:id  ·  POST /:id/recalculate
//
// Verified anonymously against production on 2026-08-07 with a non-existent
// ObjectId and an empty body (so nothing mutated): POST / → 400,
// PATCH /:id → 404, DELETE /:id → 404, POST /:id/recalculate → 200 locally.
// 400/404/200 all mean the request reached the controller — a valid id would
// have deleted a brand anonymously, in production.
//
// PUT/PATCH/DELETE /:id had no callers and were unreferenced duplicates of the
// guarded /admin/:id twins, so they are gone; the two survivors are guarded.
//
// See docs/superpowers/specs/2026-08-07-roles-permissions-hardening-design.md §2.1

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');

const brandService = require('../services/brand.service');
const brandRouter = require('../routes/brand.routes');
const { startRouter } = require('./helpers/routeAuthHarness');

const ABSENT_ID = '000000000000000000000000';

/**
 * Neutralises every brand-service call the five routes can reach, so if a
 * request DOES slip past the guards the controller answers instantly with a
 * 2xx instead of stalling on Mongoose's buffering timeout. That makes
 * "reached the controller" fast and unambiguous.
 */
function stubBrandService(t) {
  t.mock.method(brandService, 'createBrand', async () => ({ _id: ABSENT_ID }));
  t.mock.method(brandService, 'updateProductCount', async () => 0);
}

async function withApp(fn) {
  const app = await startRouter(brandRouter, '/api/brands');
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}

test('POST /api/brands rejects an anonymous caller', async (t) => {
  stubBrandService(t);
  await withApp(async (app) => {
    const res = await fetch(app.url('/api/brands'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.strictEqual(res.status, 401, 'anonymous brand creation must be refused');
  });
});

test('POST /api/brands/:id/recalculate rejects an anonymous caller', async (t) => {
  stubBrandService(t);
  await withApp(async (app) => {
    const res = await fetch(app.url(`/api/brands/${ABSENT_ID}/recalculate`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.strictEqual(res.status, 401);
  });
});

test('the unguarded PUT/PATCH/DELETE /api/brands/:id duplicates no longer exist', async (t) => {
  stubBrandService(t);
  await withApp(async (app) => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const res = await fetch(app.url(`/api/brands/${ABSENT_ID}`), {
        method,
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      assert.strictEqual(
        res.status,
        404,
        `${method} /api/brands/:id must not be routed — the guarded /admin/:id twin is the only way in`
      );
    }
  });
});

test('the guarded /admin twins are still declared', () => {
  // Deleting the duplicates must not have taken the real routes with them.
  const declared = brandRouter.stack
    .filter((l) => l.route)
    .map((l) => `${Object.keys(l.route.methods).join(',')} ${l.route.path}`);

  assert.ok(declared.includes('put /admin/:id'), 'PUT /admin/:id must survive');
  assert.ok(declared.includes('delete /admin/:id'), 'DELETE /admin/:id must survive');
  assert.ok(declared.includes('post /admin'), 'POST /admin must survive');
});
