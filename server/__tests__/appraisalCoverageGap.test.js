const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { employeesAskedNothing } = require('../services/appraisal.helpers');

const oid = () => new mongoose.Types.ObjectId();

const FACILITIES = oid();
const ACCOUNTS = oid();

function section(title, departments, askOf = ['self', 'manager']) {
  return {
    title,
    departments,
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

test('no planned rows means no gap to report', () => {
  assert.deepEqual(employeesAskedNothing([section('Cleaning', [FACILITIES])], []), []);
  assert.deepEqual(employeesAskedNothing([section('Cleaning', [FACILITIES])], undefined), []);
});
