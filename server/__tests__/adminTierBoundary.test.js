// `admin` is a lesser platform-admin tier, distinct from `super_admin`.
//
// Zero production users hold `admin` as of 2026-08-07, which makes the tier easy
// to mistake for dead weight and delete — or, worse, easy to quietly widen into a
// second `super_admin` because nobody would notice. Retiring it was considered and
// declined; keeping it only makes sense if the boundary that justifies it stays
// real. This pins that boundary.
//
// The five capabilities below are `super_admin`-only. Each is enforced somewhere
// different (a router.use, a route-level authorize, and two inline controller
// checks), so there is no single place a reviewer could look to notice a drift.
//
// The role comment on User.role's enum lists the same five. Change one, change both.
//
// See docs/superpowers/specs/2026-08-07-roles-permissions-hardening-design.md §1.6

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { superAdminOnly } = require('../middleware/auth.middleware');

/** Roles a route's guard chain admits, or null if no guard advertises a set. */
function rolesFor(router, method, routePath) {
  for (const layer of router.stack) {
    if (!layer.route || layer.route.path !== routePath || !layer.route.methods[method]) continue;
    for (const sub of layer.route.stack) {
      if (sub.handle && sub.handle.authorizedRoles) return sub.handle.authorizedRoles;
    }
  }
  return null;
}

test('1. review moderation is super_admin-only', () => {
  const router = require('../routes/review.routes');
  const globals = router.stack.filter((l) => !l.route).map((l) => l.handle);

  assert.ok(
    globals.includes(superAdminOnly),
    'review.routes.js must gate the whole router behind superAdminOnly — reviews ' +
    'attach to shared Product documents, so no lesser admin may moderate them'
  );
  assert.deepStrictEqual(superAdminOnly.authorizedRoles, ['super_admin']);
});

test('2. permanent user delete is super_admin-only', () => {
  const roles = rolesFor(require('../routes/user.routes'), 'delete', '/:id/permanent');
  assert.deepStrictEqual(roles, ['super_admin']);
});

test('3. tenant delete is super_admin-only', () => {
  const roles = rolesFor(require('../routes/tenant.routes'), 'delete', '/admin/:id');
  assert.deepStrictEqual(roles, ['super_admin']);
});

test('4. product approve and reject are super_admin-only', () => {
  const router = require('../routes/product.routes');
  assert.deepStrictEqual(rolesFor(router, 'post', '/:id/approve'), ['super_admin']);
  assert.deepStrictEqual(rolesFor(router, 'post', '/:id/reject'), ['super_admin']);
});

test('5. cross-tenant visibility is super_admin-only', () => {
  // These two are inline role expressions, not middleware — they widen a query
  // rather than deny a request, which middleware structurally cannot express.
  // Asserted against source because there is no seam to call them through.
  const controller = fs.readFileSync(
    path.join(__dirname, '..', 'controllers', 'subproduct.controller.js'), 'utf8'
  );
  const service = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'subproduct.service.js'), 'utf8'
  );

  assert.match(
    controller,
    /const includeAll = req\.user\?\.role === 'super_admin';/,
    "subproduct.controller.js must gate includeAll on 'super_admin' alone"
  );
  assert.match(
    service,
    /const statusFilter =\s*\n?\s*user\?\.role === 'super_admin'/,
    "subproduct.service.js must gate statusFilter on 'super_admin' alone"
  );
});

test('admin is still a declared role', () => {
  // If this fails the tier was retired — delete this file and the enum comment
  // on User.role together, rather than leaving either behind.
  const User = require('../models/User');
  assert.ok(
    User.schema.path('role').enumValues.includes('admin'),
    'admin was removed from the User.role enum'
  );
});
