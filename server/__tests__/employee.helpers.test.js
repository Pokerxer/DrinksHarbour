// server/__tests__/employee.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  isValidPin,
  isValidEmail,
  sanitizeAvatar,
  sanitizePermissions,
  buildEmployeeFilter,
  buildCreatePayload,
  buildUpdateChanges,
  buildEmployeeProfile,
  validateManagerAssignment,
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

test('sanitizeAvatar normalises strings, objects and empties', () => {
  assert.deepStrictEqual(sanitizeAvatar('https://cdn/x.png'), {
    url: 'https://cdn/x.png',
  });
  assert.deepStrictEqual(
    sanitizeAvatar({ url: ' https://cdn/x.png ', publicId: ' emp/1 ' }),
    { url: 'https://cdn/x.png', publicId: 'emp/1' }
  );
  // url without a publicId drops the key rather than storing ''
  assert.deepStrictEqual(sanitizeAvatar({ url: 'https://cdn/x.png' }), {
    url: 'https://cdn/x.png',
  });
  // anything without a usable url clears (null)
  assert.strictEqual(sanitizeAvatar(''), null);
  assert.strictEqual(sanitizeAvatar(null), null);
  assert.strictEqual(sanitizeAvatar(undefined), null);
  assert.strictEqual(sanitizeAvatar({ publicId: 'only-id' }), null);
  assert.strictEqual(sanitizeAvatar({ url: '   ' }), null);
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

// ── HR profile sanitiser ─────────────────────────────────────────────────────

test('buildEmployeeProfile coerces types and validates enums', () => {
  const p = buildEmployeeProfile({
    personal: { legalName: '  Alice  ', gender: 'female', birthday: '1990-05-01' },
    family: { maritalStatus: 'single', dependentChildren: '2' },
    location: { homeWorkDistanceKm: '5.5', address: { city: 'Lagos' } },
    appSettings: { hourlyCost: '1500.50' },
    citizenship: { nonResident: 1 },
    attendance: { rfidBadge: '041667944074' },
  });
  assert.strictEqual(p.personal.legalName, 'Alice');
  assert.strictEqual(p.personal.gender, 'female');
  assert.ok(p.personal.birthday instanceof Date);
  assert.strictEqual(p.family.maritalStatus, 'single');
  assert.strictEqual(p.family.dependentChildren, 2);
  assert.strictEqual(p.location.homeWorkDistanceKm, 5.5);
  assert.strictEqual(p.location.address.city, 'Lagos');
  assert.strictEqual(p.appSettings.hourlyCost, 1500.5);
  assert.strictEqual(p.citizenship.nonResident, true);
  assert.strictEqual(p.attendance.rfidBadge, '041667944074');
});

test('buildEmployeeProfile rejects invalid enum values', () => {
  const p = buildEmployeeProfile({
    personal: { gender: 'alien' },
    family: { maritalStatus: 'complicated' },
  });
  assert.strictEqual(p.personal.gender, undefined);
  assert.strictEqual(p.family.maritalStatus, undefined);
});

test('buildEmployeeProfile drops unknown keys and empty bank rows', () => {
  const p = buildEmployeeProfile({
    bogusTop: 'x',
    privateContact: {
      email: 'PRIV@X.COM',
      bankAccounts: [{ bankName: 'GTB', accountNumber: '123' }, {}, { accountName: '   ' }],
    },
    planning: { roles: ['Bartender', '', '  '] },
  });
  assert.strictEqual(p.bogusTop, undefined);
  assert.strictEqual(p.privateContact.email, 'priv@x.com');
  assert.strictEqual(p.privateContact.bankAccounts.length, 1);
  assert.deepStrictEqual(p.planning.roles, ['Bartender']);
});

test('buildEmployeeProfile keeps the work section and nested address', () => {
  const p = buildEmployeeProfile({
    work: {
      department: ' Warehouse ',
      jobPosition: 'Warehouse Manager',
      jobTitle: 'Warehouse Manager',
      manager: 'abc123',
      workAddress: { company: 'CLOUD BAY', street: '39 Gana Street', city: '' },
      workLocation: 'Building 2',
      note: 'On probation',
      bogus: 'x',
    },
  });
  assert.strictEqual(p.work.department, 'Warehouse');
  assert.strictEqual(p.work.jobPosition, 'Warehouse Manager');
  assert.strictEqual(p.work.manager, 'abc123');
  assert.strictEqual(p.work.workAddress.company, 'CLOUD BAY');
  assert.strictEqual(p.work.workAddress.street, '39 Gana Street');
  assert.strictEqual(p.work.workAddress.city, undefined);
  assert.strictEqual(p.work.workLocation, 'Building 2');
  assert.strictEqual(p.work.bogus, undefined);
});

// validateManagerAssignment — graph: a → b → c (a's manager is b, b's is c).
const GRAPH = new Map([
  ['a', 'b'],
  ['b', 'c'],
  ['c', ''],
  ['d', ''],
]);

test('validateManagerAssignment allows no manager (create or clear)', () => {
  assert.strictEqual(validateManagerAssignment('', { managerOf: GRAPH }).ok, true);
  assert.strictEqual(
    validateManagerAssignment(undefined, { selfId: 'a', managerOf: GRAPH }).ok,
    true
  );
});

test('validateManagerAssignment requires an existing tenant employee', () => {
  const r = validateManagerAssignment('ghost', { selfId: 'd', managerOf: GRAPH });
  assert.strictEqual(r.ok, false);
  assert.match(r.message, /existing employee/i);
});

test('validateManagerAssignment rejects self-management', () => {
  const r = validateManagerAssignment('a', { selfId: 'a', managerOf: GRAPH });
  assert.strictEqual(r.ok, false);
  assert.match(r.message, /own manager/i);
});

test('validateManagerAssignment rejects a reporting cycle', () => {
  // c reporting to a would close a→b→c→a.
  const r = validateManagerAssignment('a', { selfId: 'c', managerOf: GRAPH });
  assert.strictEqual(r.ok, false);
  assert.match(r.message, /cycle/i);
});

test('validateManagerAssignment accepts a valid manager', () => {
  // d (no reports) reporting to a is fine.
  assert.strictEqual(
    validateManagerAssignment('a', { selfId: 'd', managerOf: GRAPH }).ok,
    true
  );
  // On create (no self) any existing employee is allowed.
  assert.strictEqual(
    validateManagerAssignment('b', { selfId: null, managerOf: GRAPH }).ok,
    true
  );
});

test('validateManagerAssignment handles ObjectId-like values and a missing graph', () => {
  assert.strictEqual(
    validateManagerAssignment('a', { selfId: { toString: () => 'd' }, managerOf: GRAPH }).ok,
    true
  );
  // No graph supplied → manager can't be proven to exist → rejected.
  assert.strictEqual(validateManagerAssignment('a', {}).ok, false);
});

test('buildEmployeeProfile tolerates non-object input', () => {
  assert.deepStrictEqual(buildEmployeeProfile(null), {});
  assert.deepStrictEqual(buildEmployeeProfile(undefined), {});
  assert.deepStrictEqual(buildEmployeeProfile('nope'), {});
});
