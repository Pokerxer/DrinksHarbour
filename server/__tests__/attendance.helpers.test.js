// server/__tests__/attendance.helpers.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  ATTENDANCE_STATUSES,
  ATTENDANCE_SOURCES,
  attendanceMinutes,
  resolveClockAction,
  matchShiftForClock,
  describePunctuality,
  summariseAttendance,
  buildAttendancePayload,
  resolveAttendanceTimes,
  lastPunchAt,
  isPunchTooSoon,
} = require('../services/attendance.helpers');

const EMP = '507f1f77bcf86cd799439021';
const SHIFT = '507f1f77bcf86cd799439031';

const shift = (over = {}) => ({
  _id: SHIFT,
  start: '2026-08-10T08:00:00.000Z',
  end: '2026-08-10T16:00:00.000Z',
  status: 'published',
  ...over,
});

// ── Enums ────────────────────────────────────────────────────────────────────

test('the enums are the single source of truth for the model', () => {
  assert.deepStrictEqual(ATTENDANCE_STATUSES, ['open', 'closed']);
  assert.deepStrictEqual(ATTENDANCE_SOURCES, ['kiosk', 'admin']);
});

// ── Minutes ──────────────────────────────────────────────────────────────────

test('attendanceMinutes measures a closed record', () => {
  assert.strictEqual(
    attendanceMinutes({ clockIn: '2026-08-10T08:00:00.000Z', clockOut: '2026-08-10T16:30:00.000Z' }),
    510
  );
});

test('attendanceMinutes reports zero for an open record, not time-so-far', () => {
  // A running total would make the same document return a different number on
  // every read, and a day's totals would drift while nobody was looking.
  assert.strictEqual(attendanceMinutes({ clockIn: '2026-08-10T08:00:00.000Z' }), 0);
  assert.strictEqual(attendanceMinutes({ clockIn: '2026-08-10T08:00:00.000Z', clockOut: null }), 0);
});

test('attendanceMinutes never goes negative on a bad correction', () => {
  assert.strictEqual(
    attendanceMinutes({ clockIn: '2026-08-10T16:00:00.000Z', clockOut: '2026-08-10T08:00:00.000Z' }),
    0
  );
  assert.strictEqual(attendanceMinutes({}), 0);
});

// ── The toggle ───────────────────────────────────────────────────────────────

test('resolveClockAction closes an open record and otherwise opens one', () => {
  assert.strictEqual(resolveClockAction(null), 'in');
  assert.strictEqual(resolveClockAction(undefined), 'in');
  assert.strictEqual(resolveClockAction({ status: 'open' }), 'out');
  // A closed record is history; the next press starts a new one.
  assert.strictEqual(resolveClockAction({ status: 'closed' }), 'in');
});

// ── Shift matching ───────────────────────────────────────────────────────────

test('matchShiftForClock picks a shift the event falls inside', () => {
  const s = shift();
  assert.strictEqual(matchShiftForClock('2026-08-10T09:00:00.000Z', [s])?._id, SHIFT);
});

test('matchShiftForClock matches an early arrival within the window', () => {
  const s = shift();
  // 30 minutes before the start.
  assert.ok(matchShiftForClock('2026-08-10T07:30:00.000Z', [s]));
});

test('matchShiftForClock refuses an event far outside every shift', () => {
  const s = shift();
  // Ten hours before the shift starts, well past the four-hour window.
  assert.strictEqual(matchShiftForClock('2026-08-09T22:00:00.000Z', [s]), null);
  assert.strictEqual(matchShiftForClock('2026-08-10T09:00:00.000Z', []), null);
});

test('matchShiftForClock never matches a cancelled shift', () => {
  // Turning up for a cancelled shift is exactly when attaching it is wrong.
  assert.strictEqual(matchShiftForClock('2026-08-10T09:00:00.000Z', [shift({ status: 'cancelled' })]), null);
});

test('matchShiftForClock picks the nearer of two shifts on one day', () => {
  const morning = shift({ _id: 'm', start: '2026-08-10T06:00:00.000Z', end: '2026-08-10T10:00:00.000Z' });
  const evening = shift({ _id: 'e', start: '2026-08-10T16:00:00.000Z', end: '2026-08-10T22:00:00.000Z' });
  assert.strictEqual(matchShiftForClock('2026-08-10T06:05:00.000Z', [evening, morning])?._id, 'm');
  assert.strictEqual(matchShiftForClock('2026-08-10T15:50:00.000Z', [evening, morning])?._id, 'e');
});

test('matchShiftForClock resolves a back-to-back double to the one being started', () => {
  const first = shift({ _id: 'a', start: '2026-08-10T08:00:00.000Z', end: '2026-08-10T12:00:00.000Z' });
  const second = shift({ _id: 'b', start: '2026-08-10T12:00:00.000Z', end: '2026-08-10T16:00:00.000Z' });
  // Punching in at the handover belongs to the shift beginning, not the one ending.
  assert.strictEqual(matchShiftForClock('2026-08-10T12:00:00.000Z', [first, second])?._id, 'b');
});

test('matchShiftForClock tolerates junk times', () => {
  assert.strictEqual(matchShiftForClock('not a date', [shift()]), null);
  assert.strictEqual(matchShiftForClock('2026-08-10T09:00:00.000Z', [{ start: 'x', end: 'y' }]), null);
});

// ── Punctuality ──────────────────────────────────────────────────────────────

test('describePunctuality separates "no shift" from "on time"', () => {
  // Nothing to be late for is a distinct answer, not a pass.
  assert.deepStrictEqual(describePunctuality('2026-08-10T08:00:00.000Z', null), {
    code: 'no_shift',
    minutes: 0,
  });
});

test('describePunctuality forgives arrivals inside the grace window', () => {
  assert.strictEqual(describePunctuality('2026-08-10T08:00:00.000Z', shift()).code, 'on_time');
  assert.strictEqual(describePunctuality('2026-08-10T08:05:00.000Z', shift()).code, 'on_time');
});

test('describePunctuality reports lateness and earliness as positive minutes', () => {
  const late = describePunctuality('2026-08-10T08:25:00.000Z', shift());
  assert.deepStrictEqual(late, { code: 'late', minutes: 25 });
  const early = describePunctuality('2026-08-10T07:40:00.000Z', shift());
  // The direction is in the code, so the count never has to carry a sign.
  assert.deepStrictEqual(early, { code: 'early', minutes: 20 });
});

test('describePunctuality honours a custom grace window', () => {
  assert.strictEqual(
    describePunctuality('2026-08-10T08:10:00.000Z', shift(), { graceMinutes: 15 }).code,
    'on_time'
  );
});

// ── Summary ──────────────────────────────────────────────────────────────────

test('summariseAttendance counts open, closed, late and hours', () => {
  const out = summariseAttendance([
    { status: 'closed', clockIn: '2026-08-10T08:00:00.000Z', clockOut: '2026-08-10T16:00:00.000Z', punctuality: { code: 'late' } },
    { status: 'closed', clockIn: '2026-08-10T09:00:00.000Z', clockOut: '2026-08-10T13:30:00.000Z', punctuality: { code: 'on_time' } },
    { status: 'open', clockIn: '2026-08-10T10:00:00.000Z' },
  ]);
  assert.strictEqual(out.total, 3);
  assert.strictEqual(out.open, 1);
  assert.strictEqual(out.closed, 2);
  assert.strictEqual(out.late, 1);
  // The open record contributes no minutes.
  assert.strictEqual(out.minutes, 480 + 270);
  assert.strictEqual(out.hours, 12.5);
});

test('summariseAttendance handles an empty day', () => {
  assert.deepStrictEqual(summariseAttendance([]), {
    total: 0, open: 0, closed: 0, late: 0, minutes: 0, hours: 0,
  });
});

// ── Payload ──────────────────────────────────────────────────────────────────

test('buildAttendancePayload requires an employee and a clock-in on create', () => {
  assert.match(buildAttendancePayload({ clockIn: '2026-08-10T08:00:00.000Z' }).message, /employee/i);
  assert.match(buildAttendancePayload({ employee: EMP }).message, /clockIn is required/);
  assert.ok(buildAttendancePayload({ employee: EMP, clockIn: '2026-08-10T08:00:00.000Z' }).ok);
});

test('buildAttendancePayload refuses to clear the employee on a correction', () => {
  const out = buildAttendancePayload({ employee: null }, { isUpdate: true });
  assert.ok(!out.ok);
  assert.match(out.message, /needs an employee/i);
});

test('buildAttendancePayload treats a cleared clockOut as re-opening the record', () => {
  const out = buildAttendancePayload({ clockOut: null }, { isUpdate: true });
  assert.ok(out.ok);
  assert.strictEqual(out.value.clockOut, null);
});

test('buildAttendancePayload rejects junk dates and refs', () => {
  assert.ok(!buildAttendancePayload({ employee: EMP, clockIn: 'this morning' }).ok);
  assert.ok(!buildAttendancePayload({ employee: 'nope', clockIn: '2026-08-10T08:00:00.000Z' }).ok);
  assert.ok(
    !buildAttendancePayload({ employee: EMP, clockIn: '2026-08-10T08:00:00.000Z', shift: 'nope' }).ok
  );
});

test('buildAttendancePayload on update patches only what was sent', () => {
  const out = buildAttendancePayload({ note: ' corrected ' }, { isUpdate: true });
  assert.ok(out.ok);
  assert.deepStrictEqual(out.value, { note: 'corrected' });
});

// ── Derived status ───────────────────────────────────────────────────────────

test('resolveAttendanceTimes derives open, closed and the minutes', () => {
  const open = resolveAttendanceTimes('2026-08-10T08:00:00.000Z', null);
  assert.deepStrictEqual(open, { ok: true, status: 'open', minutesWorked: 0 });

  const closed = resolveAttendanceTimes('2026-08-10T08:00:00.000Z', '2026-08-10T16:30:00.000Z');
  // Derived, never taken from the request — a client that could set these could
  // report a closed record with no hours on it.
  assert.deepStrictEqual(closed, { ok: true, status: 'closed', minutesWorked: 510 });
});

test('resolveAttendanceTimes refuses a clock-out at or before the clock-in', () => {
  assert.ok(!resolveAttendanceTimes('2026-08-10T08:00:00.000Z', '2026-08-10T08:00:00.000Z').ok);
  assert.ok(!resolveAttendanceTimes('2026-08-10T08:00:00.000Z', '2026-08-10T07:00:00.000Z').ok);
  assert.ok(!resolveAttendanceTimes(null, null).ok);
});

// ── The double-punch guard ───────────────────────────────────────────────────
//
// A camera kiosk decodes the badge held in front of it ten times a second, so
// without a floor between punches one held card clocks the employee in and
// straight back out. resolveAttendanceTimes cannot catch that: a punch 300ms
// later is genuinely after the clock-in, so it writes a closed record with
// zero minutes on it.

test('lastPunchAt reads the clock-out of a closed record', () => {
  assert.strictEqual(
    lastPunchAt({ clockIn: '2026-08-10T08:00:00.000Z', clockOut: '2026-08-10T16:00:00.000Z' }),
    new Date('2026-08-10T16:00:00.000Z').getTime()
  );
});

test('lastPunchAt reads the clock-in while the record is still open', () => {
  assert.strictEqual(
    lastPunchAt({ clockIn: '2026-08-10T08:00:00.000Z', clockOut: null }),
    new Date('2026-08-10T08:00:00.000Z').getTime()
  );
});

test('lastPunchAt reports nothing for a missing or junk record', () => {
  assert.strictEqual(lastPunchAt(null), null);
  assert.strictEqual(lastPunchAt({}), null);
  assert.strictEqual(lastPunchAt({ clockIn: 'not a date' }), null);
});

test('isPunchTooSoon refuses a second punch inside the interval', () => {
  // The held-badge case: the same card decoded again a third of a second later.
  assert.strictEqual(
    isPunchTooSoon('2026-08-10T08:00:00.000Z', '2026-08-10T08:00:00.300Z'),
    true
  );
});

test('isPunchTooSoon allows a punch once the interval has passed', () => {
  assert.strictEqual(
    isPunchTooSoon('2026-08-10T08:00:00.000Z', '2026-08-10T08:01:00.000Z'),
    false
  );
});

test('isPunchTooSoon lets a first-ever punch through', () => {
  // No previous record is not "too soon" — there is nothing to be too soon after.
  assert.strictEqual(isPunchTooSoon(null, '2026-08-10T08:00:00.000Z'), false);
});

test('isPunchTooSoon honours a custom interval', () => {
  const at = '2026-08-10T08:00:10.000Z';
  assert.strictEqual(isPunchTooSoon('2026-08-10T08:00:00.000Z', at, { minSeconds: 5 }), false);
  assert.strictEqual(isPunchTooSoon('2026-08-10T08:00:00.000Z', at, { minSeconds: 30 }), true);
});

test('isPunchTooSoon never refuses on a junk timestamp', () => {
  // A guard that cannot read the clock must not become a lockout.
  assert.strictEqual(isPunchTooSoon('nonsense', '2026-08-10T08:00:00.000Z'), false);
  assert.strictEqual(isPunchTooSoon('2026-08-10T08:00:00.000Z', 'nonsense'), false);
});
