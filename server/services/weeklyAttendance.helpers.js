// Quota deficits belong to a week, never to an invented scheduled calendar day.
const { shiftWindow, overlapsTimeOff, parseTimeOfDay } = require('./shift.helpers');
const DAY = 86400000;
const dateOnly = value => new Date(value).toISOString().slice(0, 10);
function prepareWeeklyAttendance({ records = [], timeOff = [], policy }, opts = {}) {
  const quota = policy.daysPerWeek;
  const offset = (opts.offsetMinutes ?? 60) * 60000;
  const start = new Date(opts.range?.start).getTime();
  const end = new Date(opts.range?.end).getTime();
  const now = new Date(opts.now ?? Date.now()).getTime();
  const effective = Date.parse(`${policy.effectiveFrom}T00:00:00Z`) - offset;
  if (!Number.isInteger(quota) || quota < 1 || quota > 5 || !Number.isFinite(effective) ||
      dateOnly(effective + offset) !== policy.effectiveFrom || !Number.isFinite(start) || !Number.isFinite(end) ||
      end <= start || end - start > 3660 * DAY || parseTimeOfDay(policy.startTime) === null ||
      parseTimeOfDay(policy.endTime) === null || policy.endTime <= policy.startTime) {
    throw new TypeError('Weekly attendance needs a valid daytime quota policy and bounded date range');
  }
  const floor = Math.max(start, effective);
  const localFloor = new Date(floor + offset);
  let monday = Date.UTC(localFloor.getUTCFullYear(), localFloor.getUTCMonth(), localFloor.getUTCDate()) - offset;
  monday -= ((localFloor.getUTCDay() + 6) % 7) * DAY;
  if (monday < floor) monday += 7 * DAY;
  const shifts = [], linked = [], weeks = [], used = new Set();
  let expected = 0, attended = 0, excused = 0;
  for (; monday + 5 * DAY <= Math.min(end, now); monday += 7 * DAY) {
    let leaveDays = 0;
    const worked = [];
    for (let day = 0; day < 5; day++) {
      const iso = dateOnly(monday + day * DAY + offset);
      const window = shiftWindow(iso, policy.startTime, policy.endTime, offset / 60000, 0);
      if (overlapsTimeOff(window, timeOff).length) { leaveDays++; continue; }
      const daily = records.filter(r => {
        const at = new Date(r.clockIn).getTime();
        return at >= monday + day * DAY && at < monday + (day + 1) * DAY;
      }).sort((a, b) => new Date(a.clockIn) - new Date(b.clockIn));
      if (!daily.length) continue;
      for (const record of daily) used.add(record);
      const open = daily.some(r => !r.clockOut);
      const clockOut = open ? null : new Date(Math.max(...daily.map(r => new Date(r.clockOut).getTime())));
      const id = `weekly-observed:${iso}`;
      shifts.push({ _id: id, ...window, status: 'published' });
      linked.push({ ...daily[0], shift: id, clockOut, status: open ? 'open' : 'closed' });
      worked.push(iso);
    }
    const required = Math.max(0, quota - leaveDays);
    const credited = Math.min(required, worked.length);
    expected += required;
    attended += credited;
    excused += quota - required;
    weeks.push({ from: dateOnly(monday + offset), to: dateOnly(monday + 4 * DAY + offset),
      required, attended: credited, recordedDays: worked.length, missed: required - credited });
  }
  return { shifts, records: linked, expected, attended, excused, weeks, unrostered: records.length - used.size };
}
function preserveAttendancePolicy(profile, previous = {}) {
  const { attendancePolicy: ignored, ...planning } = profile.planning || {};
  const saved = previous?.planning?.attendancePolicy;
  return { ...profile, planning: saved ? { ...planning, attendancePolicy: saved } : planning };
}
module.exports = { prepareWeeklyAttendance, preserveAttendancePolicy };
