// server/__tests__/orgStructure.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  EMPLOYMENT_TYPES,
  orgNameKey,
  buildNameIndex,
  buildOrgFilter,
  buildDepartmentPayload,
  buildJobPositionPayload,
  buildEmployeeRolePayload,
  validateParentAssignment,
  describeDeleteBlockers,
} = require('../services/orgStructure.helpers');

const TENANT = 'tenant-1';
const OID = '507f1f77bcf86cd799439011';
const OID2 = '507f1f77bcf86cd799439012';

// ── Name normalisation ──────────────────────────────────────────────────────

test('orgNameKey folds case and surrounding whitespace', () => {
  assert.strictEqual(orgNameKey('  Sales '), 'sales');
  assert.strictEqual(orgNameKey('SALES'), 'sales');
  // Interior whitespace collapses too, so "Front  Desk" and "Front Desk" are
  // the same department rather than two rows the migration cannot merge.
  assert.strictEqual(orgNameKey('Front  Desk'), 'front desk');
  assert.strictEqual(orgNameKey(''), '');
  assert.strictEqual(orgNameKey(null), '');
});

test('buildNameIndex maps normalised names to records, first write wins', () => {
  const idx = buildNameIndex([
    { _id: OID, name: 'Sales' },
    { _id: OID2, name: 'sales' },
  ]);
  assert.strictEqual(idx.get('sales')._id, OID);
  assert.strictEqual(idx.size, 1);
});

// ── Filters ─────────────────────────────────────────────────────────────────

test('buildOrgFilter always scopes to the tenant', () => {
  assert.deepStrictEqual(buildOrgFilter(TENANT), { tenant: TENANT });
});

test('buildOrgFilter applies isActive only when explicitly boolean-ish', () => {
  assert.strictEqual(buildOrgFilter(TENANT, { isActive: 'true' }).isActive, true);
  assert.strictEqual(buildOrgFilter(TENANT, { isActive: 'false' }).isActive, false);
  // Absent means "both", not "active only" — an admin looking for something to
  // reactivate must be able to see the inactive rows.
  assert.ok(!('isActive' in buildOrgFilter(TENANT, {})));
});

test('buildOrgFilter escapes regex metacharacters in search', () => {
  const f = buildOrgFilter(TENANT, { search: 'a.b' });
  assert.ok(f.$or.some((c) => c.name && c.name.test('a.b')));
  assert.ok(!f.$or.some((c) => c.name && c.name.test('axb')));
});

test('buildOrgFilter scopes by department when given a usable id', () => {
  assert.strictEqual(buildOrgFilter(TENANT, { department: OID }).department, OID);
  assert.ok(!('department' in buildOrgFilter(TENANT, { department: 'not-an-id' })));
});

// ── Department payload ──────────────────────────────────────────────────────

test('buildDepartmentPayload requires a name on create', () => {
  const r = buildDepartmentPayload({}, { isUpdate: false });
  assert.strictEqual(r.ok, false);
  assert.match(r.message, /name/i);
});

test('buildDepartmentPayload trims and keeps optional fields off when unset', () => {
  const r = buildDepartmentPayload({ name: '  Sales  ' }, { isUpdate: false });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value.name, 'Sales');
  assert.ok(!('parent' in r.value));
  assert.strictEqual(r.value.isActive, true);
});

test('buildDepartmentPayload validates colour as a hex triple or sextuple', () => {
  assert.strictEqual(buildDepartmentPayload({ name: 'A', color: '#b20202' }).value.color, '#b20202');
  assert.strictEqual(buildDepartmentPayload({ name: 'A', color: '#FFF' }).value.color, '#FFF');
  assert.strictEqual(buildDepartmentPayload({ name: 'A', color: 'red' }).ok, false);
  // Explicit empty clears it rather than failing validation.
  assert.strictEqual(buildDepartmentPayload({ name: 'A', color: '' }).value.color, '');
});

test('buildDepartmentPayload rejects a malformed parent or manager id', () => {
  assert.strictEqual(buildDepartmentPayload({ name: 'A', parent: 'nope' }).ok, false);
  assert.strictEqual(buildDepartmentPayload({ name: 'A', manager: 'nope' }).ok, false);
  // Null/'' explicitly clears the ref.
  assert.strictEqual(buildDepartmentPayload({ name: 'A', manager: '' }).value.manager, null);
});

test('buildDepartmentPayload on update omits fields the client did not send', () => {
  const r = buildDepartmentPayload({ code: 'SLS' }, { isUpdate: true });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(Object.keys(r.value), ['code']);
});

test('buildDepartmentPayload on update rejects an empty name', () => {
  const r = buildDepartmentPayload({ name: '   ' }, { isUpdate: true });
  assert.strictEqual(r.ok, false);
});

// ── Job position payload ────────────────────────────────────────────────────

test('buildJobPositionPayload defaults employmentType and validates the enum', () => {
  const ok = buildJobPositionPayload({ name: 'Cashier' });
  assert.strictEqual(ok.value.employmentType, 'full_time');
  assert.ok(EMPLOYMENT_TYPES.includes(ok.value.employmentType));
  assert.strictEqual(buildJobPositionPayload({ name: 'Cashier', employmentType: 'gig' }).ok, false);
});

test('buildJobPositionPayload rejects a negative headcount', () => {
  assert.strictEqual(buildJobPositionPayload({ name: 'A', expectedHeadcount: -1 }).ok, false);
  assert.strictEqual(buildJobPositionPayload({ name: 'A', expectedHeadcount: '3' }).value.expectedHeadcount, 3);
});

// ── Employee role payload ───────────────────────────────────────────────────

test('buildEmployeeRolePayload rejects a negative hourly cost', () => {
  assert.strictEqual(buildEmployeeRolePayload({ name: 'Bartender', hourlyCost: -5 }).ok, false);
  assert.strictEqual(buildEmployeeRolePayload({ name: 'Bartender', hourlyCost: 12.5 }).value.hourlyCost, 12.5);
});

test('buildEmployeeRolePayload requires a name', () => {
  assert.strictEqual(buildEmployeeRolePayload({ name: '' }).ok, false);
});

// ── Parent (nesting) cycles ─────────────────────────────────────────────────

test('validateParentAssignment accepts an empty parent', () => {
  assert.strictEqual(validateParentAssignment('', { parentOf: new Map() }).ok, true);
});

test('validateParentAssignment rejects an unknown parent', () => {
  const r = validateParentAssignment(OID, { selfId: OID2, parentOf: new Map() });
  assert.strictEqual(r.ok, false);
  assert.match(r.message, /existing department/i);
});

test('validateParentAssignment rejects self-parenting', () => {
  const graph = new Map([[OID, '']]);
  const r = validateParentAssignment(OID, { selfId: OID, parentOf: graph });
  assert.strictEqual(r.ok, false);
  assert.match(r.message, /own parent/i);
});

test('validateParentAssignment rejects a nesting cycle', () => {
  // OID's parent is OID2; making OID2's parent OID closes the loop.
  const graph = new Map([
    [OID, OID2],
    [OID2, ''],
  ]);
  const r = validateParentAssignment(OID, { selfId: OID2, parentOf: graph });
  assert.strictEqual(r.ok, false);
  assert.match(r.message, /cycle/i);
});

test('validateParentAssignment terminates on a pre-existing cycle', () => {
  const a = OID;
  const b = OID2;
  const graph = new Map([
    [a, b],
    [b, a],
  ]);
  // Neither walk should hang; the `seen` guard must break out.
  assert.strictEqual(validateParentAssignment(a, { selfId: 'other', parentOf: graph }).ok, true);
});

// ── Delete guards ───────────────────────────────────────────────────────────

test('describeDeleteBlockers allows deletion when nothing references the row', () => {
  assert.strictEqual(describeDeleteBlockers({}).ok, true);
  assert.strictEqual(describeDeleteBlockers({ employees: 0, positions: 0 }).ok, true);
});

test('describeDeleteBlockers names every blocker and its count', () => {
  const r = describeDeleteBlockers({ employees: 3, positions: 2, children: 1 });
  assert.strictEqual(r.ok, false);
  assert.match(r.message, /3 employees/);
  assert.match(r.message, /2 job positions/);
  assert.match(r.message, /1 sub-department/);
  // The message must tell the admin what to do instead, or the 409 is a
  // dead end.
  assert.match(r.message, /deactivate/i);
});

test('describeDeleteBlockers singularises counts of one', () => {
  assert.match(describeDeleteBlockers({ employees: 1 }).message, /1 employee\b/);
});
