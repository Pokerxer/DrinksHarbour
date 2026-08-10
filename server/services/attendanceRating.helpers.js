// server/services/attendanceRating.helpers.js
//
// How well somebody attended, as a number out of 100.
//
// THE ROSTER IS THE DENOMINATOR, and that is the whole point of this file.
// summariseAttendance counts punches, so an employee who never turned up has
// none and reads as a clean sheet. A rating has to start from the shifts the
// person was expected to work and ask which ones produced a record — the
// absence is the thing that leaves no trace.
//
// Kept out of attendance.helpers.js deliberately: that file owns what a punch
// MEANS (which shift it belongs to, whether it was late). This one owns what a
// season of punches ADDS UP TO. Pure — no database, no Express — so every rule
// below is unit-tested directly, same split as shift.helpers.js.
//
// Nothing here is stored. The score is computed on read, because a manager
// correcting a punch is a first-class feature of this module and a persisted
// score would be wrong the moment they did.

const {
  DEFAULT_GRACE_MINUTES,
  describePunctuality,
  attendanceMinutes,
} = require('./attendance.helpers');
const { overlapsTimeOff } = require('./shift.helpers');

const MS_PER_MINUTE = 60_000;

/**
 * How far either side of the rostered end a clock-out still counts as
 * finishing the shift. Wider than the arrival grace: shifts rarely end on the
 * second, and a handover that runs ten minutes over is not an event.
 */
const DEFAULT_DEPARTURE_GRACE_MINUTES = 10;

/**
 * What the score is made of. Weighted, not averaged: turning up at all matters
 * more than the minutes around the edges, and these four are not equally
 * important. They total 100 so a component's weight reads as its share.
 */
const RATING_WEIGHTS = Object.freeze({
  attendance: 40,
  punctuality: 30,
  completeness: 15,
  duration: 15,
});

/** Floors, highest first. Anything below the last one is `needs_attention`. */
const RATING_BANDS = Object.freeze({
  excellent: 90,
  good: 75,
  fair: 60,
});

const idOf = (v) => (v && v._id ? String(v._id) : v == null ? '' : String(v));

const msOf = (v) => {
  const ms = v ? new Date(v).getTime() : NaN;
  return Number.isNaN(ms) ? null : ms;
};

/**
 * The shifts an employee can be judged on, each with the record that answered
 * it — or null, which is the absence.
 *
 * Two exclusions, both deliberate:
 *   * a DRAFT shift is invisible to staff, so nobody can fail to attend one;
 *   * a shift that has not ENDED yet is not a no-show, because the person may
 *     be standing at the till right now.
 * Cancelled shifts are excluded for the obvious reason.
 *
 * @param {object[]} shifts
 * @param {object[]} records
 * @param {Date|string|number} now
 * @returns {{shift: object, record: object|null}[]}
 */
function pairShiftsWithAttendance(shifts = [], records = [], now = new Date()) {
  const at = msOf(now) ?? Date.now();

  // Indexed by the shift each record cites. `Attendance.shift` arrives as an
  // id, a populated doc, or null depending on the query — the same
  // id | doc | null shape that has blanked pages here before.
  const byShift = new Map();
  for (const r of records) {
    const key = idOf(r?.shift);
    if (key) byShift.set(key, r);
  }

  return shifts
    .filter((s) => {
      if (!s || s.status !== 'published') return false;
      const end = msOf(s.end);
      return end !== null && end <= at;
    })
    .map((s) => ({ shift: s, record: byShift.get(idOf(s._id)) || null }));
}

/**
 * Was this shift covered by approved leave?
 *
 * Delegates to shift.helpers#overlapsTimeOff rather than re-deriving the rule:
 * that function already knows a pending request is still a question, and that
 * a time-off window is half-open.
 */
function isExcused(shift, timeOff = []) {
  return overlapsTimeOff(shift, timeOff).length > 0;
}

/**
 * How the shift ended — the mirror of describePunctuality for the other end.
 *
 * `minutes` is always non-negative; the code carries the direction. An OPEN
 * record is its own answer rather than an early departure: never clocking out
 * is a different failure from going home, and scoring it as if the person left
 * at their clock-in would be a lie about their day.
 *
 * @returns {{code: 'no_shift'|'open'|'early'|'on_time'|'overtime', minutes: number}}
 */
function describeDeparture(record, shift, opts = {}) {
  const { graceMinutes = DEFAULT_DEPARTURE_GRACE_MINUTES } = opts;
  const end = msOf(shift?.end);
  if (!record || end === null) return { code: 'no_shift', minutes: 0 };

  const out = msOf(record.clockOut);
  if (out === null) return { code: 'open', minutes: 0 };

  const diff = Math.round((out - end) / MS_PER_MINUTE);
  const tolerance = Math.max(0, Number(graceMinutes) || 0);
  if (diff < -tolerance) return { code: 'early', minutes: Math.abs(diff) };
  if (diff > tolerance) return { code: 'overtime', minutes: diff };
  return { code: 'on_time', minutes: Math.abs(diff) };
}

/** The band a score falls in. A score of null is unrated, which is not zero. */
function ratingBand(score) {
  if (score === null || score === undefined || Number.isNaN(score)) return 'unrated';
  for (const [band, floor] of Object.entries(RATING_BANDS)) {
    if (score >= floor) return band;
  }
  return 'needs_attention';
}

/**
 * A component's rate, or null when there was nothing to measure.
 *
 * Null rather than 0 on an empty denominator, and the caller drops it from the
 * total: an employee nobody rostered has not scored zero on punctuality, they
 * have no punctuality. Same rule the appraisal module uses for `pct`.
 */
function component(numerator, denominator) {
  if (!denominator) return { rate: null, of: 0, count: 0 };
  return { rate: numerator / denominator, of: denominator, count: numerator };
}

/**
 * Rate an employee's attendance over a window.
 *
 * @param {{shifts?: object[], records?: object[], timeOff?: object[]}} data
 * @param {{now?: Date, graceMinutes?: number, departureGraceMinutes?: number}} [opts]
 */
function rateAttendance(data = {}, opts = {}) {
  const { shifts = [], records = [], timeOff = [] } = data;
  const {
    now = new Date(),
    graceMinutes = DEFAULT_GRACE_MINUTES,
    departureGraceMinutes = DEFAULT_DEPARTURE_GRACE_MINUTES,
  } = opts;

  const pairs = pairShiftsWithAttendance(shifts, records, now);

  let excused = 0;
  let expected = 0;
  let attended = 0;
  let onTime = 0;
  let late = 0;
  let closed = 0;
  let open = 0;
  let earlyLeave = 0;
  let overtimeMinutes = 0;
  let judgedDurations = 0;
  let stayed = 0;

  for (const { shift, record } of pairs) {
    // An excused shift leaves the reckoning entirely — it is not a shift they
    // failed to attend, so it must not dilute the rate from either side.
    if (isExcused(shift, timeOff)) {
      excused += 1;
      continue;
    }

    expected += 1;
    if (!record) continue;

    // A corrected record still counts as attended: a manager's fix is the
    // truth of what happened, and penalising it would make correcting a punch
    // look worse than leaving it wrong.
    attended += 1;

    const punctuality = describePunctuality(record.clockIn, shift, { graceMinutes });
    if (punctuality.code === 'late') late += 1;
    else onTime += 1;

    const departure = describeDeparture(record, shift, {
      graceMinutes: departureGraceMinutes,
    });

    if (departure.code === 'open') {
      open += 1;
    } else {
      closed += 1;
      // Duration is only judgeable once we know when they went home.
      judgedDurations += 1;
      if (departure.code === 'early') earlyLeave += 1;
      else stayed += 1;
      // Reported, never scored. Staying late is not a fault, so it cannot
      // deduct — and it must not earn credit either, or the clock becomes
      // something to pad.
      if (departure.code === 'overtime') overtimeMinutes += departure.minutes;
    }
  }

  const components = {
    attendance: component(attended, expected),
    punctuality: component(onTime, attended),
    completeness: component(closed, attended),
    duration: component(stayed, judgedDurations),
  };

  // Renormalised over the components that actually applied, so a missing
  // denominator neither passes for free nor fails for free.
  let earned = 0;
  let possible = 0;
  for (const [name, weight] of Object.entries(RATING_WEIGHTS)) {
    const { rate } = components[name];
    if (rate === null) continue;
    earned += rate * weight;
    possible += weight;
  }

  const score = possible ? Math.round((earned / possible) * 100) : null;

  // A punch matching no shift is a normal thing — somebody turning up on a day
  // nothing was rostered — so it is reported and never rated.
  const unrostered = records.filter((r) => !idOf(r?.shift)).length;

  return {
    score,
    band: ratingBand(score),
    components,
    counts: {
      rostered: pairs.length,
      expected,
      excused,
      attended,
      absent: expected - attended,
      onTime,
      late,
      closed,
      open,
      earlyLeave,
      overtimeMinutes,
      unrostered,
      minutesWorked: records.reduce((sum, r) => sum + attendanceMinutes(r), 0),
    },
  };
}

module.exports = {
  DEFAULT_DEPARTURE_GRACE_MINUTES,
  RATING_WEIGHTS,
  RATING_BANDS,
  pairShiftsWithAttendance,
  isExcused,
  describeDeparture,
  ratingBand,
  rateAttendance,
};
