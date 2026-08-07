// No router may declare the same METHOD + path twice.
//
// Express matches layers in declaration order and a route handler that sends a
// response never falls through, so the *second* declaration of a path is dead
// code that can never run. That is not merely untidy: it advertises guards and
// role sets the server will never apply. `subproduct.routes.js` declared
// `POST /` twice — the reachable one guarded by `tenantAdminOrSuperAdmin`, the
// dead one by `authorize('tenant_admin','super_admin')` — and reading the dead
// one is what made the client permission map look like it was under-enforced,
// costing a whole investigation on 2026-08-07.
//
// Like routeGuardCoverage.test.js this walks the LIVE routers rather than
// parsing source, so `router.use(...)` globals and guard-array variables are
// composed by Express itself and declaration order is read from Express's own
// stack — the thing that actually decides which layer wins.
//
// See docs/superpowers/specs/2026-08-07-roles-permissions-hardening-design.md

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROUTES_DIR = path.join(__dirname, '..', 'routes');

// ─── Known shadowed declarations ─────────────────────────────────────────────
// Every entry is a duplicate that is still in the tree. Adding a line here says
// "this shadowing is understood and deliberately not fixed yet" — say why.
const KNOWN_SHADOWED = new Set([]);

/** Appends every shadowed (duplicate) declaration in one router to `out`. */
function walk(file, router, label, out, counter) {
  const seen = new Map();

  router.stack.forEach((layer, index) => {
    if (!layer.route) return;

    for (const method of Object.keys(layer.route.methods).filter((m) => layer.route.methods[m])) {
      const key = `${method.toUpperCase()} ${file}${label} ${layer.route.path}`;
      counter.total += 1;

      if (seen.has(key)) {
        out.push(`${key} (layer ${index} is shadowed by layer ${seen.get(key)})`);
      } else {
        seen.set(key, index);
      }
    }
  });
}

function findShadowed() {
  const out = [];
  const counter = { total: 0 };

  for (const file of fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.js')).sort()) {
    const mod = require(path.join(ROUTES_DIR, file));

    if (mod && Array.isArray(mod.stack)) {
      walk(file, mod, '', out, counter);
      continue;
    }
    // appraisal.routes.js exports { cycleRouter, appraisalRouter, ... }
    if (mod && typeof mod === 'object') {
      for (const [key, value] of Object.entries(mod)) {
        if (value && Array.isArray(value.stack)) walk(file, value, `[${key}]`, out, counter);
      }
    }
  }

  return { shadowed: out, total: counter.total };
}

/** Strips the trailing "(layer N is shadowed by layer M)" annotation. */
const keyOf = (entry) => entry.replace(/ \(layer .*\)$/, '');

test('no router declares the same method and path twice', () => {
  const { shadowed } = findShadowed();
  const unexpected = shadowed.filter((e) => !KNOWN_SHADOWED.has(keyOf(e))).sort();

  assert.deepStrictEqual(
    unexpected,
    [],
    'These route declarations can never run — Express already matched an ' +
    'earlier layer for the same method and path. Delete them, or add them to ' +
    'KNOWN_SHADOWED with a comment saying why:\n  ' + unexpected.join('\n  ')
  );
});

test('the known-shadowed list has no stale entries', () => {
  // A resolved entry left on the list would silently excuse the next duplicate
  // on that same path.
  const { shadowed } = findShadowed();
  const live = new Set(shadowed.map(keyOf));
  const stale = [...KNOWN_SHADOWED].filter((e) => !live.has(e)).sort();

  assert.deepStrictEqual(
    stale,
    [],
    `These entries are no longer shadowed — remove them:\n  ${stale.join('\n  ')}`
  );
});

test('the walk actually covered the route tree', () => {
  // Guards against the whole test passing because nothing loaded.
  const { total } = findShadowed();
  assert.ok(total > 500, `expected 500+ route declarations, walked ${total}`);
});

test('the surviving POST /api/subproducts is the tenantAdminOrSuperAdmin one', () => {
  // The duplicate that was deleted carried authorize('tenant_admin','super_admin'),
  // a different and wider role set. Pin which one Express actually runs so a
  // future delete cannot silently keep the wrong twin.
  const { tenantAdminOrSuperAdmin } = require('../middleware/auth.middleware');
  const router = require('../routes/subproduct.routes');

  const layers = router.stack.filter((l) => l.route && l.route.path === '/' && l.route.methods.post);
  assert.strictEqual(layers.length, 1, 'POST / must be declared exactly once');
  assert.strictEqual(
    layers[0].route.stack[0].handle,
    tenantAdminOrSuperAdmin,
    'POST /api/subproducts must be guarded by tenantAdminOrSuperAdmin'
  );
});
