// Role guards advertise which roles they admit via an `authorizedRoles` array,
// so a test can read the enforced role set straight off a live Express router
// (Express cannot otherwise show what an authorize(...) closure captured).
//
// Metadata that merely claims something is worse than none, so every tag here
// is checked against the guard's actual runtime behaviour: each guard is run
// once per role and the roles that reach next() must equal the tag exactly.
//
// See docs/superpowers/specs/2026-08-07-roles-permissions-hardening-design.md §2.4

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const auth = require('../middleware/auth.middleware');

const ALL_ROLES = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'tenant_staff', 'customer'];
const TENANT_ID = new mongoose.Types.ObjectId();

/**
 * Runs `guard` as `role`, with a tenant context that matches the user's own
 * tenant so only the role dimension varies (the tenant-membership branch in
 * tenantAdminOnly/tenantUserOnly is covered by tenantIsolation.test.js).
 */
function admits(guard, role) {
  const req = {
    user: { _id: new mongoose.Types.ObjectId(), role, tenant: TENANT_ID },
    tenant: { _id: TENANT_ID, status: 'approved', subscriptionStatus: 'active' },
    query: {},
    body: {},
    headers: {},
  };
  let passed = false;
  try {
    guard(req, {}, () => { passed = true; });
  } catch {
    return false;
  }
  return passed;
}

const TAGGED_GUARDS = [
  ['superAdminOnly', auth.superAdminOnly],
  ['tenantAdminOnly', auth.tenantAdminOnly],
  ['tenantAdminOrSuperAdmin', auth.tenantAdminOrSuperAdmin],
  ['tenantUserOnly', auth.tenantUserOnly],
];

for (const [name, guard] of TAGGED_GUARDS) {
  test(`${name} declares an authorizedRoles array`, () => {
    assert.ok(Array.isArray(guard.authorizedRoles), `${name}.authorizedRoles must be an array`);
  });

  test(`${name}.authorizedRoles matches its runtime behaviour`, () => {
    const actual = ALL_ROLES.filter((r) => admits(guard, r)).sort();
    assert.deepStrictEqual(
      [...guard.authorizedRoles].sort(),
      actual,
      `${name} admits [${actual}] at runtime — the tag must say exactly that`
    );
  });
}

test('authorize(...roles) tags the guard it returns', () => {
  const guard = auth.authorize('super_admin', 'admin');
  assert.deepStrictEqual(guard.authorizedRoles, ['super_admin', 'admin']);

  const actual = ALL_ROLES.filter((r) => admits(guard, r));
  assert.deepStrictEqual(actual, ['super_admin', 'admin']);
});

test('authorize tags are per-call, not shared', () => {
  const a = auth.authorize('super_admin');
  const b = auth.authorize('tenant_staff');
  assert.deepStrictEqual(a.authorizedRoles, ['super_admin']);
  assert.deepStrictEqual(b.authorizedRoles, ['tenant_staff']);
});

test('the dead TENANT_OWNER_ROLES constant is gone', () => {
  assert.strictEqual(
    auth.TENANT_OWNER_ROLES,
    undefined,
    'TENANT_OWNER_ROLES was declared and never referenced'
  );
});
