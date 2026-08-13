// server/__tests__/shift.helpers.test.js
const test = require('node:test');
const { describe, it } = test;
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
  patternDates,
  planPatternFill,
  normaliseCycle,
  isCycleWorkDay,
  findOverlaps,
  checkAssignment,
  judgeAssignments,
  bindEditedAssignment,
  groupAssignmentContexts,
  FORCEABLE_CODES,
  summariseRoster,
  canTransitionShift,
  tenantOffsetMinutes,
  tenantToday,
  parseRosterRange,
  clampPublishRange,
  fillContextWindow,
  MAX_FILL_ROWS,
  templatePositions,
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

// ── patternDates ─────────────────────────────────────────────────────────────

test('patternDates returns the worked weekdays in a range', () => {
  const got = patternDates(template({ daysOfWeek: [1, 3] }), [
    '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13',
  ]);
  assert.strictEqual(got.ok, true);
  assert.deepStrictEqual(got.dates, ['2026-08-10', '2026-08-12']);
});

test('patternDates returns one-on/one-off offsets for a cycle template', () => {
  const got = patternDates(cycleTemplate(), [
    '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14',
  ]);
  assert.strictEqual(got.ok, true);
  assert.deepStrictEqual(got.dates, ['2026-08-10', '2026-08-12', '2026-08-14']);
});

test('patternDates works for dates before the anchor', () => {
  const got = patternDates(cycleTemplate({ anchorDate: '2026-08-14' }), [
    '2026-08-10', '2026-08-11', '2026-08-12',
  ]);
  assert.strictEqual(got.ok, true);
  // floorMod, not %: 10th and 12th are both an even number of days from the 14th.
  assert.deepStrictEqual(got.dates, ['2026-08-10', '2026-08-12']);
});

test('patternDates refuses an inactive template', () => {
  const got = patternDates(template({ isActive: false }), ['2026-08-10']);
  assert.strictEqual(got.ok, false);
  assert.strictEqual(got.reason, 'Template is inactive');
});

test('patternDates refuses a template with an unusable time', () => {
  const got = patternDates(template({ startTime: '99:99' }), ['2026-08-10']);
  assert.strictEqual(got.ok, false);
  assert.strictEqual(got.reason, 'Template has an invalid start or end time');
});

test('patternDates refuses a weekly template with no days set', () => {
  const got = patternDates(template({ daysOfWeek: [] }), ['2026-08-10']);
  assert.strictEqual(got.ok, false);
  assert.strictEqual(got.reason, 'Template has no days of the week set');
});

test('patternDates refuses a cycle with no worked offsets — empty is not "every day"', () => {
  const got = patternDates(cycleTemplate({ cycleDays: [] }), ['2026-08-10']);
  assert.strictEqual(got.ok, false);
  assert.strictEqual(got.reason, 'Template has no worked days in its cycle');
});

// ── planPatternFill ──────────────────────────────────────────────────────────

const ada = { _id: 'emp-ada', firstName: 'Ada', lastName: 'Obi', status: 'active',
  employeeProfile: { planning: { roles: [ROLE] } } };
const bola = { _id: 'emp-bola', firstName: 'Bola', lastName: 'Eze', status: 'active',
  employeeProfile: { planning: { roles: [ROLE] } } };

test('planPatternFill writes one row per person per worked day', () => {
  const plan = planPatternFill(cycleTemplate(), [ada, bola], {
    from: '2026-08-10',
    to: '2026-08-14',
    offsetMinutes: LAGOS,
  });
  // 3 worked days (10th, 12th, 14th) x 2 people
  assert.strictEqual(plan.toCreate.length, 6);
  assert.strictEqual(plan.skipped.length, 0);
  assert.deepStrictEqual(
    [...new Set(plan.toCreate.map((r) => r.employee))].sort(),
    ['emp-ada', 'emp-bola']
  );
  assert.ok(plan.toCreate.every((r) => r.status === 'draft'));
});

test('planPatternFill skips a blocked person-day and still writes everyone else', () => {
  // Ada already has a shift on the 12th; nothing blocks Bola.
  const ctx = new Map([
    ['emp-ada', { employee: ada, timeOff: [], shifts: [
      { _id: 'other', employee: 'emp-ada', status: 'draft',
        start: new Date('2026-08-12T08:00:00.000Z'),
        end: new Date('2026-08-12T16:00:00.000Z') },
    ] }],
    ['emp-bola', { employee: bola, timeOff: [], shifts: [] }],
  ]);

  const plan = planPatternFill(cycleTemplate(), [ada, bola], {
    from: '2026-08-10',
    to: '2026-08-14',
    offsetMinutes: LAGOS,
    ctxById: ctx,
  });

  assert.strictEqual(plan.toCreate.length, 5);
  assert.strictEqual(plan.skipped.length, 1);
  assert.strictEqual(plan.skipped[0].employee, 'emp-ada');
  assert.strictEqual(plan.skipped[0].name, 'Ada Obi');
  assert.strictEqual(plan.skipped[0].date, '2026-08-12');
  assert.strictEqual(plan.skipped[0].code, 'overlap');
  assert.strictEqual(plan.skipped[0].forceable, false);
});

test('planPatternFill judges a row against others planned in the SAME batch', () => {
  // A 24h20m shift: each day's shift runs into the next worked day.
  const tpl = cycleTemplate({
    startTime: '08:40', endTime: '09:00', endDayOffset: 1,
    cycleLength: 1, cycleDays: [0], // every day
  });
  const plan = planPatternFill(tpl, [ada], {
    from: '2026-08-10',
    to: '2026-08-12',
    offsetMinutes: LAGOS,
  });
  // The 10th is written: 10th 08:40 → 11th 09:00.
  // The 11th is SKIPPED: it starts 08:40, inside the row just planned for the
  // 10th — this is the in-batch property under test.
  // The 12th is WRITTEN: the only row that exists is the 10th's, which ended on
  // the 11th at 09:00. A day that was skipped left no shift behind, so it must
  // NOT block anything — only rows actually planned become conflicts.
  assert.strictEqual(plan.toCreate.length, 2);
  assert.deepStrictEqual(
    plan.toCreate.map((r) => r.date),
    ['2026-08-10', '2026-08-12']
  );
  assert.strictEqual(plan.skipped.length, 1);
  assert.strictEqual(plan.skipped[0].date, '2026-08-11');
  assert.strictEqual(plan.skipped[0].code, 'overlap');
});

test('planPatternFill is idempotent per employee — a re-run creates nothing', () => {
  const opts = { from: '2026-08-10', to: '2026-08-14', offsetMinutes: LAGOS };
  const first = planPatternFill(cycleTemplate(), [ada, bola], opts);

  const second = planPatternFill(cycleTemplate(), [ada, bola], {
    ...opts,
    existing: first.toCreate.map((r) => ({
      template: r.template, start: r.start, employee: r.employee, status: 'draft',
    })),
  });

  assert.strictEqual(second.toCreate.length, 0);
  assert.strictEqual(second.skipped.length, 6);
  assert.ok(second.skipped.every((s) => s.code === 'exists'));
});

test('planPatternFill does not treat an OPEN generated row as this person\'s shift', () => {
  // /generate wrote an open row for the same template+instant. It keys as
  // `template@start@` and must not block Ada's row.
  const open = planShiftGeneration([cycleTemplate()], {
    from: '2026-08-10', to: '2026-08-10', offsetMinutes: LAGOS, existing: [],
  }).toCreate.map((r) => ({
    template: r.template, start: r.start, employee: null, status: 'draft',
  }));

  const plan = planPatternFill(cycleTemplate(), [ada], {
    from: '2026-08-10', to: '2026-08-10', offsetMinutes: LAGOS, existing: open,
  });
  assert.strictEqual(plan.toCreate.length, 1);
});

test('planPatternFill reports role_mismatch as forceable, overlap as not', () => {
  const chidi = { _id: 'emp-chidi', firstName: 'Chidi', lastName: 'Nwosu',
    status: 'active', employeeProfile: { planning: { roles: [] } } };

  const plan = planPatternFill(cycleTemplate(), [chidi], {
    from: '2026-08-10', to: '2026-08-10', offsetMinutes: LAGOS,
  });
  assert.strictEqual(plan.toCreate.length, 0);
  assert.strictEqual(plan.skipped[0].code, 'role_mismatch');
  assert.strictEqual(plan.skipped[0].forceable, true);
});

test('planPatternFill writes a role_mismatch row when forced', () => {
  const chidi = { _id: 'emp-chidi', firstName: 'Chidi', lastName: 'Nwosu',
    status: 'active', employeeProfile: { planning: { roles: [] } } };

  const plan = planPatternFill(cycleTemplate(), [chidi], {
    from: '2026-08-10', to: '2026-08-10', offsetMinutes: LAGOS, force: true,
  });
  assert.strictEqual(plan.toCreate.length, 1);
});

test('planPatternFill refuses the whole template when it has no worked days', () => {
  const plan = planPatternFill(cycleTemplate({ cycleDays: [] }), [ada], {
    from: '2026-08-10', to: '2026-08-14', offsetMinutes: LAGOS,
  });
  assert.strictEqual(plan.toCreate.length, 0);
  assert.strictEqual(plan.skipped.length, 1);
  assert.strictEqual(plan.skipped[0].reason, 'Template has no worked days in its cycle');
});

describe('planPatternFill with crew positions', () => {
  const crew = {
    _id: 't1',
    name: 'Friday night',
    role: 'bartender',
    startTime: '18:00',
    endTime: '22:00',
    recurrence: 'weekly',
    daysOfWeek: [5],
    positions: [
      { _id: 'p1', roles: ['bartender', 'barback'], count: 1 },
      { _id: 'p2', roles: ['server', 'runner'], count: 2 },
    ],
  };
  const oneFriday = { from: '2026-08-14', to: '2026-08-14', offsetMinutes: 60 };
  const person = (id, roles) => ({
    _id: id,
    firstName: id,
    lastName: 'Test',
    status: 'active',
    employeeProfile: { planning: { roles } },
  });

  it('seats each person on the position they were given', () => {
    const seats = [
      { employee: person('ada', ['bartender']), position: 'p1' },
      { employee: person('ben', ['server']), position: 'p2' },
      { employee: person('cid', ['runner']), position: 'p2' },
    ];
    const { toCreate, skipped } = planPatternFill(crew, seats, oneFriday);
    assert.equal(skipped.length, 0);
    assert.equal(toCreate.length, 3);
    assert.deepEqual(
      toCreate.map((r) => [r.employee, r.templatePosition, r.role]),
      [
        ['ada', 'p1', 'bartender'],
        ['ben', 'p2', 'server'],
        ['cid', 'p2', 'server'],
      ]
    );
    assert.deepEqual(toCreate[2].altRoles, ['runner']);
  });

  it('accepts someone who holds only the position alternative role', () => {
    const seats = [{ employee: person('cid', ['runner']), position: 'p2' }];
    const { toCreate, skipped } = planPatternFill(crew, seats, oneFriday);
    assert.equal(skipped.length, 0);
    assert.equal(toCreate.length, 1);
  });

  it('refuses a seat on a position that is already full', () => {
    const seats = [
      { employee: person('ada', ['bartender']), position: 'p1' },
      { employee: person('ben', ['barback']), position: 'p1' },
    ];
    const { toCreate, skipped } = planPatternFill(crew, seats, oneFriday);
    assert.equal(toCreate.length, 1);
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0].code, 'position_full');
    assert.equal(skipped[0].forceable, false);
    assert.equal(skipped[0].employee, 'ben');
  });

  it('counts rows already on the position toward the cap', () => {
    const seats = [{ employee: person('ada', ['bartender']), position: 'p1' }];
    const start = planPatternFill(crew, seats, oneFriday).toCreate[0].start;
    const { toCreate, skipped } = planPatternFill(crew, seats, {
      ...oneFriday,
      existing: [
        { template: 't1', templatePosition: 'p1', employee: 'zoe', start, status: 'draft' },
      ],
    });
    assert.equal(toCreate.length, 0);
    assert.equal(skipped[0].code, 'position_full');
  });

  it('still refuses someone qualified for no role on the position', () => {
    const seats = [{ employee: person('dee', ['chef']), position: 'p2' }];
    const { skipped } = planPatternFill(crew, seats, oneFriday);
    assert.equal(skipped[0].code, 'role_mismatch');
    assert.equal(skipped[0].forceable, true);
  });

  it('accepts a bare employee doc against a legacy single-position template', () => {
    const legacy = { ...crew, positions: [] };
    const { toCreate, skipped } = planPatternFill(
      legacy,
      [person('ada', ['bartender'])],
      oneFriday
    );
    assert.equal(skipped.length, 0);
    assert.equal(toCreate.length, 1);
    assert.equal(toCreate[0].templatePosition, null);
    assert.deepEqual(toCreate[0].altRoles, []);
  });

  it('skips a seat naming a position the template does not have', () => {
    const seats = [{ employee: person('ada', ['bartender']), position: 'nope' }];
    const { toCreate, skipped } = planPatternFill(crew, seats, oneFriday);
    assert.equal(toCreate.length, 0);
    assert.match(skipped[0].reason, /position/i);
  });
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

describe('checkAssignment with several acceptable roles', () => {
  const worker = (roles) => ({
    _id: 'e1',
    status: 'active',
    employeeProfile: { planning: { roles } },
  });
  const slot = {
    role: 'bartender',
    altRoles: ['barback'],
    start: new Date('2026-08-14T17:00:00Z'),
    end: new Date('2026-08-14T21:00:00Z'),
  };

  it('accepts someone who holds only the alternative role', () => {
    const v = checkAssignment(slot, worker(['barback']), { shifts: [], timeOff: [] });
    assert.equal(v.ok, true);
    assert.deepEqual(v.warnings, []);
  });

  it('accepts someone who holds the primary role', () => {
    assert.equal(
      checkAssignment(slot, worker(['bartender']), { shifts: [], timeOff: [] }).ok,
      true
    );
  });

  it('refuses someone who holds neither, and the refusal stays forceable', () => {
    const v = checkAssignment(slot, worker(['chef']), { shifts: [], timeOff: [] });
    assert.equal(v.ok, false);
    assert.equal(v.code, 'role_mismatch');
    assert.equal(FORCEABLE_CODES.has(v.code), true);
  });

  it('lets an admin force past it, with a warning', () => {
    const v = checkAssignment(slot, worker(['chef']), {
      shifts: [],
      timeOff: [],
      force: true,
    });
    assert.equal(v.ok, true);
    assert.equal(v.warnings[0].code, 'role_mismatch');
  });

  it('behaves exactly as before when altRoles is absent', () => {
    const single = { ...slot, altRoles: undefined };
    assert.equal(checkAssignment(single, worker(['bartender']), { shifts: [], timeOff: [] }).ok, true);
    assert.equal(checkAssignment(single, worker(['barback']), { shifts: [], timeOff: [] }).code, 'role_mismatch');
  });

  it('still reports an overlap ahead of the role check', () => {
    const v = checkAssignment(slot, worker(['chef']), {
      shifts: [
        {
          _id: 's9',
          employee: 'e1',
          status: 'draft',
          start: new Date('2026-08-14T16:00:00Z'),
          end: new Date('2026-08-14T20:00:00Z'),
        },
      ],
      timeOff: [],
    });
    assert.equal(v.code, 'overlap');
  });
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

// ── What a publish is allowed to reach ───────────────────────────────────────
//
// Publishing is what makes a roster VISIBLE to the people on it, and attendance
// counts a published shift nobody turned up to as an absence. Those two facts
// together are the bug: publishing a range that reaches into the past marks
// people absent for shifts they were never told about, retroactively, and there
// is no way for them to have turned up. A draft in the past is a plan that did
// not happen; it must stay a draft.

test('a range wholly in the future is published exactly as asked', () => {
  const range = parseRosterRange({ from: '2026-08-20', to: '2026-08-26' }, 60);
  const out = clampPublishRange(range, 60, Date.parse('2026-08-11T09:00:00+01:00'));
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.clamped, false);
  assert.strictEqual(out.start.getTime(), range.start.getTime());
  assert.strictEqual(out.end.getTime(), range.end.getTime());
});

test('a range that reaches back into the past starts at today instead', () => {
  // The common way in: a manager builds a fortnight, selects the whole thing,
  // and presses Publish. Last week's drafts must not come with it.
  const range = parseRosterRange({ from: '2026-08-04', to: '2026-08-17' }, 60);
  const out = clampPublishRange(range, 60, Date.parse('2026-08-11T09:00:00+01:00'));
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.clamped, true);
  const today = parseRosterRange({ from: '2026-08-11', to: '2026-08-11' }, 60);
  assert.strictEqual(out.start.getTime(), today.start.getTime());
  // The far end is never moved — clamping is a floor, not a window.
  assert.strictEqual(out.end.getTime(), range.end.getTime());
});

test('a shift earlier TODAY is still publishable', () => {
  // The floor is the start of today, NOT the current instant. A manager
  // publishing at 09:00 means today's roster including the 08:00 opening
  // shift — refusing that would be an hourly moving target nobody can predict,
  // and the shift is one somebody is standing in the shop working right now.
  const range = parseRosterRange({ from: '2026-08-11', to: '2026-08-11' }, 60);
  const out = clampPublishRange(range, 60, Date.parse('2026-08-11T09:00:00+01:00'));
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.clamped, false);
  assert.strictEqual(out.start.getTime(), range.start.getTime());
});

test('a range wholly in the past publishes nothing at all', () => {
  // Refused rather than silently clamped to an empty window: "published 0" with
  // no reason is exactly the kind of answer that reads as a broken button.
  const range = parseRosterRange({ from: '2026-07-01', to: '2026-07-07' }, 60);
  const out = clampPublishRange(range, 60, Date.parse('2026-08-11T09:00:00+01:00'));
  assert.strictEqual(out.ok, false);
  assert.match(out.message, /past/i);
});

test('today is the tenant’s today, not UTC’s', () => {
  // At 00:30 in Lagos it is still yesterday in UTC. Taking the floor from the
  // wrong calendar would publish a whole extra day of past drafts — or refuse a
  // day the manager can see on their own screen.
  const range = parseRosterRange({ from: '2026-08-01', to: '2026-08-31' }, 60);
  const out = clampPublishRange(range, 60, Date.parse('2026-08-11T00:30:00+01:00'));
  const today = parseRosterRange({ from: '2026-08-11', to: '2026-08-11' }, 60);
  assert.strictEqual(out.start.getTime(), today.start.getTime());
});

test('a range that fails to parse is passed straight through', () => {
  // The caller reports the parse error; this must not turn it into a
  // publishing verdict and lose the reason.
  const out = clampPublishRange({ ok: false, message: 'bad dates' }, 60, Date.now());
  assert.strictEqual(out.ok, false);
  assert.strictEqual(out.message, 'bad dates');
});

// ── judgeAssignments ─────────────────────────────────────────────────────────

const EMP3 = '507f1f77bcf86cd799439023';
const other = (id, over = {}) => employee({ _id: id, ...over });
const ctxOf = (entries) => new Map(Object.entries(entries));

test('judgeAssignments allows everyone who is clear', () => {
  const shift = { role: ROLE, ...win('09:00', '17:00') };
  const r = judgeAssignments(shift, [employee(), other(EMP2)], ctxOf({}), {});
  assert.strictEqual(r.allowed.length, 2);
  assert.deepStrictEqual(r.blocked, []);
});

test('judgeAssignments blocks only the double-booked person, and that block is not forceable', () => {
  const shift = { role: ROLE, ...win('09:00', '17:00') };
  const ctx = ctxOf({
    [EMP2]: { shifts: [{ _id: 'a', employee: EMP2, ...win('08:00', '12:00') }], timeOff: [] },
  });
  const r = judgeAssignments(shift, [employee(), other(EMP2)], ctx, {});
  assert.strictEqual(r.allowed.length, 1);
  assert.strictEqual(r.allowed[0].employee._id, EMP);
  assert.strictEqual(r.blocked.length, 1);
  assert.strictEqual(r.blocked[0].employee._id, EMP2);
  assert.strictEqual(r.blocked[0].code, 'overlap');
  assert.strictEqual(r.blocked[0].forceable, false);
});

test('judgeAssignments marks a role mismatch forceable', () => {
  const shift = { role: OTHER_ROLE, ...win('09:00', '17:00') };
  const r = judgeAssignments(shift, [employee()], ctxOf({}), {});
  assert.strictEqual(r.blocked.length, 1);
  assert.strictEqual(r.blocked[0].code, 'role_mismatch');
  assert.strictEqual(r.blocked[0].forceable, true);
});

test('judgeAssignments reports overlap and role_mismatch side by side with different flags', () => {
  const shift = { role: OTHER_ROLE, ...win('09:00', '17:00') };
  const ctx = ctxOf({
    [EMP2]: { shifts: [{ _id: 'a', employee: EMP2, ...win('08:00', '12:00') }], timeOff: [] },
  });
  const r = judgeAssignments(shift, [employee(), other(EMP2)], ctx, {});
  assert.deepStrictEqual(
    r.blocked.map((b) => [b.code, b.forceable]),
    [
      ['role_mismatch', true],
      ['overlap', false],
    ]
  );
});

test('force moves a role mismatch into allowed WITH a warning, and leaves an overlap blocked', () => {
  const shift = { role: OTHER_ROLE, ...win('09:00', '17:00') };
  const ctx = ctxOf({
    [EMP2]: { shifts: [{ _id: 'a', employee: EMP2, ...win('08:00', '12:00') }], timeOff: [] },
  });
  const r = judgeAssignments(shift, [employee(), other(EMP2)], ctx, { force: true });
  assert.strictEqual(r.allowed.length, 1);
  assert.strictEqual(r.allowed[0].employee._id, EMP);
  assert.strictEqual(r.allowed[0].warnings[0].code, 'role_mismatch');
  assert.strictEqual(r.blocked.length, 1);
  assert.strictEqual(r.blocked[0].code, 'overlap');
});

test('judgeAssignments blocks a candidate id that matched no user', () => {
  const shift = { role: ROLE, ...win('09:00', '17:00') };
  const r = judgeAssignments(shift, [null], ctxOf({}), {});
  assert.strictEqual(r.blocked[0].code, 'no_employee');
  assert.strictEqual(r.blocked[0].forceable, false);
});

test('judgeAssignments on an empty list is empty, not a throw', () => {
  const r = judgeAssignments({ role: ROLE, ...win('09:00', '17:00') }, [], ctxOf({}), {});
  assert.deepStrictEqual(r, { allowed: [], blocked: [] });
});

test('a missing context entry means nothing booked, not missing data', () => {
  const shift = { role: ROLE, ...win('09:00', '17:00') };
  const r = judgeAssignments(shift, [other(EMP3)], ctxOf({}), {});
  assert.strictEqual(r.allowed.length, 1);
});

// ── bindEditedAssignment ─────────────────────────────────────────────────────

test('the edited row keeps its person when they are still ticked; the rest fan out', () => {
  assert.deepStrictEqual(bindEditedAssignment(EMP, [EMP, EMP2, EMP3]), {
    keep: EMP,
    create: [EMP2, EMP3],
  });
});

test('unticking the original and ticking others reassigns the row to the first of them', () => {
  assert.deepStrictEqual(bindEditedAssignment(EMP, [EMP2, EMP3]), {
    keep: EMP2,
    create: [EMP3],
  });
});

test('ticking nobody unassigns the row — an open shift, not a deletion', () => {
  assert.deepStrictEqual(bindEditedAssignment(EMP, []), { keep: null, create: [] });
});

test('ticking exactly the person already on the shift creates nothing', () => {
  assert.deepStrictEqual(bindEditedAssignment(EMP, [EMP]), { keep: EMP, create: [] });
});

test('an open shift being filled binds the first ticked person to the existing row', () => {
  assert.deepStrictEqual(bindEditedAssignment(null, [EMP2, EMP3]), {
    keep: EMP2,
    create: [EMP3],
  });
});

test('bindEditedAssignment reads a populated employee ref, not just an id', () => {
  assert.deepStrictEqual(bindEditedAssignment({ _id: EMP }, [EMP, EMP2]), {
    keep: EMP,
    create: [EMP2],
  });
});

test('a duplicated tick does not produce two rows for one person', () => {
  assert.deepStrictEqual(bindEditedAssignment(null, [EMP2, EMP2, EMP3]), {
    keep: EMP2,
    create: [EMP3],
  });
});

// ── groupAssignmentContexts ──────────────────────────────────────────────────

test('groupAssignmentContexts files each row under its own employee', () => {
  const emps = [employee(), other(EMP2)];
  const shifts = [
    { _id: 'a', employee: EMP, ...win('09:00', '17:00') },
    { _id: 'b', employee: EMP2, ...win('09:00', '17:00') },
    { _id: 'c', employee: EMP, ...win('18:00', '22:00') },
  ];
  const off = [{ _id: 'x', employee: EMP2, status: 'approved' }];

  const byId = groupAssignmentContexts(emps, shifts, off);
  assert.deepStrictEqual(byId.get(EMP).shifts.map((s) => s._id), ['a', 'c']);
  assert.deepStrictEqual(byId.get(EMP).timeOff, []);
  assert.deepStrictEqual(byId.get(EMP2).shifts.map((s) => s._id), ['b']);
  assert.deepStrictEqual(byId.get(EMP2).timeOff.map((t) => t._id), ['x']);
});

test('an employee with nothing booked gets EMPTY ARRAYS, not undefined', () => {
  const byId = groupAssignmentContexts([employee()], [], []);
  const entry = byId.get(EMP);
  assert.deepStrictEqual(entry.shifts, []);
  assert.deepStrictEqual(entry.timeOff, []);
  assert.strictEqual(entry.employee._id, EMP);
});

test('groupAssignmentContexts drops rows belonging to nobody it was asked about', () => {
  const byId = groupAssignmentContexts(
    [employee()],
    [{ _id: 'a', employee: EMP2, ...win('09:00', '17:00') }],
    []
  );
  assert.deepStrictEqual(byId.get(EMP).shifts, []);
  assert.strictEqual(byId.has(EMP2), false);
});

test('groupAssignmentContexts reads a populated employee ref on a row', () => {
  const byId = groupAssignmentContexts(
    [employee()],
    [{ _id: 'a', employee: { _id: EMP }, ...win('09:00', '17:00') }],
    []
  );
  assert.deepStrictEqual(byId.get(EMP).shifts.map((s) => s._id), ['a']);
});

// ── fillContextWindow ────────────────────────────────────────────────────────

test('fillContextWindow widens the end by one day for a same-day template', () => {
  const range = { start: new Date('2026-09-01T00:00:00.000Z'), end: new Date('2026-09-08T00:00:00.000Z') };
  const got = fillContextWindow(range, template({ endDayOffset: 0 }));
  assert.strictEqual(got.start.getTime(), range.start.getTime());
  assert.strictEqual(got.end.getTime(), new Date('2026-09-09T00:00:00.000Z').getTime());
});

test('fillContextWindow widens the end by endDayOffset + 1 days', () => {
  const range = { start: new Date('2026-09-01T00:00:00.000Z'), end: new Date('2026-09-08T00:00:00.000Z') };
  const got = fillContextWindow(range, template({ endDayOffset: 2 }));
  assert.strictEqual(got.end.getTime(), new Date('2026-09-11T00:00:00.000Z').getTime());
});

test('fillContextWindow never moves the start', () => {
  const range = { start: new Date('2026-09-01T00:00:00.000Z'), end: new Date('2026-09-08T00:00:00.000Z') };
  const got = fillContextWindow(range, template({ endDayOffset: 3 }));
  assert.strictEqual(got.start.getTime(), range.start.getTime());
});

test('fillContextWindow treats a missing endDayOffset as 0', () => {
  const range = { start: new Date('2026-09-01T00:00:00.000Z'), end: new Date('2026-09-08T00:00:00.000Z') };
  const got = fillContextWindow(range, template({}));
  assert.strictEqual(got.end.getTime(), new Date('2026-09-09T00:00:00.000Z').getTime());
});

// ── templatePositions ────────────────────────────────────────────────────────

describe('templatePositions', () => {
  it('normalises a legacy single-role template into one position of count 1', () => {
    const out = templatePositions({ role: 'r1' });
    assert.deepEqual(out, [{ _id: null, roles: ['r1'], count: 1 }]);
  });

  it('returns the template positions when it has them', () => {
    const out = templatePositions({
      role: 'r1',
      positions: [
        { _id: 'p1', roles: ['r1', 'r2'], count: 1 },
        { _id: 'p2', roles: ['r3'], count: 2 },
      ],
    });
    assert.deepEqual(out, [
      { _id: 'p1', roles: ['r1', 'r2'], count: 1 },
      { _id: 'p2', roles: ['r3'], count: 2 },
    ]);
  });

  it('drops a position with no roles rather than emitting a role-less shift', () => {
    const out = templatePositions({
      role: 'r1',
      positions: [{ _id: 'p1', roles: [], count: 3 }, { _id: 'p2', roles: ['r3'], count: 1 }],
    });
    assert.deepEqual(out, [{ _id: 'p2', roles: ['r3'], count: 1 }]);
  });

  it('floors a bad count to 1 rather than generating nothing', () => {
    const out = templatePositions({ positions: [{ _id: 'p1', roles: ['r1'], count: 0 }] });
    assert.equal(out[0].count, 1);
  });

  it('returns nothing for a template with neither positions nor a role', () => {
    assert.deepEqual(templatePositions({}), []);
  });
});

// ── planShiftGeneration with positions ──────────────────────────────────────

describe('planShiftGeneration with positions', () => {
  const crew = {
    _id: 't1',
    name: 'Friday night',
    role: 'bartender',
    startTime: '18:00',
    endTime: '22:00',
    recurrence: 'weekly',
    daysOfWeek: [5], // Friday
    positions: [
      { _id: 'p1', roles: ['bartender', 'barback'], count: 1 },
      { _id: 'p2', roles: ['server', 'runner'], count: 2 },
    ],
  };
  const oneFriday = { from: '2026-08-14', to: '2026-08-14', offsetMinutes: 60 };

  it('emits one row per required position per worked day', () => {
    const { toCreate } = planShiftGeneration([crew], oneFriday);
    assert.equal(toCreate.length, 3);
    assert.deepEqual(
      toCreate.map((r) => r.role),
      ['bartender', 'server', 'server']
    );
    assert.deepEqual(toCreate[0].altRoles, ['barback']);
    assert.deepEqual(toCreate[1].altRoles, ['runner']);
    assert.deepEqual(
      toCreate.map((r) => r.templatePosition),
      ['p1', 'p2', 'p2']
    );
  });

  it('leaves every generated row open and draft', () => {
    const { toCreate } = planShiftGeneration([crew], oneFriday);
    assert.ok(toCreate.every((r) => r.employee === null));
    assert.ok(toCreate.every((r) => r.status === 'draft'));
  });

  // The idempotency guarantee, four ways.
  const generated = () =>
    planShiftGeneration([crew], oneFriday).toCreate.map((r) => ({
      template: 't1',
      templatePosition: r.templatePosition,
      start: r.start,
      status: 'draft',
    }));

  it('creates nothing on a re-run and reports every skip', () => {
    const { toCreate, skipped } = planShiftGeneration([crew], {
      ...oneFriday,
      existing: generated(),
    });
    assert.equal(toCreate.length, 0);
    assert.equal(skipped.length, 2); // one per position, not one per row
  });

  it('creates nothing after the positions are REORDERED', () => {
    const reordered = { ...crew, positions: [crew.positions[1], crew.positions[0]] };
    const { toCreate } = planShiftGeneration([reordered], {
      ...oneFriday,
      existing: generated(),
    });
    assert.equal(toCreate.length, 0);
  });

  it("creates nothing after a position's ROLES are edited", () => {
    // The regression templatePosition exists for. A key derived from the role
    // SET rekeys here and duplicates the whole already-generated range.
    const widened = {
      ...crew,
      positions: [
        { _id: 'p1', roles: ['bartender', 'barback', 'manager'], count: 1 },
        { _id: 'p2', roles: ['server', 'runner'], count: 2 },
      ],
    };
    const { toCreate } = planShiftGeneration([widened], {
      ...oneFriday,
      existing: generated(),
    });
    assert.equal(toCreate.length, 0);
  });

  it('tops up by exactly the difference when a count is raised', () => {
    const bigger = {
      ...crew,
      positions: [crew.positions[0], { _id: 'p2', roles: ['server', 'runner'], count: 3 }],
    };
    const { toCreate } = planShiftGeneration([bigger], {
      ...oneFriday,
      existing: generated(),
    });
    assert.equal(toCreate.length, 1);
    assert.equal(toCreate[0].templatePosition, 'p2');
  });

  it('ignores cancelled rows when counting what already exists', () => {
    const existing = generated().map((r) => ({ ...r, status: 'cancelled' }));
    const { toCreate } = planShiftGeneration([crew], { ...oneFriday, existing });
    assert.equal(toCreate.length, 3);
  });

  it('generates a legacy single-role template exactly as before', () => {
    const legacy = { ...crew, positions: [] };
    const { toCreate } = planShiftGeneration([legacy], oneFriday);
    assert.equal(toCreate.length, 1);
    assert.equal(toCreate[0].role, 'bartender');
    assert.deepEqual(toCreate[0].altRoles, []);
    assert.equal(toCreate[0].templatePosition, null);
  });

  it('suppresses a legacy template from a row written before positions existed', () => {
    const legacy = { ...crew, positions: [] };
    const before = planShiftGeneration([legacy], oneFriday).toCreate;
    const { toCreate } = planShiftGeneration([legacy], {
      ...oneFriday,
      existing: [{ template: 't1', start: before[0].start, status: 'draft' }], // no templatePosition
    });
    assert.equal(toCreate.length, 0);
  });

  it('skips a template with neither positions nor a role', () => {
    const roleless = { ...crew, role: null, positions: [] };
    const { toCreate, skipped } = planShiftGeneration([roleless], oneFriday);
    assert.equal(toCreate.length, 0);
    assert.match(skipped[0].reason, /role/i);
  });
});
