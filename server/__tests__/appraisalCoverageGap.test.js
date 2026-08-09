const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { employeesAskedNothing } = require('../services/appraisal.helpers');

const oid = () => new mongoose.Types.ObjectId();

const FACILITIES = oid();
const ACCOUNTS = oid();

const CASHIER = oid();
const ATTENDANT = oid();

function section(title, departments, askOf = ['self', 'manager'], roles = []) {
  return {
    title,
    departments,
    roles,
    questions: [{ _id: oid(), type: 'rating', label: `${title} Q`, askOf }],
  };
}

test('an employee in a department the form covers is not reported', () => {
  const rows = [{ employee: oid(), manager: oid(), department: FACILITIES }];
  assert.deepEqual(
    employeesAskedNothing([section('Cleaning', [FACILITIES])], rows),
    []
  );
});

test('an employee in a department NO section covers is reported', () => {
  const employee = oid();
  const rows = [{ employee, manager: oid(), department: ACCOUNTS }];
  const gap = employeesAskedNothing([section('Cleaning', [FACILITIES])], rows);
  assert.equal(gap.length, 1);
  assert.equal(String(gap[0].employee), String(employee));
  assert.equal(String(gap[0].department), String(ACCOUNTS));
});

test('an employee with NO department at all is reported — a scoped section can never reach them', () => {
  const rows = [{ employee: oid(), manager: oid(), department: null }];
  assert.equal(
    employeesAskedNothing([section('Cleaning', [FACILITIES])], rows).length,
    1
  );
});

test('an unscoped section covers everybody, including an employee with no department', () => {
  const rows = [
    { employee: oid(), manager: oid(), department: null },
    { employee: oid(), manager: oid(), department: ACCOUNTS },
  ];
  assert.deepEqual(employeesAskedNothing([section('General', [])], rows), []);
});

test('a section that reaches the department but asks only PEERS still leaves the pair with nothing to answer', () => {
  const rows = [{ employee: oid(), manager: oid(), department: FACILITIES }];
  const sections = [section('Peer only', [FACILITIES], ['peer'])];
  assert.equal(employeesAskedNothing(sections, rows).length, 1);
});

test('a manager-only section is enough — the appraisal still gets assessed', () => {
  const rows = [{ employee: oid(), manager: oid(), department: FACILITIES }];
  const sections = [section('Manager only', [FACILITIES], ['manager'])];
  assert.deepEqual(employeesAskedNothing(sections, rows), []);
});

test('reports every uncovered employee, not just the first', () => {
  const rows = [
    { employee: oid(), manager: oid(), department: ACCOUNTS },
    { employee: oid(), manager: oid(), department: FACILITIES },
    { employee: oid(), manager: oid(), department: null },
  ];
  assert.equal(
    employeesAskedNothing([section('Cleaning', [FACILITIES])], rows).length,
    2
  );
});

test('a form with no sections at all leaves everyone with nothing', () => {
  const rows = [{ employee: oid(), manager: oid(), department: FACILITIES }];
  assert.equal(employeesAskedNothing([], rows).length, 1);
  assert.equal(employeesAskedNothing(undefined, rows).length, 1);
});

// Roles are the second way a form goes silently empty, and the more likely
// one: a department everybody can see is missing is easier to notice than a
// role nobody remembered to set on an employee record.

test('an employee in the right department but holding no role is reported when every section is role-scoped', () => {
  const employee = oid();
  const rows = [{ employee, manager: oid(), department: FACILITIES, roles: [] }];
  const sections = [section('Cashiering', [FACILITIES], ['self', 'manager'], [CASHIER])];
  const gap = employeesAskedNothing(sections, rows);
  assert.equal(gap.length, 1);
  assert.equal(String(gap[0].employee), String(employee));
});

test('a row with no roles key at all is treated as holding none, not as holding everything', () => {
  const rows = [{ employee: oid(), manager: oid(), department: FACILITIES }];
  const sections = [section('Cashiering', [FACILITIES], ['self', 'manager'], [CASHIER])];
  assert.equal(employeesAskedNothing(sections, rows).length, 1);
});

test('the holder of a scoped role is covered, and the holder of another role is not', () => {
  const attendant = oid();
  const rows = [
    { employee: oid(), manager: oid(), department: FACILITIES, roles: [CASHIER] },
    { employee: attendant, manager: oid(), department: FACILITIES, roles: [ATTENDANT] },
  ];
  const sections = [section('Cashiering', [FACILITIES], ['self', 'manager'], [CASHIER])];
  const gap = employeesAskedNothing(sections, rows);
  assert.equal(gap.length, 1);
  assert.equal(String(gap[0].employee), String(attendant));
});

test('a department-wide section rescues a role-less employee its role blocks miss', () => {
  // The shape the Retail form takes: a shared core everyone in the department
  // answers, plus a block per role. Nobody in the department opens an empty
  // form, whatever their role record says.
  const rows = [{ employee: oid(), manager: oid(), department: FACILITIES, roles: [] }];
  const sections = [
    section('Shared core', [FACILITIES]),
    section('Cashiering', [FACILITIES], ['self', 'manager'], [CASHIER]),
  ];
  assert.deepEqual(employeesAskedNothing(sections, rows), []);
});

test('a role-scoped section reaches a holder in ANY department only if it names no department', () => {
  const rows = [{ employee: oid(), manager: oid(), department: ACCOUNTS, roles: [ATTENDANT] }];
  assert.deepEqual(
    employeesAskedNothing([section('Attendants everywhere', [], ['self', 'manager'], [ATTENDANT])], rows),
    []
  );
  assert.equal(
    employeesAskedNothing(
      [section('Facilities attendants', [FACILITIES], ['self', 'manager'], [ATTENDANT])],
      rows
    ).length,
    1
  );
});

test('no planned rows means no gap to report', () => {
  assert.deepEqual(employeesAskedNothing([section('Cleaning', [FACILITIES])], []), []);
  assert.deepEqual(employeesAskedNothing([section('Cleaning', [FACILITIES])], undefined), []);
});
