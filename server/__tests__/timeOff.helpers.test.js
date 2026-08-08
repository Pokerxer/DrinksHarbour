// Unit tests for services/timeOff.helpers.js — the rules behind time-off
// requests and shift swaps, with no database anywhere near them.
//
// The two things worth reading first:
//
//  * A stored request is a HALF-OPEN window [startDate, endDate). That is not
//    an implementation detail — shift.helpers.js#overlapsTimeOff already
//    compares `start < tEnd && tStart < end`, so an inclusive end would let a
//    shift be booked on the last morning of somebody's holiday.
//  * A half day is genuinely half. `am` ends at local midday and `pm` starts
//    there, so `timeOffDays` reports 0.5 and the overlap arithmetic frees the
//    other half of the day for a shift.

const test = require('node:test');
const assert = require('node:assert');

const {
  TIME_OFF_TYPES,
  TIME_OFF_STATUSES,
  SWAP_STATUSES,
  HALF_DAY_PARTS,
  TIME_OFF_TRANSITIONS,
  SWAP_TRANSITIONS,
  MAX_TIME_OFF_DAYS,
  canTransitionTimeOff,
  canTransitionSwap,
  timeOffStatusesThatCanBecome,
  swapStatusesThatCanBecome,
  resolveTimeOffAction,
  resolveSwapAction,
  resolveApprover,
  timeOffWindow,
  timeOffDays,
  timeOffDayKeys,
  buildTimeOffPayload,
  buildSwapPayload,
} = require('../services/timeOff.helpers');

const { overlapsTimeOff } = require('../services/shift.helpers');

const OID_A = '507f1f77bcf86cd799439011';
const OID_B = '507f1f77bcf86cd799439012';
const OID_C = '507f1f77bcf86cd799439013';
const OID_D = '507f1f77bcf86cd799439014';

// ── Enums ────────────────────────────────────────────────────────────────────

test('the enums are the ones the models and the spec agree on', () => {
  assert.deepStrictEqual(TIME_OFF_TYPES, ['annual', 'sick', 'unpaid', 'parental', 'other']);
  assert.deepStrictEqual(TIME_OFF_STATUSES, ['pending', 'approved', 'rejected', 'cancelled']);
  assert.deepStrictEqual(SWAP_STATUSES, [
    'pending',
    'accepted',
    'rejected',
    'cancelled',
    'approved',
  ]);
  assert.deepStrictEqual(HALF_DAY_PARTS, ['none', 'am', 'pm']);
});

// ── Transitions ──────────────────────────────────────────────────────────────

test('a pending request may be approved, rejected or cancelled', () => {
  assert.strictEqual(canTransitionTimeOff('pending', 'approved'), true);
  assert.strictEqual(canTransitionTimeOff('pending', 'rejected'), true);
  assert.strictEqual(canTransitionTimeOff('pending', 'cancelled'), true);
});

test('approved time off can still be cancelled, which frees the roster block', () => {
  assert.strictEqual(canTransitionTimeOff('approved', 'cancelled'), true);
});

test('a rejected or cancelled request is final', () => {
  assert.deepStrictEqual(TIME_OFF_TRANSITIONS.rejected, []);
  assert.deepStrictEqual(TIME_OFF_TRANSITIONS.cancelled, []);
  assert.strictEqual(canTransitionTimeOff('rejected', 'approved'), false);
  assert.strictEqual(canTransitionTimeOff('cancelled', 'pending'), false);
});

test('approved time off cannot be flipped straight to rejected', () => {
  // Cancelling says "this is no longer happening"; rejecting says "it never
  // was". Once somebody has been told yes, only the first is honest.
  assert.strictEqual(canTransitionTimeOff('approved', 'rejected'), false);
});

test('an unknown status transitions nowhere rather than throwing', () => {
  assert.strictEqual(canTransitionTimeOff('nonsense', 'approved'), false);
  assert.strictEqual(canTransitionSwap(undefined, 'approved'), false);
});

test('statusesThatCanBecome drives bulk moves off the table, not a literal', () => {
  assert.deepStrictEqual(timeOffStatusesThatCanBecome('approved'), ['pending']);
  assert.deepStrictEqual(timeOffStatusesThatCanBecome('cancelled'), ['pending', 'approved']);
});

test('a manager cannot approve a swap the target has not accepted', () => {
  // There is nobody to move the shift to until somebody has said yes to it.
  assert.strictEqual(canTransitionSwap('pending', 'approved'), false);
  assert.strictEqual(canTransitionSwap('accepted', 'approved'), true);
  assert.deepStrictEqual(swapStatusesThatCanBecome('approved'), ['accepted']);
});

test('a swap may be accepted, rejected or cancelled while pending', () => {
  assert.deepStrictEqual(SWAP_TRANSITIONS.pending, ['accepted', 'rejected', 'cancelled']);
});

test('an accepted swap may still be rejected or cancelled before approval', () => {
  assert.strictEqual(canTransitionSwap('accepted', 'rejected'), true);
  assert.strictEqual(canTransitionSwap('accepted', 'cancelled'), true);
});

test('an approved swap is final — the shift has already moved', () => {
  assert.deepStrictEqual(SWAP_TRANSITIONS.approved, []);
});

test('actions map to statuses so no controller hard-codes a status string', () => {
  assert.strictEqual(resolveTimeOffAction('approve'), 'approved');
  assert.strictEqual(resolveTimeOffAction('reject'), 'rejected');
  assert.strictEqual(resolveTimeOffAction('cancel'), 'cancelled');
  assert.strictEqual(resolveTimeOffAction('accept'), null);

  assert.strictEqual(resolveSwapAction('accept'), 'accepted');
  assert.strictEqual(resolveSwapAction('approve'), 'approved');
  assert.strictEqual(resolveSwapAction('reject'), 'rejected');
  assert.strictEqual(resolveSwapAction('cancel'), 'cancelled');
  assert.strictEqual(resolveSwapAction(''), null);
});

// ── resolveApprover ──────────────────────────────────────────────────────────

test('the named time-off approver wins over the line manager', () => {
  const employee = {
    _id: OID_A,
    employeeProfile: { approvers: { timeOff: OID_B }, work: { manager: OID_C } },
  };
  assert.strictEqual(resolveApprover(employee, { admins: [{ _id: OID_D }] }), OID_B);
});

test('with no named approver it falls back to the line manager', () => {
  const employee = { _id: OID_A, employeeProfile: { work: { manager: OID_C } } };
  assert.strictEqual(resolveApprover(employee, { admins: [{ _id: OID_D }] }), OID_C);
});

test('with neither, any tenant admin will do', () => {
  const employee = { _id: OID_A, employeeProfile: {} };
  assert.strictEqual(resolveApprover(employee, { admins: [{ _id: OID_D }] }), OID_D);
});

test('nobody to approve is null, never the employee themselves', () => {
  const employee = { _id: OID_A, employeeProfile: {} };
  assert.strictEqual(resolveApprover(employee, { admins: [] }), null);
  assert.strictEqual(resolveApprover(employee, {}), null);
});

test('an approver who resolves to the employee is skipped, not used', () => {
  // A department admin whose own manager field points at themselves must not
  // end up approving their own leave; the next candidate takes it.
  const employee = {
    _id: OID_A,
    employeeProfile: { approvers: { timeOff: OID_A }, work: { manager: OID_A } },
  };
  assert.strictEqual(resolveApprover(employee, { admins: [{ _id: OID_A }, { _id: OID_B }] }), OID_B);
});

test('resolveApprover reads populated refs as happily as bare ids', () => {
  const employee = {
    _id: { toString: () => OID_A },
    employeeProfile: { work: { manager: { _id: OID_C, firstName: 'Ada' } } },
  };
  assert.strictEqual(resolveApprover(employee, { admins: [] }), OID_C);
});

test('a missing employee has no approver rather than throwing', () => {
  assert.strictEqual(resolveApprover(null, { admins: [{ _id: OID_B }] }), null);
});

// ── The window ───────────────────────────────────────────────────────────────

const LAGOS = 60;

test('a whole day is the local calendar day, stored as a half-open window', () => {
  const w = timeOffWindow('2026-08-10', '2026-08-10', 'none', LAGOS);
  assert.strictEqual(w.ok, true);
  assert.strictEqual(w.start.toISOString(), '2026-08-09T23:00:00.000Z');
  // Exclusive: the instant local midnight ends the day, so a 23:30 shift on the
  // 10th is inside the window and a 00:00 shift on the 11th is not.
  assert.strictEqual(w.end.toISOString(), '2026-08-10T23:00:00.000Z');
});

test('a multi-day request covers every day up to and including `to`', () => {
  const w = timeOffWindow('2026-08-10', '2026-08-12', 'none', LAGOS);
  assert.strictEqual(w.start.toISOString(), '2026-08-09T23:00:00.000Z');
  assert.strictEqual(w.end.toISOString(), '2026-08-12T23:00:00.000Z');
  assert.strictEqual(timeOffDays(w), 3);
});

test('a morning half day ends at local midday, not local midnight', () => {
  const w = timeOffWindow('2026-08-10', '2026-08-10', 'am', LAGOS);
  assert.strictEqual(w.start.toISOString(), '2026-08-09T23:00:00.000Z');
  assert.strictEqual(w.end.toISOString(), '2026-08-10T11:00:00.000Z');
  assert.strictEqual(timeOffDays(w), 0.5);
});

test('an afternoon half day starts at local midday', () => {
  const w = timeOffWindow('2026-08-10', '2026-08-10', 'pm', LAGOS);
  assert.strictEqual(w.start.toISOString(), '2026-08-10T11:00:00.000Z');
  assert.strictEqual(w.end.toISOString(), '2026-08-10T23:00:00.000Z');
  assert.strictEqual(timeOffDays(w), 0.5);
});

test('a half day across a range is refused rather than silently widened', () => {
  const w = timeOffWindow('2026-08-10', '2026-08-12', 'am', LAGOS);
  assert.strictEqual(w.ok, false);
  assert.match(w.message, /single day/i);
});

test('an end before the start is refused', () => {
  assert.strictEqual(timeOffWindow('2026-08-12', '2026-08-10', 'none', LAGOS).ok, false);
});

test('a nonsense date is refused rather than becoming an Invalid Date', () => {
  assert.strictEqual(timeOffWindow('not-a-date', '2026-08-10', 'none', LAGOS).ok, false);
  assert.strictEqual(timeOffWindow('2026-08-10', '', 'none', LAGOS).ok, false);
});

test('a range longer than the cap is refused', () => {
  const w = timeOffWindow('2026-01-01', '2026-12-31', 'none', LAGOS);
  assert.strictEqual(w.ok, false);
  assert.match(w.message, new RegExp(String(MAX_TIME_OFF_DAYS)));
});

test('an unknown half-day part is refused, never treated as a whole day', () => {
  const w = timeOffWindow('2026-08-10', '2026-08-10', 'evening', LAGOS);
  assert.strictEqual(w.ok, false);
});

test('the window is read back as the inclusive local days a human typed', () => {
  const whole = timeOffWindow('2026-08-10', '2026-08-12', 'none', LAGOS);
  assert.deepStrictEqual(timeOffDayKeys({ startDate: whole.start, endDate: whole.end }, LAGOS), {
    from: '2026-08-10',
    to: '2026-08-12',
  });

  const pm = timeOffWindow('2026-08-10', '2026-08-10', 'pm', LAGOS);
  assert.deepStrictEqual(timeOffDayKeys({ startDate: pm.start, endDate: pm.end }, LAGOS), {
    from: '2026-08-10',
    to: '2026-08-10',
  });
});

test('timeOffDays counts nothing for a broken or missing window', () => {
  assert.strictEqual(timeOffDays({}), 0);
  assert.strictEqual(timeOffDays({ start: 'x', end: 'y' }), 0);
});

// ── The window is the one Phase 2's guard already understands ────────────────

test('an afternoon off blocks an afternoon shift and leaves the morning free', () => {
  const pm = timeOffWindow('2026-08-10', '2026-08-10', 'pm', LAGOS);
  const request = { status: 'approved', startDate: pm.start, endDate: pm.end };

  const morning = { start: '2026-08-10T07:00:00.000Z', end: '2026-08-10T10:00:00.000Z' };
  const afternoon = { start: '2026-08-10T13:00:00.000Z', end: '2026-08-10T17:00:00.000Z' };

  assert.deepStrictEqual(overlapsTimeOff(morning, [request]), []);
  assert.strictEqual(overlapsTimeOff(afternoon, [request]).length, 1);
});

test('the exclusive end frees the next day for a shift', () => {
  const w = timeOffWindow('2026-08-10', '2026-08-10', 'none', LAGOS);
  const request = { status: 'approved', startDate: w.start, endDate: w.end };
  // 00:00 local on the 11th, i.e. exactly the window's end instant.
  const nextDay = { start: '2026-08-10T23:00:00.000Z', end: '2026-08-11T07:00:00.000Z' };
  assert.deepStrictEqual(overlapsTimeOff(nextDay, [request]), []);
});

// ── Payloads ─────────────────────────────────────────────────────────────────

test('a time-off payload resolves its window and normalises the rest', () => {
  const built = buildTimeOffPayload(
    { type: 'annual', from: '2026-08-10', to: '2026-08-12', reason: '  Family  ' },
    { offsetMinutes: LAGOS }
  );
  assert.strictEqual(built.ok, true);
  assert.strictEqual(built.value.type, 'annual');
  assert.strictEqual(built.value.halfDay, 'none');
  assert.strictEqual(built.value.reason, 'Family');
  assert.strictEqual(built.value.startDate.toISOString(), '2026-08-09T23:00:00.000Z');
  assert.strictEqual(built.value.endDate.toISOString(), '2026-08-12T23:00:00.000Z');
  assert.strictEqual(built.value.days, 3);
});

test('a single day may be sent as `from` alone', () => {
  const built = buildTimeOffPayload(
    { type: 'sick', from: '2026-08-10' },
    { offsetMinutes: LAGOS }
  );
  assert.strictEqual(built.ok, true);
  assert.strictEqual(built.value.endDate.toISOString(), '2026-08-10T23:00:00.000Z');
  assert.strictEqual(built.value.days, 1);
});

test('an unknown time-off type is refused', () => {
  const built = buildTimeOffPayload(
    { type: 'sabbatical', from: '2026-08-10' },
    { offsetMinutes: LAGOS }
  );
  assert.strictEqual(built.ok, false);
  assert.match(built.message, /type/i);
});

test('a request with no dates is refused', () => {
  assert.strictEqual(buildTimeOffPayload({ type: 'annual' }, { offsetMinutes: LAGOS }).ok, false);
});

test('the employee is optional on the payload — the controller decides whose it is', () => {
  // An ordinary member of staff may only file their own, and the controller
  // stamps req.user for them. An admin filing on someone's behalf sends the id.
  const mine = buildTimeOffPayload({ type: 'annual', from: '2026-08-10' }, { offsetMinutes: LAGOS });
  assert.strictEqual(mine.ok, true);
  assert.strictEqual(mine.value.employee, undefined);

  const theirs = buildTimeOffPayload(
    { type: 'annual', from: '2026-08-10', employee: OID_B },
    { offsetMinutes: LAGOS }
  );
  assert.strictEqual(theirs.value.employee, OID_B);

  const bad = buildTimeOffPayload(
    { type: 'annual', from: '2026-08-10', employee: 'nope' },
    { offsetMinutes: LAGOS }
  );
  assert.strictEqual(bad.ok, false);
});

test('an update may move the dates without resending the type', () => {
  const built = buildTimeOffPayload(
    { from: '2026-08-11', to: '2026-08-11' },
    { offsetMinutes: LAGOS, isUpdate: true }
  );
  assert.strictEqual(built.ok, true);
  assert.strictEqual(built.value.type, undefined);
  assert.strictEqual(built.value.startDate.toISOString(), '2026-08-10T23:00:00.000Z');
});

test('an update that touches neither end leaves the window alone', () => {
  const built = buildTimeOffPayload({ reason: 'changed my mind' }, { isUpdate: true });
  assert.strictEqual(built.ok, true);
  assert.strictEqual(built.value.startDate, undefined);
  assert.strictEqual(built.value.endDate, undefined);
});

test('a swap payload needs a shift and may leave the target open', () => {
  const open = buildSwapPayload({ shift: OID_A, note: ' cover please ' });
  assert.strictEqual(open.ok, true);
  assert.strictEqual(open.value.shift, OID_A);
  // null, not undefined: an open swap is a value, exactly like Shift.employee.
  assert.strictEqual(open.value.targetEmployee, null);
  assert.strictEqual(open.value.note, 'cover please');

  const directed = buildSwapPayload({ shift: OID_A, targetEmployee: OID_B });
  assert.strictEqual(directed.value.targetEmployee, OID_B);
});

test('a swap without a shift is refused', () => {
  const built = buildSwapPayload({ targetEmployee: OID_B });
  assert.strictEqual(built.ok, false);
  assert.match(built.message, /shift/i);
});

test('a swap with a bad id is refused rather than cast', () => {
  assert.strictEqual(buildSwapPayload({ shift: 'nope' }).ok, false);
  assert.strictEqual(buildSwapPayload({ shift: OID_A, targetEmployee: 'nope' }).ok, false);
});
