const Tenant = require('../../models/Tenant');
const Shift = require('../../models/Shift');
const Attendance = require('../../models/Attendance');
const TimeOff = require('../../models/TimeOffRequest');
const { tenantOffsetMinutes } = require('../shift.helpers');
const { rateAttendance } = require('../attendanceRating.helpers');
const { requireCompletedAttendance } = require('./exam-rules');
const { attendanceWindow } = require('./attendance-window');
const { ConflictError } = require('../../utils/errors');
async function attendancePeriod(tenantId, month, session = null) {
  const tenant = await Tenant.findOne({ _id: tenantId }).session(session).lean();
  const offsetMinutes = tenantOffsetMinutes(tenant);
  return { ...attendanceWindow(typeof month === 'string' ? { attendanceMonth: month } : month, offsetMinutes), offsetMinutes };
}
async function monthlyScores(tenantId, people, month, session) {
  const range = await attendancePeriod(tenantId, month, session);
  const now = new Date();
  requireCompletedAttendance(range, [], now);
  const ids = people.map(p => p.employee);
  // Sequential reads: the Mongo driver does not support parallel operations in one transaction.
  const shifts = await Shift.find({ tenant: tenantId, employee: { $in: ids }, status: { $ne: 'cancelled' }, start: { $gte: range.start, $lt: range.end } }).session(session).lean();
  requireCompletedAttendance(range, shifts, now);
  const records = await Attendance.find({ tenant: tenantId, employee: { $in: ids }, clockIn: { $gte: range.start, $lt: range.end } }).session(session).lean();
  const timeOff = await TimeOff.find({ tenant: tenantId, employee: { $in: ids }, status: 'approved', startDate: { $lt: range.end }, endDate: { $gt: range.start } }).session(session).lean();
  const scores = new Map();
  for (const person of people) {
    const own = rows => rows.filter(r => String(r.employee) === String(person.employee));
    const rating = rateAttendance({ shifts: own(shifts), records: own(records), timeOff: own(timeOff) }, { now });
    if (rating.score === null) throw new ConflictError(`${person.displayName} has no rated attendance for ${range.attendanceFrom} to ${range.attendanceTo}. Review their published shift roster before closing.`);
    scores.set(String(person.employee), rating.score);
  }
  return { scores, calculatedAt: now, attendanceFrom: range.attendanceFrom, attendanceTo: range.attendanceTo };
}
module.exports = { attendancePeriod, monthlyScores };
