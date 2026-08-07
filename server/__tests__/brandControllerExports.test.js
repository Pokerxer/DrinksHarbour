// Every handler brand.controller.js exports must be mounted by brand.routes.js.
//
// `2f91df26` deleted the unguarded PUT/PATCH/DELETE /api/brands/:id routes — they
// were unreferenced duplicates of the guarded /admin/:id twins — but left their
// controllers exported to keep that commit's diff tight. An exported-but-unrouted
// mutation handler is a loaded gun: the next person to add a route reaches for the
// name that already exists (`deleteBrand`) rather than the guarded one
// (`deleteAdminBrand`), and re-opens the hole.
//
// Identity comparison, not name matching: `exports.x = asyncHandler(fn)` means the
// exported value is exactly the function Express mounts.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const test = require('node:test');
const assert = require('node:assert');

const brandController = require('../controllers/brand.controller');
const brandRouter = require('../routes/brand.routes');

/** Every function reachable as a handler on the brand router. */
function mountedHandlers() {
  const mounted = new Set();
  for (const layer of brandRouter.stack) {
    if (!layer.route) continue;
    for (const sub of layer.route.stack) mounted.add(sub.handle);
  }
  return mounted;
}

test('brand.controller exports no handler that brand.routes.js never mounts', () => {
  const mounted = mountedHandlers();

  const orphans = Object.entries(brandController)
    .filter(([, value]) => typeof value === 'function')
    .filter(([, value]) => !mounted.has(value))
    .map(([name]) => name)
    .sort();

  assert.deepStrictEqual(
    orphans,
    [],
    'These brand controllers are exported but unreachable — no route mounts them. ' +
    'Delete them, or mount them behind a guard:\n  ' + orphans.join('\n  ')
  );
});

test('the guarded /admin brand mutations are still mounted', () => {
  // Guards against the test above passing because the controller stopped
  // exporting anything at all.
  const mounted = mountedHandlers();
  for (const name of ['createAdminBrand', 'updateAdminBrand', 'deleteAdminBrand', 'createBrand']) {
    assert.ok(mounted.has(brandController[name]), `${name} must be mounted on brand.routes.js`);
  }
});
