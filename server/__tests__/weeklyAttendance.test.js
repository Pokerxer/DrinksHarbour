const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rateAttendance } = require('../services/attendanceRating.helpers');
const { preserveAttendancePolicy } = require('../services/weeklyAttendance.helpers');

const policy = { type: 'weekly_quota', daysPerWeek: 4, startTime: '08:40', endTime: '17:00', effectiveFrom: '2026-10-05' };
const opts = { now: new Date('2026-10-19T18:00:00Z'), offsetMinutes: 60,
  range: { start: new Date('2026-10-04T23:00:00Z'), end: new Date('2026-10-11T23:00:00Z') } };
const punch = (day, extra = {}) => ({ _id: `p${day}`, clockIn: `2026-10-${day}T07:40:00Z`, clockOut: `2026-10-${day}T16:00:00Z`, status: 'closed', ...extra });
const rate = (records, extra = {}, options = opts) => rateAttendance({ records, policy, ...extra }, options);

test('three attended days of a four-day week score 90 with perfect quality, not 100', () => {
  const result = rate(['05', '07', '09'].map(d => punch(d)));
  assert.equal(result.score, 90);
  assert.equal(result.counts.expected, 4);
  assert.equal(result.counts.attended, 3);
  assert.equal(result.counts.absent, 1);
});

test('four distinct weekdays meet the quota without naming a fixed day off', () => {
  assert.equal(rate(['05', '06', '08', '09'].map(d => punch(d))).score, 100);
});

test('fifth-day credit cannot erase a missing day in a different week', () => {
  const records = ['05', '06', '07', '08', '09', '12', '14', '16'].map(d => punch(d));
  const result = rate(records, {}, { ...opts, range: { ...opts.range, end: new Date('2026-10-18T23:00:00Z') } });
  assert.equal(result.counts.expected, 8);
  assert.equal(result.counts.attended, 7);
  assert.equal(result.counts.absent, 1);
  assert.equal(result.score, 95);
});

test('in-progress weeks and partial selected weeks produce no quota score', () => {
  assert.equal(rate([punch('05')], {}, { ...opts, now: new Date('2026-10-07T20:00:00Z') }).score, null);
  assert.equal(rate([punch('07')], {}, { ...opts, range: { ...opts.range, start: new Date('2026-10-06T23:00:00Z') } }).score, null);
});

test('multiple punches on one day count once and preserve original records', () => {
  const records = [punch('05'), punch('05', { _id: 'second', clockIn: '2026-10-05T12:00:00Z' }), punch('07'), punch('09')];
  const original = JSON.stringify(records);
  const result = rate(records);
  assert.equal(result.counts.attended, 3);
  assert.equal(result.score, 90);
  assert.equal(JSON.stringify(records), original);
});

test('Lagos arrival and departure use 08:40 and 17:00 without rewriting punches', () => {
  const records = ['05', '06', '07', '09'].map(d => punch(d));
  records[0] = punch('05', { clockIn: '2026-10-05T08:40:00Z', clockOut: '2026-10-05T14:00:00Z' });
  const result = rate(records);
  assert.equal(result.counts.late, 1);
  assert.equal(result.counts.earlyLeave, 1);
  assert.equal(result.score, 89);
});

test('approved weekday leave excuses a quota day, pending leave does not', () => {
  const timeOff = [{ status: 'approved', startDate: '2026-10-05T23:00:00Z', endDate: '2026-10-06T23:00:00Z' }];
  const result = rate(['05', '07', '09'].map(d => punch(d)), { timeOff });
  assert.equal(result.counts.expected, 3);
  assert.equal(result.score, 100);
  assert.equal(rate(['05', '07', '09'].map(d => punch(d)), { timeOff: [{ ...timeOff[0], status: 'pending' }] }).score, 90);
});

test('an empty completed week is zero, while weekends do not satisfy weekday quotas', () => {
  assert.equal(rate([]).score, 0);
  const result = rate([punch('10'), punch('11')]);
  assert.equal(result.score, 0);
  assert.equal(result.counts.absent, 4);
});

test('ordinary employee profile edits preserve the trusted scoring policy and cannot inject one', () => {
  const next = { planning: { roles: ['new-role'], attendancePolicy: { ...policy, daysPerWeek: 1 } } };
  assert.deepEqual(preserveAttendancePolicy(next, { planning: { attendancePolicy: policy } }).planning,
    { roles: ['new-role'], attendancePolicy: policy });
  assert.equal(preserveAttendancePolicy(next, {}).planning.attendancePolicy, undefined);
});
