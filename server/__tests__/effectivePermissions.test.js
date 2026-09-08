'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Role = require('../models/Role');
const { loadCustomPermissions, effectivePermissions } = require('../services/effectivePermissions.service');
const { authorizeTenantAction, authorize } = require('../middleware/auth.middleware');

test('custom permission lookup is active and tenant scoped; invalid platform grants are stripped', async t => {
  t.mock.method(Role, 'findOne', query => {
    assert.deepEqual(query, { _id: 'role', tenant: 'own', scope: 'tenant', isActive: true });
    return { select: () => ({ lean: async () => ({ permissions: ['inventory:adjust', 'users:write', 'unknown'] }) }) };
  });
  assert.deepEqual(await loadCustomPermissions({ role: 'tenant_staff', customRole: 'role', tenant: 'own' }), ['inventory:adjust']);
  assert.deepEqual(await loadCustomPermissions({ role: 'customer', customRole: 'role', tenant: 'own' }), []);
  assert.deepEqual(await loadCustomPermissions({ role: 'tenant_staff', customRole: 'role' }), []);
});
test('custom grants are additive and restricted to explicit own-tenant actions', () => {
  const user = { role: 'tenant_staff', tenant: 'own', customPermissions: ['inventory:adjust'] };
  assert.ok(effectivePermissions(user).includes('orders:write'));
  assert.ok(effectivePermissions(user).includes('inventory:adjust'));
  let passed = false;
  authorizeTenantAction('inventory:adjust')({ user, tenant: { _id: 'own' } }, {}, () => { passed = true; });
  assert.equal(passed, true);
  assert.throws(() => authorizeTenantAction('inventory:adjust')({ user, tenant: { _id: 'other' } }, {}, () => {}));
  assert.throws(() => authorize('super_admin', 'admin')({ user }, {}, () => {}));
  assert.throws(() => authorizeTenantAction('users:write'));
});
