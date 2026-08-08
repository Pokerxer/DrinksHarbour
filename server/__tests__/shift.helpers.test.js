// server/__tests__/shift.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  SHIFT_STATUSES,
  parseTimeOfDay,
  formatTimeOfDay,
  crossesMidnight,
  shiftWindow,
  shiftDurationMinutes,
  eachDateInRange,
  planShiftGeneration,
  findOverlaps,
  checkAssignment,
  summariseRoster,
  canTransitionShift,
  tenantOffsetMinutes,
  tenantToday,
} = require('../services/shift.helpers');

const ROLE = '507f1f77bcf86cd799439011';
const OTHER_ROLE = '507f1f77bcf86cd799439012';
const EMP = '507f1f77bcf86cd799439021';
const EMP2 = '507f1f77bcf86cd799439022';

// Lagos is UTC+1 year-round; +60 is the default offset everywhere below.
const LAGOS = 60;

// ── Time of day ──────────────────────────────────────────────────────────────

test('parseTimeOfDay converts HH:MM to minutes past midnight', () => {
  assert.strictEqual(parseTimeOfDay('00:00'), 0);
  assert.strictEqual(parseTimeOfDay('09:30'), 570);
  assert.strictEqual(parseTimeOfDay('23:59'), 1439);
});

test('parseTimeOfDay rejects anything that is not a real clock time', () => {
  for (const bad of ['24:00', '09:60', '9:00am', '', '0930', null, undefined, '25:10']) {
    assert.strictEqual(parseTimeOfDay(bad), null, `expected ${bad} to be rejected`);
  }
});

test('formatTimeOfDay round-trips parseTimeOfDay', () => {
  assert.strictEqual(formatTimeOfDay(570), '09:30');
  assert.strictEqual(formatTimeOfDay(0), '00:00');
  assert.strictEqual(formatTimeOfDay(parseTimeOfDay('23:05')), '23:05');
});

test('crossesMidnight is true when the end is at or before the start', () => {
  assert.strictEqual(crossesMidnight('09:00', '17:00'), false);
  assert.strictEqual(crossesMidnight('22:00', '06:00'), true);
  // Equal times mean a full 24 hours, not a zero-length shift — a bar's
  // "10:00 to 10:00" is an all-day cover, and zero-length is never intended.
  assert.strictEqual(crossesMidnight('10:00', '10:00'), true);
});

// ── Windows ──────────────────────────────────────────────────────────────────

test('shiftWindow builds a UTC window from a local date and time', () => {
  const w = shiftWindow('2026-08-10', '09:00', '17:00', LAGOS);
  // 09:00 in UTC+1 is 08:00 UTC.
  assert.strictEqual(w.start.toISOString(), '2026-08-10T08:00:00.000Z');
  assert.strictEqual(w.end.toISOString(), '2026-08-10T16:00:00.000Z');
});

test('shiftWindow rolls the end into the next day when the shift crosses midnight', () => {
  const w = shiftWindow('2026-08-10', '22:00', '06:00', LAGOS);
  assert.strictEqual(w.start.toISOString(), '2026-08-10T21:00:00.000Z');
  assert.strictEqual(w.end.toISOString(), '2026-08-11T05:00:00.000Z');
  assert.ok(w.end > w.start);
});

test('shiftWindow returns null for an unusable date or time', () => {
  assert.strictEqual(shiftWindow('not-a-date', '09:00', '17:00', LAGOS), null);
  assert.strictEqual(shiftWindow('2026-08-10', '99:00', '17:00', LAGOS), null);
});

test('shiftDurationMinutes subtracts the unpaid break', () => {
  const w = shiftWindow('2026-08-10', '09:00', '17:00', LAGOS);
  assert.strictEqual(shiftDurationMinutes({ ...w, breakMinutes: 0 }), 480);
  assert.strictEqual(shiftDurationMinutes({ ...w, breakMinutes: 60 }), 420);
});

test('shiftDurationMinutes never returns a negative duration', () => {
  const w = shiftWindow('2026-08-10', '09:00', '10:00', LAGOS);
  // A break longer than the shift is bad data, not negative worked time.
  assert.strictEqual(shiftDurationMinutes({ ...w, breakMinutes: 999 }), 0);
});

// ── Date ranges ──────────────────────────────────────────────────────────────

test('eachDateInRange is inclusive of both ends', () => {
  assert.deepStrictEqual(eachDateInRange('2026-08-10', '2026-08-12'), [
    '2026-08-10',
    '2026-08-11',
    '2026-08-12',
  ]);
});

test('eachDateInRange returns empty when the range is inverted', () => {
  assert.deepStrictEqual(eachDateInRange('2026-08-12', '2026-08-10'), []);
});

test('eachDateInRange is capped so one request cannot generate a year of shifts', () => {
  const out = eachDateInRange('2026-01-01', '2027-01-01');
  assert.ok(out.length <= 92, `expected the range to be capped, got ${out.length}`);
});

// ── Generation ───────────────────────────────────────────────────────────────

const template = (over = {}) => ({
  _id: 'tpl-1',
  name: 'Morning bar',
  role: ROLE,
  department: null,
  startTime: '09:00',
  endTime: '17:00',
  breakMinutes: 30,
  // 2026-08-10 is a Monday.
  daysOfWeek: [1],
  isActive: true,
  ...over,
});

test('planShiftGeneration creates one shift per matching weekday', () => {
  const plan = planShiftGeneration([template({ daysOfWeek: [1, 3] })], {
    from: '2026-08-10',
    to: '2026-08-16',
    offsetMinutes: LAGOS,
    existing: [],
  });
  assert.strictEqual(plan.toCreate.length, 2);
  assert.deepStrictEqual(
    plan.toCreate.map((s) => s.date),
    ['2026-08-10', '2026-08-12']
  );
});

test('planShiftGeneration produces OPEN shifts carrying the required role', () => {
  const plan = planShiftGeneration([template()], {
    from: '2026-08-10',
    to: '2026-08-10',
    offsetMinutes: LAGOS,
    existing: [],
  });
  const shift = plan.toCreate[0];
  // Open by design: the roster is drafted first, then filled.
  assert.strictEqual(shift.employee, null);
  assert.strictEqual(shift.role, ROLE);
  assert.strictEqual(shift.status, 'draft');
  assert.strictEqual(shift.breakMinutes, 30);
});

test('planShiftGeneration skips inactive templates', () => {
  const plan = planShiftGeneration([template({ isActive: false })], {
    from: '2026-08-10',
    to: '2026-08-10',
    offsetMinutes: LAGOS,
    existing: [],
  });
  assert.strictEqual(plan.toCreate.length, 0);
  assert.strictEqual(plan.skipped.length, 1);
  assert.match(plan.skipped[0].reason, /inactive/i);
});

test('planShiftGeneration is idempotent — a re-run creates nothing', () => {
  const opts = { from: '2026-08-10', to: '2026-08-10', offsetMinutes: LAGOS, existing: [] };
  const first = planShiftGeneration([template()], opts);
  const second = planShiftGeneration([template()], {
    ...opts,
    // Feed the first run's output back in as what is already stored.
    existing: first.toCreate.map((s) => ({
      template: 'tpl-1',
      start: s.start,
      status: 'draft',
    })),
  });
  assert.strictEqual(first.toCreate.length, 1);
  assert.strictEqual(second.toCreate.length, 0);
  assert.match(second.skipped[0].reason, /already/i);
});

test('planShiftGeneration reports a template with an unusable time instead of throwing', () => {
  const plan = planShiftGeneration([template({ startTime: '99:99' })], {
    from: '2026-08-10',
    to: '2026-08-10',
    offsetMinutes: LAGOS,
    existing: [],
  });
  assert.strictEqual(plan.toCreate.length, 0);
  assert.match(plan.skipped[0].reason, /time/i);
});

// ── Overlaps ─────────────────────────────────────────────────────────────────

const win = (from, to) => shiftWindow('2026-08-10', from, to, LAGOS);

test('findOverlaps catches a partial overlap', () => {
  const existing = [{ _id: 'a', employee: EMP, ...win('09:00', '17:00') }];
  const hits = findOverlaps({ employee: EMP, ...win('16:00', '20:00') }, existing);
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0]._id, 'a');
});

test('findOverlaps treats the window as half-open, so back-to-back shifts are fine', () => {
  const existing = [{ _id: 'a', employee: EMP, ...win('09:00', '17:00') }];
  // Starting exactly when the last one ends is a legal double shift.
  assert.deepStrictEqual(findOverlaps({ employee: EMP, ...win('17:00', '21:00') }, existing), []);
});

test('findOverlaps only considers the same employee', () => {
  const existing = [{ _id: 'a', employee: EMP2, ...win('09:00', '17:00') }];
  assert.deepStrictEqual(findOverlaps({ employee: EMP, ...win('09:00', '17:00') }, existing), []);
});

test('findOverlaps ignores open shifts and the shift being edited', () => {
  const existing = [
    { _id: 'open', employee: null, ...win('09:00', '17:00') },
    { _id: 'self', employee: EMP, ...win('09:00', '17:00') },
    { _id: 'cancelled', employee: EMP, status: 'cancelled', ...win('09:00', '17:00') },
  ];
  const hits = findOverlaps(
    { _id: 'self', employee: EMP, ...win('10:00', '12:00') },
    existing
  );
  assert.deepStrictEqual(hits, []);
});

test('findOverlaps returns nothing for an unassigned candidate', () => {
  const existing = [{ _id: 'a', employee: EMP, ...win('09:00', '17:00') }];
  assert.deepStrictEqual(findOverlaps({ employee: null, ...win('09:00', '17:00') }, existing), []);
});

// ── Assignment ───────────────────────────────────────────────────────────────

const employee = (over = {}) => ({
  _id: EMP,
  status: 'active',
  employeeProfile: { planning: { roles: [ROLE] } },
  ...over,
});

test('checkAssignment accepts a qualified, free employee', () => {
  const r = checkAssignment({ role: ROLE, ...win('09:00', '17:00') }, employee(), {
    shifts: [],
    timeOff: [],
  });
  assert.strictEqual(r.ok, true);
});

test('checkAssignment blocks an unqualified employee, and force overrides', () => {
  const shift = { role: OTHER_ROLE, ...win('09:00', '17:00') };
  const blocked = checkAssignment(shift, employee(), { shifts: [], timeOff: [] });
  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.code, 'role_mismatch');

  const forced = checkAssignment(shift, employee(), { shifts: [], timeOff: [], force: true });
  assert.strictEqual(forced.ok, true);
  // Overriding is allowed but must not be silent.
  assert.ok(forced.warnings.some((w) => w.code === 'role_mismatch'));
});

test('checkAssignment blocks a double-booking, and force does NOT override it', () => {
  const existing = [{ _id: 'a', employee: EMP, ...win('09:00', '17:00') }];
  const shift = { role: ROLE, ...win('16:00', '20:00') };
  const r = checkAssignment(shift, employee(), { shifts: existing, timeOff: [], force: true });
  // A person cannot be in two places at once — unlike a role mismatch, this is
  // not a judgement call an admin may override.
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'overlap');
});

test('checkAssignment blocks an inactive employee', () => {
  const r = checkAssignment({ role: ROLE, ...win('09:00', '17:00') }, employee({ status: 'suspended' }), {
    shifts: [],
    timeOff: [],
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'inactive');
});

test('checkAssignment blocks over approved time off, ignoring pending requests', () => {
  const approved = [
    {
      status: 'approved',
      startDate: new Date('2026-08-10T00:00:00.000Z'),
      endDate: new Date('2026-08-11T23:59:59.999Z'),
    },
  ];
  const shift = { role: ROLE, ...win('09:00', '17:00') };
  assert.strictEqual(
    checkAssignment(shift, employee(), { shifts: [], timeOff: approved }).code,
    'time_off'
  );
  // Pending is not yet a commitment.
  const pending = [{ ...approved[0], status: 'pending' }];
  assert.strictEqual(checkAssignment(shift, employee(), { shifts: [], timeOff: pending }).ok, true);
});

// ── Roster summary ───────────────────────────────────────────────────────────

test('summariseRoster counts open vs assigned and totals scheduled hours', () => {
  const s = summariseRoster([
    { employee: EMP, status: 'published', breakMinutes: 0, ...win('09:00', '17:00') },
    { employee: null, status: 'draft', breakMinutes: 0, ...win('09:00', '13:00') },
    { employee: EMP2, status: 'cancelled', breakMinutes: 0, ...win('09:00', '17:00') },
  ]);
  assert.strictEqual(s.total, 2);
  assert.strictEqual(s.open, 1);
  assert.strictEqual(s.assigned, 1);
  assert.strictEqual(s.draft, 1);
  assert.strictEqual(s.published, 1);
  // Cancelled shifts are excluded from every count and from the hours.
  assert.strictEqual(s.scheduledHours, 12);
});

// ── Status transitions ───────────────────────────────────────────────────────

test('canTransitionShift allows draft→published and either→cancelled', () => {
  assert.ok(canTransitionShift('draft', 'published'));
  assert.ok(canTransitionShift('draft', 'cancelled'));
  assert.ok(canTransitionShift('published', 'cancelled'));
});

test('canTransitionShift refuses to un-publish or revive a cancelled shift', () => {
  // Staff have already been told they are working it; retracting silently is
  // how someone ends up not turning up.
  assert.ok(!canTransitionShift('published', 'draft'));
  assert.ok(!canTransitionShift('cancelled', 'draft'));
  assert.ok(!canTransitionShift('cancelled', 'published'));
});

test('SHIFT_STATUSES is the single source of truth for the enum', () => {
  assert.deepStrictEqual(SHIFT_STATUSES, ['draft', 'published', 'cancelled']);
});

// ── Tenant clock ─────────────────────────────────────────────────────────────

test('tenantOffsetMinutes reads the tenant, and falls back to Lagos', () => {
  assert.strictEqual(tenantOffsetMinutes({ utcOffsetMinutes: -300 }), -300);
  assert.strictEqual(tenantOffsetMinutes({ settings: { utcOffsetMinutes: 0 } }), 0);
  // Zero is a real offset, not "unset" — it must survive the fallback.
  assert.strictEqual(tenantOffsetMinutes({ utcOffsetMinutes: 0 }), 0);
  assert.strictEqual(tenantOffsetMinutes(undefined), LAGOS);
  assert.strictEqual(tenantOffsetMinutes({ utcOffsetMinutes: 'nonsense' }), LAGOS);
});

test('tenantToday is the tenant calendar day, not the process one', () => {
  // 23:30 UTC on the 10th is already the 11th in Lagos, and still the 10th in
  // UTC — which is exactly why the offset is passed rather than read.
  const late = Date.parse('2026-08-10T23:30:00.000Z');
  assert.strictEqual(tenantToday(LAGOS, late), '2026-08-11');
  assert.strictEqual(tenantToday(0, late), '2026-08-10');
});
