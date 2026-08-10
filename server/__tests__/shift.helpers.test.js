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
  normaliseCycle,
  isCycleWorkDay,
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

test('crossesMidnight returns true when endDayOffset > 0 even with end after start', () => {
  // 08:40→09:00 with offset 1 = 24h 20m — ends on the next calendar day.
  assert.strictEqual(crossesMidnight('08:40', '09:00', 1), true);
  // Offset 0 falls back to the legacy heuristic.
  assert.strictEqual(crossesMidnight('08:40', '09:00', 0), false);
  assert.strictEqual(crossesMidnight('08:40', '09:00'), false);
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

test('shiftWindow places the end on the Nth day ahead when endDayOffset is set', () => {
  // 08:40 → 09:00, endDayOffset 1 = 24h 20m.
  const w = shiftWindow('2026-08-10', '08:40', '09:00', LAGOS, 1);
  assert.strictEqual(w.start.toISOString(), '2026-08-10T07:40:00.000Z');
  assert.strictEqual(w.end.toISOString(), '2026-08-11T08:00:00.000Z');
  // End is exactly 24h 20m after start.
  const duration = (w.end.getTime() - w.start.getTime()) / 60_000;
  assert.strictEqual(duration, 1460); // 24*60 + 20
});

test('shiftWindow with endDayOffset 0 falls back to the legacy heuristic', () => {
  // Same inputs but offset 0: endTime <= startTime triggers the next-day rule.
  const w = shiftWindow('2026-08-10', '22:00', '06:00', LAGOS, 0);
  assert.strictEqual(w.start.toISOString(), '2026-08-10T21:00:00.000Z');
  assert.strictEqual(w.end.toISOString(), '2026-08-11T05:00:00.000Z');
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

test('planShiftGeneration passes endDayOffset through to the window', () => {
  // A 24-hour template: 08:40 → 09:00, endDayOffset 1.
  const tpl = template({
    startTime: '08:40',
    endTime: '09:00',
    endDayOffset: 1,
    daysOfWeek: [1], // Monday
  });
  const plan = planShiftGeneration([tpl], {
    from: '2026-08-10', // Monday
    to: '2026-08-10',
    offsetMinutes: LAGOS,
    existing: [],
  });
  assert.strictEqual(plan.toCreate.length, 1);
  const shift = plan.toCreate[0];
  // End is 2026-08-11 09:00 Lagos = 2026-08-11T08:00 UTC.
  assert.strictEqual(shift.end.toISOString(), '2026-08-11T08:00:00.000Z');
  // Duration = 1460 min = 24h 20m.
  const duration = (shift.end.getTime() - shift.start.getTime()) / 60_000;
  assert.strictEqual(duration, 1460);
});

// ── Cycle recurrence ─────────────────────────────────────────────────────────
//
// A weekday list cannot express "one day on, one day off": a cycle whose length
// does not divide 7 changes phase every week. These tests pin the second kind of
// recurrence — offsets within a cycle of N days, anchored to a stored date.

test('normaliseCycle de-duplicates and sorts the worked offsets', () => {
  const out = normaliseCycle({ cycleLength: 4, cycleDays: [2, 0, 2], anchorDate: '2026-08-10' });
  assert.ok(out.ok);
  // Same reason normaliseDaysOfWeek sorts: an unsorted list with repeats
  // generated the same shift twice.
  assert.deepStrictEqual(out.value.cycleDays, [0, 2]);
  assert.strictEqual(out.value.cycleLength, 4);
  assert.strictEqual(out.value.anchorDate, '2026-08-10');
});

test('normaliseCycle rejects a cycle shorter than a day', () => {
  for (const bad of [0, -3, 1.5, 'two', null]) {
    const out = normaliseCycle({ cycleLength: bad, cycleDays: [0], anchorDate: '2026-08-10' });
    assert.ok(!out.ok, `cycleLength ${bad} should be rejected`);
  }
});

test('normaliseCycle rejects an offset that falls outside the cycle', () => {
  // In a 2-day cycle the only offsets that exist are 0 and 1.
  for (const bad of [2, -1, 1.5, 'one', undefined]) {
    const out = normaliseCycle({ cycleLength: 2, cycleDays: [bad], anchorDate: '2026-08-10' });
    assert.ok(!out.ok, `offset ${bad} should be rejected`);
  }
});

test('normaliseCycle accepts an empty cycle — it generates nothing, it is not "every day"', () => {
  const out = normaliseCycle({ cycleLength: 2, cycleDays: [], anchorDate: '2026-08-10' });
  assert.ok(out.ok);
  assert.deepStrictEqual(out.value.cycleDays, []);
});

test('normaliseCycle requires an anchor date it can actually parse', () => {
  for (const bad of [undefined, '', 'yesterday', '2026-8-10', '2026-13-40']) {
    const out = normaliseCycle({ cycleLength: 2, cycleDays: [0], anchorDate: bad });
    assert.ok(!out.ok, `anchor ${bad} should be rejected`);
    assert.match(out.message, /anchor/i);
  }
});

const ONE_ON_ONE_OFF = { cycleLength: 2, cycleDays: [0], anchorDate: '2026-08-10' };

test('isCycleWorkDay works the anchor day and then every other day', () => {
  assert.strictEqual(isCycleWorkDay('2026-08-10', ONE_ON_ONE_OFF), true);
  assert.strictEqual(isCycleWorkDay('2026-08-11', ONE_ON_ONE_OFF), false);
  assert.strictEqual(isCycleWorkDay('2026-08-12', ONE_ON_ONE_OFF), true);
  assert.strictEqual(isCycleWorkDay('2026-08-13', ONE_ON_ONE_OFF), false);
});

test('isCycleWorkDay resolves dates BEFORE the anchor', () => {
  // A manager backfilling last month is ordinary. JavaScript's % returns a
  // negative here, which would never match a cycleDay — floorMod is required.
  assert.strictEqual(isCycleWorkDay('2026-08-09', ONE_ON_ONE_OFF), false);
  assert.strictEqual(isCycleWorkDay('2026-08-08', ONE_ON_ONE_OFF), true);
  assert.strictEqual(isCycleWorkDay('2026-07-31', ONE_ON_ONE_OFF), true);
});

test('isCycleWorkDay changes weekday every week when the cycle does not divide 7', () => {
  // This is the whole reason cycles exist: one-on/one-off is Mon/Wed/Fri one
  // week and Sun/Tue/Thu the next, so no set of weekday flags can express it.
  assert.strictEqual(isCycleWorkDay('2026-08-10', ONE_ON_ONE_OFF), true); // Mon
  assert.strictEqual(isCycleWorkDay('2026-08-17', ONE_ON_ONE_OFF), false); // Mon, a week on
  assert.strictEqual(isCycleWorkDay('2026-08-16', ONE_ON_ONE_OFF), true); // Sun instead
});

test('isCycleWorkDay handles a 4-on/4-off rotation', () => {
  const cycle = { cycleLength: 8, cycleDays: [0, 1, 2, 3], anchorDate: '2026-08-10' };
  const worked = eachDateInRange('2026-08-10', '2026-08-25').filter((d) =>
    isCycleWorkDay(d, cycle)
  );
  assert.deepStrictEqual(worked, [
    '2026-08-10',
    '2026-08-11',
    '2026-08-12',
    '2026-08-13',
    '2026-08-18',
    '2026-08-19',
    '2026-08-20',
    '2026-08-21',
  ]);
});

test('isCycleWorkDay is false rather than throwing for an unusable cycle or date', () => {
  assert.strictEqual(isCycleWorkDay('2026-08-10', { cycleLength: 2, cycleDays: [] , anchorDate: '2026-08-10' }), false);
  assert.strictEqual(isCycleWorkDay('2026-08-10', { cycleLength: 0, cycleDays: [0], anchorDate: '2026-08-10' }), false);
  assert.strictEqual(isCycleWorkDay('not-a-date', ONE_ON_ONE_OFF), false);
  assert.strictEqual(isCycleWorkDay('2026-08-10', undefined), false);
});

// ── Generation from a cycle ──────────────────────────────────────────────────

const cycleTemplate = (over = {}) =>
  template({
    recurrence: 'cycle',
    cycleLength: 2,
    cycleDays: [0],
    anchorDate: '2026-08-10',
    // Deliberately empty: a cycle template must not be judged on weekdays at all.
    daysOfWeek: [],
    ...over,
  });

test('planShiftGeneration generates a one-on/one-off cycle, ignoring daysOfWeek', () => {
  const plan = planShiftGeneration([cycleTemplate()], {
    from: '2026-08-10',
    to: '2026-08-16',
    offsetMinutes: LAGOS,
    existing: [],
  });
  assert.deepStrictEqual(
    plan.toCreate.map((s) => s.date),
    ['2026-08-10', '2026-08-12', '2026-08-14', '2026-08-16']
  );
});

test('planShiftGeneration keeps the cycle phase when a range starts mid-cycle', () => {
  // The phase comes from the stored anchor, never from the range start — the
  // same dates come out whether the range begins on a worked day or an off one.
  const plan = planShiftGeneration([cycleTemplate()], {
    from: '2026-08-11', // an off day
    to: '2026-08-15',
    offsetMinutes: LAGOS,
    existing: [],
  });
  assert.deepStrictEqual(
    plan.toCreate.map((s) => s.date),
    ['2026-08-12', '2026-08-14']
  );
});

test('planShiftGeneration generates a cycle for dates before the anchor', () => {
  const plan = planShiftGeneration([cycleTemplate()], {
    from: '2026-08-05',
    to: '2026-08-09',
    offsetMinutes: LAGOS,
    existing: [],
  });
  assert.deepStrictEqual(
    plan.toCreate.map((s) => s.date),
    ['2026-08-06', '2026-08-08']
  );
});

test('planShiftGeneration stays idempotent for a cycle across overlapping ranges', () => {
  const tpl = cycleTemplate();
  const asStored = (s) => ({ template: 'tpl-1', start: s.start, status: 'draft' });

  const first = planShiftGeneration([tpl], {
    from: '2026-08-10',
    to: '2026-08-20',
    offsetMinutes: LAGOS,
    existing: [],
  });
  const second = planShiftGeneration([tpl], {
    from: '2026-08-15', // overlaps the first run
    to: '2026-08-25',
    offsetMinutes: LAGOS,
    existing: first.toCreate.map(asStored),
  });

  // Nothing in the overlap is created twice, and the two runs together equal
  // one run over the whole span.
  const combined = [...first.toCreate, ...second.toCreate].map((s) => s.date);
  const oneGo = planShiftGeneration([tpl], {
    from: '2026-08-10',
    to: '2026-08-25',
    offsetMinutes: LAGOS,
    existing: [],
  }).toCreate.map((s) => s.date);
  assert.deepStrictEqual(combined, oneGo);
  assert.strictEqual(new Set(combined).size, combined.length);
});

test('planShiftGeneration skips a cycle template with no worked offsets', () => {
  const plan = planShiftGeneration([cycleTemplate({ cycleDays: [] })], {
    from: '2026-08-10',
    to: '2026-08-16',
    offsetMinutes: LAGOS,
    existing: [],
  });
  assert.strictEqual(plan.toCreate.length, 0);
  assert.match(plan.skipped[0].reason, /cycle/i);
});

test('planShiftGeneration reports a cycle template with no anchor instead of guessing one', () => {
  // Guessing the phase from the range would break the idempotency guarantee.
  const plan = planShiftGeneration([cycleTemplate({ anchorDate: null })], {
    from: '2026-08-10',
    to: '2026-08-16',
    offsetMinutes: LAGOS,
    existing: [],
  });
  assert.strictEqual(plan.toCreate.length, 0);
  assert.match(plan.skipped[0].reason, /anchor/i);
});

test('planShiftGeneration leaves weekly templates exactly as they were', () => {
  const range = { from: '2026-08-10', to: '2026-08-23', offsetMinutes: LAGOS, existing: [] };
  // A stored template from before cycles existed has no `recurrence` at all.
  const legacy = planShiftGeneration([template({ daysOfWeek: [1, 3, 5] })], range);
  const explicit = planShiftGeneration(
    [template({ daysOfWeek: [1, 3, 5], recurrence: 'weekly' })],
    range
  );
  // Cycle fields present but unused must not leak into a weekly template.
  const noisy = planShiftGeneration(
    [
      template({
        daysOfWeek: [1, 3, 5],
        recurrence: 'weekly',
        cycleLength: 2,
        cycleDays: [0],
        anchorDate: '2026-08-11',
      }),
    ],
    range
  );

  const dates = (p) => p.toCreate.map((s) => s.date);
  assert.deepStrictEqual(dates(legacy), [
    '2026-08-10',
    '2026-08-12',
    '2026-08-14',
    '2026-08-17',
    '2026-08-19',
    '2026-08-21',
  ]);
  assert.deepStrictEqual(dates(explicit), dates(legacy));
  assert.deepStrictEqual(dates(noisy), dates(legacy));
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

// ── Generation and time off do not meet, on purpose ──────────────────────────
//
// The open question from the hardening spec: `checkAssignment` blocks somebody
// being ASSIGNED over approved leave, but `planShiftGeneration` never consults
// time off at all. That is not an oversight to be fixed — everything generation
// produces is an OPEN shift, so there is no employee for leave to be about. The
// slot on a day the usual person is away is exactly what somebody else needs to
// be able to see and cover.
//
// Locked in with a test because it looks like a missing feature, and "wiring
// time off into generation" would quietly stop the roster from showing the days
// that most need covering.

test('generation still creates the slot on a day somebody is on leave', () => {
  const tpl = {
    _id: 't1',
    name: 'Evening',
    role: 'r1',
    startTime: '17:00',
    endTime: '23:00',
    daysOfWeek: [1],
  };

  const { toCreate } = planShiftGeneration([tpl], {
    from: '2026-08-10',
    to: '2026-08-10',
    offsetMinutes: 60,
  });

  assert.strictEqual(toCreate.length, 1);
  // The reason leave cannot apply: nobody is on it yet.
  assert.strictEqual(toCreate[0].employee, null);
  assert.strictEqual(toCreate[0].status, 'draft');
});
