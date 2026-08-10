// server/__tests__/attendanceRating.test.js
//
// The rating exists because summariseAttendance cannot see an absence: it
// counts punches, and somebody who never turned up has none. Every test here
// is really about the denominator — which shifts the employee was expected to
// work — so most of them are about what does NOT count.
const test = require('node:test');
const assert = require('node:assert');
const {
  RATING_WEIGHTS,
  RATING_BANDS,
  pairShiftsWithAttendance,
  isExcused,
  describeDeparture,
  rateAttendance,
  ratingBand,
} = require('../services/attendanceRating.helpers');

const NOW = new Date('2026-08-10T12:00:00.000Z');

const shift = (over = {}) => ({
  _id: 's1',
  start: '2026-08-09T08:00:00.000Z',
  end: '2026-08-09T16:00:00.000Z',
  status: 'published',
  ...over,
});

const record = (over = {}) => ({
  _id: 'a1',
  shift: 's1',
  clockIn: '2026-08-09T08:00:00.000Z',
  clockOut: '2026-08-09T16:00:00.000Z',
  status: 'closed',
  source: 'kiosk',
  ...over,
});

// ── Which shifts are even countable ──────────────────────────────────────────

test('pairShiftsWithAttendance matches a shift to the record that cites it', () => {
  const pairs = pairShiftsWithAttendance([shift()], [record()], NOW);
  assert.strictEqual(pairs.length, 1);
  assert.strictEqual(pairs[0].record._id, 'a1');
});

test('pairShiftsWithAttendance reports a shift nobody punched for', () => {
  const pairs = pairShiftsWithAttendance([shift()], [], NOW);
  assert.strictEqual(pairs.length, 1);
  assert.strictEqual(pairs[0].record, null);
});

test('pairShiftsWithAttendance ignores a draft shift', () => {
  // A draft roster is invisible to staff. Nobody can fail to attend a shift
  // they were never told about.
  assert.deepStrictEqual(pairShiftsWithAttendance([shift({ status: 'draft' })], [], NOW), []);
});

test('pairShiftsWithAttendance ignores a cancelled shift', () => {
  assert.deepStrictEqual(
    pairShiftsWithAttendance([shift({ status: 'cancelled' })], [], NOW),
    []
  );
});

test('pairShiftsWithAttendance ignores a shift that has not finished yet', () => {
  // A shift still running is not a no-show — the person may be at work now.
  const running = shift({
    start: '2026-08-10T08:00:00.000Z',
    end: '2026-08-10T20:00:00.000Z',
  });
  assert.deepStrictEqual(pairShiftsWithAttendance([running], [], NOW), []);
});

test('pairShiftsWithAttendance reads a populated shift ref on the record', () => {
  // Attendance.shift comes back as an id, a doc, or null depending on the
  // query — the same id | doc | null shape that blanked the warehouse pages.
  const populated = record({ shift: { _id: 's1', start: shift().start } });
  const pairs = pairShiftsWithAttendance([shift()], [populated], NOW);
  assert.strictEqual(pairs[0].record._id, 'a1');
});

// ── Excused absence ──────────────────────────────────────────────────────────

test('isExcused covers a shift inside approved leave', () => {
  const leave = [
    {
      status: 'approved',
      startDate: '2026-08-09T00:00:00.000Z',
      endDate: '2026-08-10T00:00:00.000Z',
    },
  ];
  assert.strictEqual(isExcused(shift(), leave), true);
});

test('isExcused ignores a request that was only requested', () => {
  // Pending is still a question, not a commitment.
  const leave = [
    {
      status: 'pending',
      startDate: '2026-08-09T00:00:00.000Z',
      endDate: '2026-08-10T00:00:00.000Z',
    },
  ];
  assert.strictEqual(isExcused(shift(), leave), false);
});

test('isExcused is false when there is no leave at all', () => {
  assert.strictEqual(isExcused(shift(), []), false);
});

// ── Leaving early, and staying late ──────────────────────────────────────────

test('describeDeparture calls a clock-out at the shift end on time', () => {
  assert.deepStrictEqual(describeDeparture(record(), shift()), {
    code: 'on_time',
    minutes: 0,
  });
});

test('describeDeparture reports leaving early as positive minutes', () => {
  const out = describeDeparture(
    record({ clockOut: '2026-08-09T15:00:00.000Z' }),
    shift()
  );
  assert.deepStrictEqual(out, { code: 'early', minutes: 60 });
});

test('describeDeparture reports staying on as overtime, not lateness', () => {
  const out = describeDeparture(
    record({ clockOut: '2026-08-09T17:30:00.000Z' }),
    shift()
  );
  assert.deepStrictEqual(out, { code: 'overtime', minutes: 90 });
});

test('describeDeparture forgives a few minutes either side', () => {
  assert.strictEqual(
    describeDeparture(record({ clockOut: '2026-08-09T15:55:00.000Z' }), shift()).code,
    'on_time'
  );
});

test('describeDeparture separates an open record from an early one', () => {
  // Never clocking out is a different failure from leaving early, and must
  // not be scored as if the person went home at their clock-in.
  assert.deepStrictEqual(
    describeDeparture(record({ clockOut: null, status: 'open' }), shift()),
    { code: 'open', minutes: 0 }
  );
});

test('describeDeparture says nothing without a shift to measure against', () => {
  assert.deepStrictEqual(describeDeparture(record(), null), {
    code: 'no_shift',
    minutes: 0,
  });
});

// ── The bands ────────────────────────────────────────────────────────────────

test('ratingBand names each threshold', () => {
  assert.strictEqual(ratingBand(100), 'excellent');
  assert.strictEqual(ratingBand(90), 'excellent');
  assert.strictEqual(ratingBand(89), 'good');
  assert.strictEqual(ratingBand(75), 'good');
  assert.strictEqual(ratingBand(74), 'fair');
  assert.strictEqual(ratingBand(60), 'fair');
  assert.strictEqual(ratingBand(59), 'needs_attention');
  assert.strictEqual(ratingBand(0), 'needs_attention');
});

test('ratingBand reports an unrated employee rather than a zero', () => {
  assert.strictEqual(ratingBand(null), 'unrated');
});

// ── The rating ───────────────────────────────────────────────────────────────

test('rateAttendance gives a perfect week 100', () => {
  const shifts = [shift(), shift({ _id: 's2' })];
  const records = [record(), record({ _id: 'a2', shift: 's2' })];
  const out = rateAttendance({ shifts, records, timeOff: [] }, { now: NOW });

  assert.strictEqual(out.score, 100);
  assert.strictEqual(out.band, 'excellent');
  assert.strictEqual(out.counts.expected, 2);
  assert.strictEqual(out.counts.attended, 2);
  assert.strictEqual(out.counts.absent, 0);
});

test('rateAttendance counts a no-show that left no record at all', () => {
  // The whole reason the roster is the denominator: this employee produced no
  // punches, and summariseAttendance would have called that a clean sheet.
  const shifts = [shift(), shift({ _id: 's2' })];
  const out = rateAttendance({ shifts, records: [record()], timeOff: [] }, { now: NOW });

  assert.strictEqual(out.counts.expected, 2);
  assert.strictEqual(out.counts.attended, 1);
  assert.strictEqual(out.counts.absent, 1);
  assert.strictEqual(out.components.attendance.rate, 0.5);
  assert.ok(out.score < 100);
});

test('rateAttendance takes an excused absence out of the denominator', () => {
  // Approved leave is not a shift somebody failed to attend, so it must not
  // dilute the rate — it disappears from both sides.
  const shifts = [shift(), shift({ _id: 's2' })];
  const timeOff = [
    {
      status: 'approved',
      startDate: '2026-08-09T00:00:00.000Z',
      endDate: '2026-08-10T00:00:00.000Z',
    },
  ];
  const out = rateAttendance({ shifts, records: [], timeOff }, { now: NOW });

  assert.strictEqual(out.counts.excused, 2);
  assert.strictEqual(out.counts.expected, 0);
  assert.strictEqual(out.counts.absent, 0);
});

test('rateAttendance reports an employee with no roster as unrated, not zero', () => {
  const out = rateAttendance({ shifts: [], records: [], timeOff: [] }, { now: NOW });
  assert.strictEqual(out.score, null);
  assert.strictEqual(out.band, 'unrated');
  assert.strictEqual(out.components.attendance.rate, null);
});

test('rateAttendance renormalises over the components that apply', () => {
  // Attendance is the only component with a denominator here: the employee was
  // rostered and never came, so there are no arrivals to be punctual about.
  // The score must be 0, not 40/100 — the other weights do not silently pass.
  const out = rateAttendance({ shifts: [shift()], records: [], timeOff: [] }, { now: NOW });
  assert.strictEqual(out.components.punctuality.rate, null);
  assert.strictEqual(out.score, 0);
});

test('rateAttendance counts lateness against punctuality only', () => {
  const late = record({ clockIn: '2026-08-09T08:45:00.000Z' });
  const out = rateAttendance({ shifts: [shift()], records: [late], timeOff: [] }, { now: NOW });

  assert.strictEqual(out.counts.late, 1);
  assert.strictEqual(out.components.attendance.rate, 1);
  assert.strictEqual(out.components.punctuality.rate, 0);
  // 40 + 15 + 15 of 100 survive; punctuality's 30 is lost.
  assert.strictEqual(out.score, 70);
});

test('rateAttendance treats an early arrival as on time', () => {
  const early = record({ clockIn: '2026-08-09T07:30:00.000Z' });
  const out = rateAttendance({ shifts: [shift()], records: [early], timeOff: [] }, { now: NOW });
  assert.strictEqual(out.components.punctuality.rate, 1);
});

test('rateAttendance charges a record left open to completeness', () => {
  const open = record({ clockOut: null, status: 'open' });
  const out = rateAttendance({ shifts: [shift()], records: [open], timeOff: [] }, { now: NOW });

  assert.strictEqual(out.counts.open, 1);
  assert.strictEqual(out.components.completeness.rate, 0);
  // Duration cannot be judged without a clock-out, so it drops out entirely
  // rather than being scored as if they left at their clock-in.
  assert.strictEqual(out.components.duration.rate, null);
});

test('rateAttendance still counts a corrected record as attended', () => {
  // A manager's fix is the truth of what happened. Penalising it would make
  // correcting a punch look worse than leaving it wrong.
  const fixed = record({ source: 'admin', editedBy: 'u9' });
  const out = rateAttendance({ shifts: [shift()], records: [fixed], timeOff: [] }, { now: NOW });
  assert.strictEqual(out.counts.attended, 1);
  assert.strictEqual(out.score, 100);
});

test('rateAttendance deducts for leaving early', () => {
  const short = record({ clockOut: '2026-08-09T14:00:00.000Z' });
  const out = rateAttendance({ shifts: [shift()], records: [short], timeOff: [] }, { now: NOW });

  assert.strictEqual(out.counts.earlyLeave, 1);
  assert.strictEqual(out.components.duration.rate, 0);
  assert.strictEqual(out.score, 85);
});

test('rateAttendance reports overtime without paying for it', () => {
  // Staying late is not a fault, so it cannot deduct — and it must not earn
  // credit either, or the clock becomes something to pad.
  const over = record({ clockOut: '2026-08-09T18:00:00.000Z' });
  const out = rateAttendance({ shifts: [shift()], records: [over], timeOff: [] }, { now: NOW });

  assert.strictEqual(out.counts.overtimeMinutes, 120);
  assert.strictEqual(out.components.duration.rate, 1);
  assert.strictEqual(out.score, 100);
});

test('rateAttendance never lets an unrostered punch hurt the score', () => {
  // Turning up on a day nothing was rostered is a normal thing to do.
  const stray = record({ _id: 'a9', shift: null, clockIn: '2026-08-08T09:00:00.000Z' });
  const out = rateAttendance(
    { shifts: [shift()], records: [record(), stray], timeOff: [] },
    { now: NOW }
  );

  assert.strictEqual(out.counts.unrostered, 1);
  assert.strictEqual(out.score, 100);
});

test('the weights are the single source of truth and total 100', () => {
  const total = Object.values(RATING_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.strictEqual(total, 100);
  assert.deepStrictEqual(Object.keys(RATING_BANDS), [
    'excellent',
    'good',
    'fair',
  ]);
});

// ── A punch nothing accounts for ─────────────────────────────────────────────
//
// `unrostered` used to mean "the record cites no shift at all". That is one way
// a punch can go unaccounted for, but not the only one, and the others were
// silently dropped: the employee history page builds its timeline from the
// shift list and appends the unrostered punches after it, so a record that is
// in neither appears on the page NOWHERE — while still counting towards the
// hours in the summary. Somebody's shift gets cancelled after they worked it
// and their hours vanish from their own history.

const { unrosteredRecords } = require('../services/attendanceRating.helpers');

test('unrosteredRecords reports a punch that cites no shift', () => {
  const stray = record({ _id: 'a9', shift: null });
  assert.deepStrictEqual(
    unrosteredRecords([record(), stray], [shift()]).map((r) => r._id),
    ['a9']
  );
});

test('unrosteredRecords reports a punch whose shift was cancelled afterwards', () => {
  // The shift is gone from the roster query (it filters cancelled out), so no
  // timeline row will ever carry this record.
  const orphan = record({ _id: 'a9', shift: 's-cancelled' });
  assert.deepStrictEqual(
    unrosteredRecords([record(), orphan], [shift()]).map((r) => r._id),
    ['a9']
  );
});

test('unrosteredRecords reports a punch bound to a shift outside the window', () => {
  const orphan = record({ _id: 'a9', shift: 's-last-month' });
  assert.deepStrictEqual(unrosteredRecords([orphan], []).map((r) => r._id), ['a9']);
});

test('unrosteredRecords does not report a punch its shift accounts for', () => {
  // Including a DRAFT shift: the rating will not judge it, but the history
  // page still shows a row for it, so the punch is not orphaned.
  assert.deepStrictEqual(unrosteredRecords([record()], [shift({ status: 'draft' })]), []);
});

test('unrosteredRecords reads a populated shift the same as a bare id', () => {
  // Attendance.shift is an id, a populated doc or null depending on the query.
  const populated = record({ shift: { _id: 's1', start: shift().start } });
  assert.deepStrictEqual(unrosteredRecords([populated], [shift()]), []);
});

test('rateAttendance counts a punch orphaned by a cancelled shift as unrostered', () => {
  // Previously 0: the record had a shift id, so it passed the "no shift" test,
  // and no expected shift claimed it either. It fell through both.
  const orphan = record({ _id: 'a9', shift: 's-cancelled' });
  const out = rateAttendance(
    { shifts: [shift()], records: [record(), orphan], timeOff: [] },
    { now: NOW }
  );

  assert.strictEqual(out.counts.unrostered, 1);
  // Still never scored — turning up is not something to be marked down for.
  assert.strictEqual(out.score, 100);
});
