const Shift = require('../../models/Shift');
const Attendance = require('../../models/Attendance');
const TimeOff = require('../../models/TimeOffRequest');
const User = require('../../models/User');
const { attendancePeriod } = require('./monthly-attendance');
const { requireCompletedAttendance } = require('./exam-rules');
const { rateAttendance } = require('../attendanceRating.helpers');
const { ConflictError } = require('../../utils/errors');
async function attendancePreview(tenantId, employee, exam) {
  if (!exam) return { score: null, status: 'not_configured' };
  const range = await attendancePeriod(tenantId, exam);
  const scope = { tenant: tenantId, employee };
  const [shifts, records, timeOff, user] = await Promise.all([
    Shift.find({ ...scope, status: { $ne: 'cancelled' }, start: { $gte: range.start, $lt: range.end } }).lean(),
    Attendance.find({ ...scope, clockIn: { $gte: range.start, $lt: range.end } }).lean(),
    TimeOff.find({ ...scope, status: 'approved', startDate: { $lt: range.end }, endDate: { $gt: range.start } }).lean(),
    User.findOne({ _id: employee, tenant: tenantId }).select('employeeProfile.planning.attendancePolicy').lean(),
  ]);
  const now = new Date();
  let periodComplete = true;
  try { requireCompletedAttendance(range, shifts, now); }
  catch (error) { if (!(error instanceof ConflictError)) throw error; periodComplete = false; }
  const rating = rateAttendance({ shifts, records, timeOff, policy: user?.employeeProfile?.planning?.attendancePolicy }, { now, range, offsetMinutes: range.offsetMinutes });
  const { expected, attended, absent, excused } = rating.counts;
  return { score: rating.score, status: rating.score === null ? 'unrated' : periodComplete ? 'complete' : 'provisional', attendanceFrom: range.attendanceFrom, attendanceTo: range.attendanceTo, counts: { expected, attended, absent, excused } };
}
module.exports = { attendancePreview };
