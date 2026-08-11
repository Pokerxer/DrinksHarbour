// server/services/attendance.helpers.js
//
// Pure rules for attendance: what a clock event does, which shift it belongs
// to, whether someone was late, and what a manual correction may say. No
// database, no Express — every rule here is unit-tested directly, same split as
// shift.helpers.js.
//
// A record is a PAIR, not an event: one document holds `clockIn` and later
// `clockOut`, and is `open` until it has both. That is why clocking is a toggle
// rather than two endpoints — the employee presses one button and the state of
// their last record decides what it means.

const { isObjectIdLike } = require('./orgStructure.helpers');

/** An attendance record is open until it is closed. The model enum reads here. */
const ATTENDANCE_STATUSES = ['open', 'closed'];

/** Who recorded it. A kiosk punch is what the employee actually did. */
const ATTENDANCE_SOURCES = ['kiosk', 'admin'];

const MS_PER_MINUTE = 60_000;

/**
 * How far from a shift a clock event can fall and still be counted as that
 * shift. Four hours either side: generous enough for an early arrival or a long
 * overrun, tight enough that a morning punch cannot be claimed by an evening
 * shift on the same day.
 */
const DEFAULT_MATCH_WINDOW_MINUTES = 240;

/** Minutes after a shift's start that still count as on time. */
const DEFAULT_GRACE_MINUTES = 5;

/**
 * The floor between one employee's punches.
 *
 * A camera kiosk decodes whatever is held in front of it about ten times a
 * second, so without a floor a badge left against the lens clocks somebody in
 * and straight back out. resolveAttendanceTimes cannot stop that — a punch
 * 300ms later genuinely IS after the clock-in, so it closes the record with
 * zero minutes on it and the day reads as if the person never worked.
 *
 * Sixty seconds: longer than any accidental re-read, far shorter than the
 * shortest real stretch anybody works. It is enforced on the server rather
 * than only in the pad because the pad is not the only thing that can post.
 */
const MIN_PUNCH_INTERVAL_SECONDS = 60;

const idOf = (v) => (v && v._id ? String(v._id) : v == null ? '' : String(v));

const msOf = (v) => {
  const ms = v ? new Date(v).getTime() : NaN;
  return Number.isNaN(ms) ? null : ms;
};

/**
 * Minutes actually worked on a record.
 *
 * An open record is 0, not "now minus clock-in": a running total would make the
 * same document return a different number on every read, and a day's totals
 * would silently change while nobody was looking. Clamped at zero so a
 * clock-out corrected to before the clock-in cannot subtract from the day.
 */
function attendanceMinutes(record = {}) {
  const start = msOf(record.clockIn);
  const end = msOf(record.clockOut);
  if (start === null || end === null || end <= start) return 0;
  return Math.round((end - start) / MS_PER_MINUTE);
}

/**
 * What pressing the button means: close the open record, or open a new one.
 * @param {object|null} openRecord - the employee's current open record, if any
 * @returns {'in'|'out'}
 */
function resolveClockAction(openRecord) {
  return openRecord && openRecord.status === 'open' ? 'out' : 'in';
}

/**
 * Which of an employee's shifts a clock event belongs to.
 *
 * Picks the shift whose window is nearest the event, within
 * `windowMinutes` either side. Cancelled shifts are never matched — the
 * employee turning up for one is exactly the case where attaching it would be
 * wrong. Ties go to the earlier shift, so a back-to-back double resolves to the
 * one being started rather than the one after it.
 *
 * @param {Date|string} at
 * @param {object[]} shifts
 * @param {{windowMinutes?: number}} [opts]
 * @returns {object|null}
 */
function matchShiftForClock(at, shifts = [], opts = {}) {
  const { windowMinutes = DEFAULT_MATCH_WINDOW_MINUTES } = opts;
  const t = msOf(at);
  if (t === null) return null;

  const slack = Math.max(0, Number(windowMinutes) || 0) * MS_PER_MINUTE;
  let best = null;
  let bestDistance = Infinity;

  for (const shift of shifts) {
    if (shift?.status === 'cancelled') continue;
    const start = msOf(shift?.start);
    const end = msOf(shift?.end);
    if (start === null || end === null) continue;

    // Distance to the window itself, so anything inside a shift scores 0 and
    // the nearest start breaks the tie between two containing shifts.
    const distance = t < start ? start - t : t > end ? t - end : 0;
    if (distance > slack) continue;

    const score = distance === 0 ? Math.abs(t - start) : distance;
    if (score < bestDistance || (score === bestDistance && best && start < msOf(best.start))) {
      best = shift;
      bestDistance = score;
    }
  }

  return best;
}

/**
 * Was this clock-in on time for its shift?
 *
 * `minutes` is always non-negative — the code says which direction it is in.
 * Without a shift there is nothing to be late for, which is a distinct answer
 * from being on time and must not be reported as one.
 *
 * @returns {{code: 'no_shift'|'early'|'on_time'|'late', minutes: number}}
 */
function describePunctuality(clockIn, shift, opts = {}) {
  const { graceMinutes = DEFAULT_GRACE_MINUTES } = opts;
  const at = msOf(clockIn);
  const start = msOf(shift?.start);
  if (at === null || start === null) return { code: 'no_shift', minutes: 0 };

  const diff = Math.round((at - start) / MS_PER_MINUTE);
  if (diff < 0) return { code: 'early', minutes: Math.abs(diff) };
  if (diff <= Math.max(0, Number(graceMinutes) || 0)) return { code: 'on_time', minutes: diff };
  return { code: 'late', minutes: diff };
}

/**
 * Headline numbers for a day or a range.
 * `minutes` counts closed records only, because an open one has none yet.
 */
function summariseAttendance(records = []) {
  let minutes = 0;
  let open = 0;
  let closed = 0;
  let late = 0;

  for (const r of records) {
    if (r?.status === 'open') open += 1;
    else closed += 1;
    minutes += attendanceMinutes(r);
    if (r?.punctuality?.code === 'late') late += 1;
  }

  return {
    total: records.length,
    open,
    closed,
    late,
    minutes,
    hours: Math.round((minutes / 60) * 100) / 100,
  };
}

// ── Payloads ─────────────────────────────────────────────────────────────────

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function refField(value) {
  if (value === undefined) return { skip: true };
  if (value === null || value === '') return { value: null };
  if (!isObjectIdLike(value)) return { bad: true };
  return { value: typeof value === 'object' && value._id ? String(value._id) : String(value) };
}

/**
 * Validate + normalise a manual attendance entry or a correction.
 *
 * `clockOut` is nullable on purpose: an admin may open a record for someone who
 * forgot to punch in and close it later, and clearing it re-opens the record.
 *
 * @param {object} body
 * @param {{isUpdate?: boolean}} [opts]
 * @returns {{ok: true, value: object} | {ok: false, message: string}}
 */
function buildAttendancePayload(body = {}, opts = {}) {
  const isUpdate = Boolean(opts.isUpdate);
  const value = {};

  const employee = refField(body.employee);
  if (employee.bad) return { ok: false, message: 'employee must be a valid id' };
  if (!employee.skip) {
    if (!employee.value) return { ok: false, message: 'An attendance record needs an employee' };
    value.employee = employee.value;
  } else if (!isUpdate) {
    return { ok: false, message: 'An attendance record needs an employee' };
  }

  const shift = refField(body.shift);
  if (shift.bad) return { ok: false, message: 'shift must be a valid id' };
  if (!shift.skip) value.shift = shift.value;

  if (body.clockIn !== undefined) {
    const ms = msOf(body.clockIn);
    if (ms === null) return { ok: false, message: 'clockIn must be a valid date and time' };
    value.clockIn = new Date(ms);
  } else if (!isUpdate) {
    return { ok: false, message: 'clockIn is required' };
  }

  if (body.clockOut !== undefined) {
    if (body.clockOut === null || body.clockOut === '') {
      value.clockOut = null;
    } else {
      const ms = msOf(body.clockOut);
      if (ms === null) return { ok: false, message: 'clockOut must be a valid date and time' };
      value.clockOut = new Date(ms);
    }
  }

  if (body.note !== undefined) value.note = trimmed(body.note);

  return { ok: true, value };
}

/**
 * Check a record's own times once both ends are known, and derive what the
 * pair implies.
 *
 * Split from buildAttendancePayload because a correction may send only one end
 * and the other has to come off the stored document first.
 *
 * @returns {{ok: true, status: string, minutesWorked: number} | {ok: false, message: string}}
 */
function resolveAttendanceTimes(clockIn, clockOut) {
  const start = msOf(clockIn);
  if (start === null) return { ok: false, message: 'An attendance record needs a clock-in time' };

  if (clockOut == null) return { ok: true, status: 'open', minutesWorked: 0 };

  const end = msOf(clockOut);
  if (end === null) return { ok: false, message: 'clockOut must be a valid date and time' };
  if (end <= start) return { ok: false, message: 'Clock-out must be after clock-in' };

  // Status and minutes are DERIVED here rather than accepted from the request:
  // a client that could set them could report a closed record with no hours.
  return {
    ok: true,
    status: 'closed',
    minutesWorked: Math.round((end - start) / MS_PER_MINUTE),
  };
}

/**
 * When an employee's most recent punch happened, from their latest record.
 *
 * The clock-out if the record has one, otherwise the clock-in: a record is a
 * pair, and the punch that matters for the floor is whichever end of it was
 * written last.
 *
 * @param {object|null} record
 * @returns {number|null} epoch ms, or null when there is no readable punch
 */
function lastPunchAt(record) {
  if (!record) return null;
  return msOf(record.clockOut) ?? msOf(record.clockIn);
}

/**
 * Whether a punch lands too close behind the previous one to be real.
 *
 * Deliberately answers false whenever it cannot read a clock: no previous
 * punch is not "too soon" — there is nothing to be too soon after — and a
 * guard that cannot parse a timestamp must fail open rather than lock an
 * employee out of their own shift.
 *
 * @param {Date|string|number|null} previous
 * @param {Date|string|number} at
 * @param {{minSeconds?: number}} [opts]
 * @returns {boolean}
 */
function isPunchTooSoon(previous, at, opts = {}) {
  const { minSeconds = MIN_PUNCH_INTERVAL_SECONDS } = opts;
  const last = typeof previous === 'number' ? previous : msOf(previous);
  if (last === null) return false;
  const now = typeof at === 'number' ? at : msOf(at);
  if (now === null) return false;
  return now - last < minSeconds * 1000;
}

/**
 * Which credential this clock press offered, and whether this pad will take it.
 *
 * The "one of, not both" part was always here; what makes it a rule worth
 * testing is `allowPin`. A kiosk paired with a device token has nobody signed
 * in behind it, and the two credentials are not equally safe to expose:
 *
 *   * a BADGE number is printed on a card somebody has to be holding, and the
 *     card is the reason the laser scanner is on the counter at all;
 *   * a PIN is four to six digits typed from memory. Behind a login, guessing
 *     one costs an attacker an admin account first. On an open endpoint it is
 *     a space small enough to walk through, and `clockLimiter` is per-IP.
 *
 * So the in-app kiosk keeps the pad and the public one does not.
 *
 * The refusal names what this pad accepts — which is written on the device
 * anyway — and never anything about the value offered.
 *
 * @param {{pin?: unknown, badge?: unknown}} body
 * @param {{allowPin?: boolean}} [opts]
 * @returns {{ok: true, kind: 'pin'|'badge'} | {ok: false, message: string}}
 */
function resolveClockCredential(body, opts = {}) {
  const { allowPin = true } = opts;
  const pin = body?.pin;
  const badge = body?.badge;

  if (pin && !allowPin) {
    return { ok: false, message: 'This kiosk accepts a badge scan only' };
  }

  // A missing field is a broken client, not a failed guess — saying so
  // discloses nothing, because no credential was offered to confirm or deny.
  if (!pin && !badge) {
    return {
      ok: false,
      message: allowPin ? 'PIN or badge required' : 'Badge required',
    };
  }
  if (pin && badge) {
    return { ok: false, message: 'Provide either a PIN or a badge, not both' };
  }

  return { ok: true, kind: badge ? 'badge' : 'pin' };
}

module.exports = {
  ATTENDANCE_STATUSES,
  ATTENDANCE_SOURCES,
  DEFAULT_MATCH_WINDOW_MINUTES,
  DEFAULT_GRACE_MINUTES,
  resolveClockCredential,
  MIN_PUNCH_INTERVAL_SECONDS,
  lastPunchAt,
  isPunchTooSoon,
  attendanceMinutes,
  resolveClockAction,
  matchShiftForClock,
  describePunctuality,
  summariseAttendance,
  buildAttendancePayload,
  resolveAttendanceTimes,
};
