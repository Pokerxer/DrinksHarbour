// server/__tests__/shift.payloads.test.js
//
// The request-shaped half of shift.helpers.js: what a shift-template or shift
// body is allowed to say, and how `?from=&to=` becomes an absolute window.
// Scheduling arithmetic itself is covered in shift.helpers.test.js.
const test = require('node:test');
const assert = require('node:assert');
const {
  MAX_GENERATION_DAYS,
  buildShiftTemplatePayload,
  buildShiftPayload,
  validateShiftTimes,
  parseRosterRange,
  statusesThatCanBecome,
} = require('../services/shift.helpers');

const ROLE = '507f1f77bcf86cd799439011';
const DEPT = '507f1f77bcf86cd799439031';
const EMP = '507f1f77bcf86cd799439021';
const LAGOS = 60;

const VALID_TEMPLATE = {
  name: 'Weekday morning bar',
  role: ROLE,
  startTime: '09:00',
  endTime: '17:00',
  daysOfWeek: [1, 2, 3, 4, 5],
};

// ── Shift template payload ───────────────────────────────────────────────────

test('buildShiftTemplatePayload accepts a complete template', () => {
  const out = buildShiftTemplatePayload({ ...VALID_TEMPLATE, breakMinutes: 30, department: DEPT });
  assert.ok(out.ok);
  assert.strictEqual(out.value.name, 'Weekday morning bar');
  assert.strictEqual(out.value.role, ROLE);
  assert.strictEqual(out.value.department, DEPT);
  assert.strictEqual(out.value.breakMinutes, 30);
  assert.strictEqual(out.value.isActive, true);
});

test('buildShiftTemplatePayload requires a name on create', () => {
  const { name, ...rest } = VALID_TEMPLATE;
  const out = buildShiftTemplatePayload(rest);
  assert.ok(!out.ok);
  assert.match(out.message, /name is required/i);
});

test('buildShiftTemplatePayload requires a role on create and refuses to clear it', () => {
  const { role, ...rest } = VALID_TEMPLATE;
  assert.ok(!buildShiftTemplatePayload(rest).ok);
  // A shift with no required role cannot be checked against anyone's
  // capabilities, so an explicit clear is refused on update too.
  const cleared = buildShiftTemplatePayload({ role: null }, { isUpdate: true });
  assert.ok(!cleared.ok);
  assert.match(cleared.message, /must require a role/i);
});

test('buildShiftTemplatePayload requires both ends of the clock on create', () => {
  const { endTime, ...rest } = VALID_TEMPLATE;
  const out = buildShiftTemplatePayload(rest);
  assert.ok(!out.ok);
  assert.match(out.message, /endTime is required/);
});

test('buildShiftTemplatePayload rejects a time that is not a clock time', () => {
  for (const bad of ['9am', '25:00', '09:60', '0900']) {
    const out = buildShiftTemplatePayload({ ...VALID_TEMPLATE, startTime: bad });
    assert.ok(!out.ok, `${bad} should be rejected`);
  }
});

test('buildShiftTemplatePayload allows an overnight template', () => {
  // endTime <= startTime is how "crosses midnight" is expressed; it is derived,
  // never a validation error.
  const out = buildShiftTemplatePayload({ ...VALID_TEMPLATE, startTime: '22:00', endTime: '06:00' });
  assert.ok(out.ok);
});

test('buildShiftTemplatePayload de-duplicates and sorts daysOfWeek', () => {
  const out = buildShiftTemplatePayload({ ...VALID_TEMPLATE, daysOfWeek: [5, 1, 5, 0] });
  assert.ok(out.ok);
  // A repeated day would otherwise generate the same shift twice.
  assert.deepStrictEqual(out.value.daysOfWeek, [0, 1, 5]);
});

test('buildShiftTemplatePayload rejects a day outside 0..6 or a non-list', () => {
  assert.ok(!buildShiftTemplatePayload({ ...VALID_TEMPLATE, daysOfWeek: [7] }).ok);
  assert.ok(!buildShiftTemplatePayload({ ...VALID_TEMPLATE, daysOfWeek: [-1] }).ok);
  assert.ok(!buildShiftTemplatePayload({ ...VALID_TEMPLATE, daysOfWeek: [1.5] }).ok);
  assert.ok(!buildShiftTemplatePayload({ ...VALID_TEMPLATE, daysOfWeek: 'mon' }).ok);
});

test('buildShiftTemplatePayload rejects negative break minutes and rounds the rest', () => {
  assert.ok(!buildShiftTemplatePayload({ ...VALID_TEMPLATE, breakMinutes: -5 }).ok);
  const out = buildShiftTemplatePayload({ ...VALID_TEMPLATE, breakMinutes: '30.4' });
  assert.ok(out.ok);
  assert.strictEqual(out.value.breakMinutes, 30);
});

test('buildShiftTemplatePayload validates colour but lets an empty string clear it', () => {
  assert.ok(!buildShiftTemplatePayload({ ...VALID_TEMPLATE, color: 'red' }).ok);
  const cleared = buildShiftTemplatePayload({ ...VALID_TEMPLATE, color: '' });
  assert.ok(cleared.ok);
  assert.strictEqual(cleared.value.color, '');
});

test('buildShiftTemplatePayload on update patches only what was sent', () => {
  const out = buildShiftTemplatePayload({ breakMinutes: 45 }, { isUpdate: true });
  assert.ok(out.ok);
  assert.deepStrictEqual(Object.keys(out.value), ['breakMinutes']);
  // isActive must NOT be defaulted on an update, or every edit silently
  // reactivates a template the admin turned off.
  assert.strictEqual('isActive' in out.value, false);
});

// ── Cycle recurrence on a template ───────────────────────────────────────────

const VALID_CYCLE = {
  ...VALID_TEMPLATE,
  recurrence: 'cycle',
  cycleLength: 2,
  cycleDays: [0],
  anchorDate: '2026-08-10',
};

test('buildShiftTemplatePayload accepts a cycle template and normalises its offsets', () => {
  const out = buildShiftTemplatePayload({ ...VALID_CYCLE, cycleLength: 4, cycleDays: [2, 0, 2] });
  assert.ok(out.ok);
  assert.strictEqual(out.value.recurrence, 'cycle');
  assert.strictEqual(out.value.cycleLength, 4);
  assert.deepStrictEqual(out.value.cycleDays, [0, 2]);
  assert.strictEqual(out.value.anchorDate, '2026-08-10');
});

test('buildShiftTemplatePayload defaults a template with no recurrence to weekly', () => {
  const out = buildShiftTemplatePayload(VALID_TEMPLATE);
  assert.ok(out.ok);
  assert.strictEqual(out.value.recurrence, 'weekly');
  // A weekly template carries an empty cycle rather than a half-set one.
  assert.strictEqual(out.value.anchorDate, null);
  assert.deepStrictEqual(out.value.cycleDays, []);
});

test('buildShiftTemplatePayload rejects a recurrence it does not know', () => {
  const out = buildShiftTemplatePayload({ ...VALID_TEMPLATE, recurrence: 'fortnightly' });
  assert.ok(!out.ok);
  assert.match(out.message, /recurrence/i);
});

test('buildShiftTemplatePayload requires the whole cycle when recurrence is cycle', () => {
  for (const missing of ['cycleLength', 'cycleDays', 'anchorDate']) {
    const body = { ...VALID_CYCLE };
    delete body[missing];
    const out = buildShiftTemplatePayload(body);
    assert.ok(!out.ok, `${missing} should be required`);
  }
});

test('buildShiftTemplatePayload rejects an offset outside the cycle', () => {
  assert.ok(!buildShiftTemplatePayload({ ...VALID_CYCLE, cycleDays: [2] }).ok);
  assert.ok(!buildShiftTemplatePayload({ ...VALID_CYCLE, cycleDays: [-1] }).ok);
  assert.ok(!buildShiftTemplatePayload({ ...VALID_CYCLE, cycleLength: 0 }).ok);
  assert.ok(!buildShiftTemplatePayload({ ...VALID_CYCLE, anchorDate: 'yesterday' }).ok);
});

test('buildShiftTemplatePayload switching a template back to weekly clears the cycle', () => {
  // Left in place, a stale anchor would silently resurrect the old rotation if
  // the template were ever switched back.
  const out = buildShiftTemplatePayload({ recurrence: 'weekly' }, { isUpdate: true });
  assert.ok(out.ok);
  assert.strictEqual(out.value.recurrence, 'weekly');
  assert.strictEqual(out.value.anchorDate, null);
  assert.deepStrictEqual(out.value.cycleDays, []);
  assert.strictEqual(out.value.cycleLength, null);
});

test('buildShiftTemplatePayload validates a cycle sent on its own in an update', () => {
  const out = buildShiftTemplatePayload(
    { recurrence: 'cycle', cycleLength: 3, cycleDays: [0, 1], anchorDate: '2026-09-01' },
    { isUpdate: true }
  );
  assert.ok(out.ok);
  assert.deepStrictEqual(out.value.cycleDays, [0, 1]);
});

// ── Shift payload ────────────────────────────────────────────────────────────

const VALID_SHIFT = {
  role: ROLE,
  start: '2026-08-10T08:00:00.000Z',
  end: '2026-08-10T16:00:00.000Z',
};

test('buildShiftPayload accepts an open shift with no employee', () => {
  const out = buildShiftPayload({ ...VALID_SHIFT, employee: null });
  assert.ok(out.ok);
  // Present and null — an open shift is a value, not a missing field.
  assert.strictEqual('employee' in out.value, true);
  assert.strictEqual(out.value.employee, null);
});

test('buildShiftPayload leaves an omitted employee out of the patch entirely', () => {
  const out = buildShiftPayload({ employee: undefined }, { isUpdate: true });
  assert.ok(out.ok);
  // Omitted must not read as "unassign", or every unrelated PATCH empties the
  // shift.
  assert.strictEqual('employee' in out.value, false);
});

test('buildShiftPayload requires role, start and end on create', () => {
  assert.match(buildShiftPayload({ start: VALID_SHIFT.start, end: VALID_SHIFT.end }).message, /role/i);
  assert.match(buildShiftPayload({ role: ROLE, end: VALID_SHIFT.end }).message, /start is required/);
  assert.match(buildShiftPayload({ role: ROLE, start: VALID_SHIFT.start }).message, /end is required/);
});

test('buildShiftPayload rejects an unparseable date and a junk ref', () => {
  assert.ok(!buildShiftPayload({ ...VALID_SHIFT, start: 'next tuesday' }).ok);
  assert.ok(!buildShiftPayload({ ...VALID_SHIFT, employee: 'not-an-id' }).ok);
});

test('buildShiftPayload converts dates to Date objects', () => {
  const out = buildShiftPayload({ ...VALID_SHIFT, employee: EMP });
  assert.ok(out.ok);
  assert.ok(out.value.start instanceof Date);
  assert.strictEqual(out.value.start.toISOString(), VALID_SHIFT.start);
  assert.strictEqual(out.value.employee, EMP);
});

// ── Time sanity ──────────────────────────────────────────────────────────────

test('validateShiftTimes refuses an end at or before the start', () => {
  const t = '2026-08-10T08:00:00.000Z';
  assert.ok(!validateShiftTimes(t, t).ok);
  assert.ok(!validateShiftTimes(t, '2026-08-10T07:00:00.000Z').ok);
  assert.ok(validateShiftTimes(t, '2026-08-10T16:00:00.000Z').ok);
});

// ── Roster range ─────────────────────────────────────────────────────────────

test('parseRosterRange rejects a missing, unparseable or inverted range', () => {
  assert.ok(!parseRosterRange({}, LAGOS).ok);
  assert.ok(!parseRosterRange({ from: '10/08/2026', to: '16/08/2026' }, LAGOS).ok);
  assert.ok(!parseRosterRange({ from: '2026-08-16', to: '2026-08-10' }, LAGOS).ok);
});

test('parseRosterRange spans local midnight to local midnight after `to`', () => {
  const r = parseRosterRange({ from: '2026-08-10', to: '2026-08-16' }, LAGOS);
  assert.ok(r.ok);
  // Lagos midnight is 23:00 UTC the previous day.
  assert.strictEqual(r.start.toISOString(), '2026-08-09T23:00:00.000Z');
  // Exclusive end, so a shift starting 23:30 on the 16th is still inside.
  assert.strictEqual(r.end.toISOString(), '2026-08-16T23:00:00.000Z');
  assert.ok(r.start < new Date('2026-08-16T22:30:00.000Z'));
});

test('parseRosterRange honours a different tenant offset', () => {
  const utc = parseRosterRange({ from: '2026-08-10', to: '2026-08-10' }, 0);
  assert.ok(utc.ok);
  assert.strictEqual(utc.start.toISOString(), '2026-08-10T00:00:00.000Z');
  assert.strictEqual(utc.end.toISOString(), '2026-08-11T00:00:00.000Z');
});

test(`parseRosterRange refuses a range longer than ${MAX_GENERATION_DAYS} days`, () => {
  const out = parseRosterRange({ from: '2026-01-01', to: '2026-12-31' }, LAGOS);
  assert.ok(!out.ok);
  assert.match(out.message, /at most/i);
  // The boundary itself is allowed.
  assert.ok(parseRosterRange({ from: '2026-01-01', to: '2026-04-02' }, LAGOS).ok);
});

// ── Bulk transitions ─────────────────────────────────────────────────────────

test('statusesThatCanBecome derives the publishable set from the transition table', () => {
  // The publish endpoint queries on this rather than hard-coding 'draft', so a
  // change to the table cannot leave the bulk move behind.
  assert.deepStrictEqual(statusesThatCanBecome('published'), ['draft']);
  assert.deepStrictEqual(statusesThatCanBecome('cancelled'), ['draft', 'published']);
  assert.deepStrictEqual(statusesThatCanBecome('draft'), []);
});
