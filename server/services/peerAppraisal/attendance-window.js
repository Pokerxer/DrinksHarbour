const { ValidationError } = require('../../utils/errors');
const day = 86400000;
function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 2000) throw new ValidationError('Choose valid attendance start and end dates.');
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new ValidationError('Choose valid attendance start and end dates.');
  return time;
}
function attendanceDates(input) {
  if (input.attendanceFrom !== undefined || input.attendanceTo !== undefined) {
    const start = dateValue(input.attendanceFrom), finish = dateValue(input.attendanceTo);
    if (finish < start || finish - start >= 366 * day) throw new ValidationError('Attendance range must cover 1–366 days, with the end on or after the start.');
    return { attendanceFrom: input.attendanceFrom, attendanceTo: input.attendanceTo };
  }
  const month = input.attendanceMonth;
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ValidationError('Choose an attendance date range.');
  const [year, m] = month.split('-').map(Number);
  dateValue(`${month}-01`);
  return { attendanceMonth: month, attendanceFrom: `${month}-01`, attendanceTo: new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10) };
}
function attendanceWindow(input, offsetMinutes = 60) {
  const dates = attendanceDates(input);
  const offset = offsetMinutes * 60000;
  return { ...dates, start: new Date(dateValue(dates.attendanceFrom) - offset), end: new Date(dateValue(dates.attendanceTo) + day - offset) };
}
module.exports = { attendanceDates, attendanceWindow };
