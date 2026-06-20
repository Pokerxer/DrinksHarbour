// server/__tests__/employee.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  isValidPin,
  isValidEmail,
  sanitizePermissions,
  buildEmployeeFilter,
  buildCreatePayload,
  buildUpdateChanges,
  canDeleteEmployee,
} = require('../services/employee.helpers');

const TENANT = 'tenant-1';

// ── PIN / email validation ──────────────────────────────────────────────────

test('isValidPin accepts 4–6 digit numeric strings only', () => {
  assert.ok(isValidPin('1234'));
  assert.ok(isValidPin('123456'));
  assert.ok(!isValidPin('123'));
  assert.ok(!isValidPin('1234567'));
  assert.ok(!isValidPin('12ab'));
});

test('isValidEmail catches obviously malformed addresses', () => {
  assert.ok(isValidEmail('a@b.com'));
  assert.ok(!isValidEmail('no-at-sign'));
  assert.ok(!isValidEmail('a@b'));
  assert.ok(!isValidEmail(''));
});

// ── permission sanitising ───────────────────────────────────────────────────

test('sanitizePermissions drops unknown perms and de-dupes', () => {
  assert.deepStrictEqual(
    sanitizePermissions(['pos:sell', 'pos:sell', 'bogus', 'pos:void']),
    ['pos:sell', 'pos:void']
  );
});

test('sanitizePermissions returns undefined for non-arrays (leave unchanged)', () => {
  assert.strictEqual(sanitizePermissions(undefined), undefined);
  assert.strictEqual(sanitizePermissions('pos:sell'), undefined);
});

// ── list filter ─────────────────────────────────────────────────────────────

test('buildEmployeeFilter scopes to tenant and excludes deleted by default', () => {
  const f = buildEmployeeFilter(TENANT);
  assert.strictEqual(f.tenant, TENANT);
  assert.deepStrictEqual(f.role, { $in: ['tenant_owner', 'tenant_admin', 'tenant_staff'] });
  assert.deepStrictEqual(f.status, { $ne: 'deleted' });
});

test('buildEmployeeFilter applies exact role + status filters when valid', () => {
  const f = buildEmployeeFilter(TENANT, { role: 'tenant_staff', status: 'active' });
  assert.strictEqual(f.role, 'tenant_staff');
  assert.strictEqual(f.status, 'active');
});

test('buildEmployeeFilter ignores invalid role/status values', () => {
  const f = buildEmployeeFilter(TENANT, { role: 'super_admin', status: 'deleted' });
  assert.deepStrictEqual(f.role, { $in: ['tenant_owner', 'tenant_admin', 'tenant_staff'] });
  assert.deepStrictEqual(f.status, { $ne: 'deleted' });
});

test('buildEmployeeFilter builds an escaped case-insensitive search $or', () => {
  const f = buildEmployeeFilter(TENANT, { search: 'a.b' });
  assert.ok(Array.isArray(f.$or));
  assert.strictEqual(f.$or.length, 5);
  // The dot must be escaped so it isn't treated as "any char".
  assert.strictEqual(f.$or[0].firstName.source, 'a\\.b');
  assert.ok(f.$or[0].firstName.flags.includes('i'));
});

// ── create payload ──────────────────────────────────────────────────────────

test('buildCreatePayload requires firstName and a valid email', () => {
  assert.strictEqual(buildCreatePayload({ email: 'a@b.com' }, TENANT).ok, false);
  assert.strictEqual(buildCreatePayload({ firstName: 'Ada' }, TENANT).ok, false);
});

test('buildCreatePayload defaults role to tenant_staff and status to active', () => {
  const r = buildCreatePayload({ firstName: 'Ada', email: 'Ada@B.com' }, TENANT);
  assert.ok(r.ok);
  assert.strictEqual(r.value.role, 'tenant_staff');
  assert.strictEqual(r.value.status, 'active');
  assert.strictEqual(r.value.email, 'ada@b.com'); // normalised
  assert.strictEqual(r.value.tenant, TENANT);
  assert.strictEqual(r.value.posAccess, false);
});

test('buildCreatePayload rejects privileged role assignment', () => {
  for (const role of ['tenant_owner', 'super_admin', 'admin', 'customer']) {
    assert.strictEqual(buildCreatePayload({ firstName: 'X', email: 'x@y.com', role }, TENANT).ok, false);
  }
});

test('buildCreatePayload seeds default POS permissions when posAccess is on', () => {
  const r = buildCreatePayload({ firstName: 'Ada', email: 'a@b.com', posAccess: true }, TENANT);
  assert.ok(r.ok);
  assert.deepStrictEqual(r.value.posPermissions, ['pos:sell', 'pos:terminal:retail', 'pos:terminal:wholesale']);
});

test('buildCreatePayload rejects a malformed PIN', () => {
  assert.strictEqual(
    buildCreatePayload({ firstName: 'Ada', email: 'a@b.com', pin: '12' }, TENANT).ok,
    false
  );
});

// ── update changes ──────────────────────────────────────────────────────────

test('buildUpdateChanges protects the tenant owner role and active status', () => {
  const owner = { _id: '1', role: 'tenant_owner', status: 'active' };
  assert.strictEqual(buildUpdateChanges(owner, { role: 'tenant_staff' }).ok, false);
  assert.strictEqual(buildUpdateChanges(owner, { status: 'suspended' }).ok, false);
});

test('buildUpdateChanges allows valid role + status transitions for staff', () => {
  const staff = { _id: '2', role: 'tenant_staff', status: 'active' };
  const r = buildUpdateChanges(staff, { role: 'tenant_admin', status: 'suspended' });
  assert.ok(r.ok);
  assert.strictEqual(r.changes.role, 'tenant_admin');
  assert.strictEqual(r.changes.status, 'suspended');
});

test('buildUpdateChanges rejects escalation to a privileged role', () => {
  const staff = { _id: '2', role: 'tenant_staff', status: 'active' };
  assert.strictEqual(buildUpdateChanges(staff, { role: 'super_admin' }).ok, false);
});

// ── delete guard ────────────────────────────────────────────────────────────

test('canDeleteEmployee blocks tenant_owner and self-deletion', () => {
  assert.strictEqual(canDeleteEmployee({ _id: '1', role: 'tenant_owner' }, '9').ok, false);
  assert.strictEqual(canDeleteEmployee({ _id: '9', role: 'tenant_staff' }, '9').ok, false);
  assert.strictEqual(canDeleteEmployee({ _id: '2', role: 'tenant_staff' }, '9').ok, true);
});
