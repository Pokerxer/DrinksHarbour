// server/services/timeOff.helpers.js
//
// Pure rules for time-off requests and shift swaps: who approves what, which
// status moves are legal, and exactly which instants a request covers. No
// database, no Express — every rule here is unit-tested directly, the same
// split as shift.helpers.js and attendance.helpers.js.
//
// TWO THINGS THAT ARE LOAD-BEARING
// --------------------------------
// 1. A stored request is a HALF-OPEN window `[startDate, endDate)` in absolute
//    UTC. That is not a private detail: shift.helpers.js#overlapsTimeOff
//    already compares `start < tEnd && tStart < end`, so storing an inclusive
//    end would let a shift be rostered on the last morning of a holiday. The
//    convention matches parseRosterRange — the end is the instant the last day
//    finishes, not an instant inside it.
//
// 2. A half day is genuinely half. `am` runs from local midnight to local
//    midday, `pm` from local midday to local midnight, so the other half of
//    that day stays rosterable and `timeOffDays` reports 0.5. A `halfDay` that
//    quietly behaved like a whole day would take an afternoon off somebody's
//    balance and off the roster without anybody asking for it.

const { isObjectIdLike } = require('./orgStructure.helpers');
const { DEFAULT_OFFSET_MINUTES } = require('./shift.helpers');

/** Why somebody is away. The model enum reads here. */
const TIME_OFF_TYPES = ['annual', 'sick', 'unpaid', 'parental', 'other'];

/** Lifecycle of a time-off request. The model enum reads here. */
const TIME_OFF_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

/**
 * Lifecycle of a swap. Two gates, not one: the target says yes (`accepted`),
 * then a manager says yes (`approved`). Only the second moves the shift.
 */
const SWAP_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled', 'approved'];

/** Which part of a day a request covers. `none` is the whole of it. */
const HALF_DAY_PARTS = ['none', 'am', 'pm'];

/**
 * Same ceiling as the roster's generation window. A request longer than a
 * quarter is a slipped year in a date picker, not a sabbatical.
 */
const MAX_TIME_OFF_DAYS = 92;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;
const MS_PER_HALF_DAY = MS_PER_DAY / 2;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── Transitions ──────────────────────────────────────────────────────────────
//
// Tables, not literals in a controller. Phase 2's bulk publish and single-shift
// move stay consistent precisely because both read SHIFT_TRANSITIONS; the same
// applies here the moment anything wants "every request that could still be
// cancelled".

/**
 * `approved → rejected` is deliberately absent. Cancelling says "this is no
 * longer happening"; rejecting says "it never was". Once somebody has been told
 * yes, only the first of those is honest.
 */
const TIME_OFF_TRANSITIONS = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['cancelled'],
  rejected: [],
  cancelled: [],
};

/**
 * `pending → approved` is deliberately absent. Until somebody has accepted
 * there is nobody to move the shift to, so a manager approving an unanswered
 * swap would be approving a hole in the roster.
 */
const SWAP_TRANSITIONS = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['approved', 'rejected', 'cancelled'],
  approved: [],
  rejected: [],
  cancelled: [],
};

function canTransition(table, from, to) {
  return (table[from] || []).includes(to);
}

/** Is this time-off status move legal? */
function canTransitionTimeOff(from, to) {
  return canTransition(TIME_OFF_TRANSITIONS, from, to);
}

/** Is this swap status move legal? */
function canTransitionSwap(from, to) {
  return canTransition(SWAP_TRANSITIONS, from, to);
}

/** Every time-off status that may legally move TO `to`. */
function timeOffStatusesThatCanBecome(to) {
  return TIME_OFF_STATUSES.filter((from) => canTransitionTimeOff(from, to));
}

/** Every swap status that may legally move TO `to`. */
function swapStatusesThatCanBecome(to) {
  return SWAP_STATUSES.filter((from) => canTransitionSwap(from, to));
}

/** What the caller asked for → the status it means. Null for anything else. */
const TIME_OFF_ACTIONS = { approve: 'approved', reject: 'rejected', cancel: 'cancelled' };
const SWAP_ACTIONS = {
  accept: 'accepted',
  approve: 'approved',
  reject: 'rejected',
  cancel: 'cancelled',
};

function resolveTimeOffAction(action) {
  return TIME_OFF_ACTIONS[action] || null;
}

function resolveSwapAction(action) {
  return SWAP_ACTIONS[action] || null;
}

// ── Approver routing ─────────────────────────────────────────────────────────

const idOf = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') return String(v._id ?? v);
  return String(v);
};

/**
 * Who decides this person's request.
 *
 * ONE definition, used by both time off and swaps — the spec is explicit about
 * that, and two copies would drift the moment one of them learned about
 * departments.
 *
 * Order: `approvers.timeOff` → `work.manager` → any tenant admin. A candidate
 * that resolves to the employee themselves is SKIPPED rather than used: a
 * department admin whose manager field points at their own account must not end
 * up approving their own leave, and a self-approval is indistinguishable from
 * an unapproved one after the fact.
 *
 * `ctx.admins` is the caller's list of eligible deciders (tenant_owner /
 * tenant_admin, active). Filtering that list is IO, so it stays in the
 * controller; choosing from it is a rule, so it lives here.
 *
 * @param {object|null} employee
 * @param {{admins?: object[]}} [ctx]
 * @returns {string|null} the approver's id, or null when there is nobody
 */
function resolveApprover(employee, ctx = {}) {
  if (!employee) return null;
  const self = idOf(employee._id);
  const profile = employee.employeeProfile || {};

  const candidates = [
    profile.approvers?.timeOff,
    profile.work?.manager,
    ...(ctx.admins || []),
  ];

  for (const candidate of candidates) {
    const id = idOf(candidate);
    if (!id || id === self) continue;
    return id;
  }
  return null;
}

// ── The window ───────────────────────────────────────────────────────────────

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** 'YYYY-MM-DD' → the UTC midnight of that calendar day, or NaN. */
function parseDateOnly(value) {
  const s = trimmed(value);
  if (!DATE_RE.test(s)) return NaN;
  return Date.parse(`${s}T00:00:00.000Z`);
}

/**
 * Turn the local days a human typed into the absolute half-open window a
 * request is stored as.
 *
 * @param {string} from        'YYYY-MM-DD' local
 * @param {string} to          'YYYY-MM-DD' local, inclusive
 * @param {string} halfDay     'none' | 'am' | 'pm'
 * @param {number} offsetMinutes
 * @returns {{ok: true, from: string, to: string, halfDay: string, start: Date, end: Date}
 *          | {ok: false, message: string}}
 */
function timeOffWindow(from, to, halfDay = 'none', offsetMinutes = DEFAULT_OFFSET_MINUTES) {
  const part = trimmed(halfDay) || 'none';
  if (!HALF_DAY_PARTS.includes(part)) {
    return { ok: false, message: 'halfDay must be none, am or pm' };
  }

  const fromMs = parseDateOnly(from);
  const toMs = parseDateOnly(to);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    return { ok: false, message: 'Dates must look like 2026-08-10' };
  }
  if (toMs < fromMs) {
    return { ok: false, message: 'The last day must be on or after the first' };
  }

  const days = Math.round((toMs - fromMs) / MS_PER_DAY) + 1;
  if (days > MAX_TIME_OFF_DAYS) {
    return { ok: false, message: `A request may cover at most ${MAX_TIME_OFF_DAYS} days` };
  }

  // Refused, not widened: "the morning of the 10th to the 12th" has no meaning
  // anybody agrees on, and guessing would silently give back or take a day.
  if (part !== 'none' && toMs !== fromMs) {
    return { ok: false, message: 'A half day can only be taken on a single day' };
  }

  const offset = Number(offsetMinutes) || 0;
  let startMs = fromMs - offset * MS_PER_MINUTE;
  let endMs = toMs + MS_PER_DAY - offset * MS_PER_MINUTE;

  if (part === 'am') endMs = startMs + MS_PER_HALF_DAY;
  if (part === 'pm') startMs += MS_PER_HALF_DAY;

  return {
    ok: true,
    from: trimmed(from),
    to: trimmed(to),
    halfDay: part,
    start: new Date(startMs),
    end: new Date(endMs),
  };
}

/**
 * How long a window is, in days, to the nearest half.
 *
 * Accepts either a `timeOffWindow` result (`start`/`end`) or a stored request
 * (`startDate`/`endDate`), because both shapes are asked this question.
 */
function timeOffDays(window = {}) {
  const start = new Date(window.start ?? window.startDate).getTime();
  const end = new Date(window.end ?? window.endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.round(((end - start) / MS_PER_DAY) * 2) / 2;
}

/**
 * A stored window read back as the inclusive local days a human typed.
 *
 * `end` is exclusive, so the last day comes from one millisecond before it —
 * otherwise a whole-day request would report the day after it finishes, and a
 * half day would report the right one only by accident.
 */
function timeOffDayKeys(request = {}, offsetMinutes = DEFAULT_OFFSET_MINUTES) {
  const offset = Number(offsetMinutes) || 0;
  const start = new Date(request.startDate ?? request.start).getTime();
  const end = new Date(request.endDate ?? request.end).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return { from: '', to: '' };

  const key = (ms) => new Date(ms + offset * MS_PER_MINUTE).toISOString().slice(0, 10);
  return { from: key(start), to: key(Math.max(start, end - 1)) };
}

// ── Payloads ─────────────────────────────────────────────────────────────────
//
// Same split as shift.helpers.js: the controller does IO, everything decidable
// from the request body alone is decided here and unit-tested.

function refField(value) {
  if (value === undefined) return { skip: true };
  if (value === null || value === '') return { value: null };
  if (!isObjectIdLike(value)) return { bad: true };
  return { value: typeof value === 'object' && value._id ? String(value._id) : String(value) };
}

/**
 * Validate + normalise a time-off request.
 *
 * `employee` is optional on purpose. An ordinary member of staff may only file
 * their own and the controller stamps `req.user` for them; an admin filing on
 * somebody's behalf sends the id. Deciding WHOSE request this is needs the
 * caller's role, which is not in the body.
 *
 * @param {object} body
 * @param {{isUpdate?: boolean, offsetMinutes?: number}} [opts]
 * @returns {{ok: true, value: object} | {ok: false, message: string}}
 */
function buildTimeOffPayload(body = {}, opts = {}) {
  const isUpdate = Boolean(opts.isUpdate);
  const offsetMinutes = opts.offsetMinutes ?? DEFAULT_OFFSET_MINUTES;
  const value = {};

  const employee = refField(body.employee);
  if (employee.bad) return { ok: false, message: 'employee must be a valid id' };
  if (!employee.skip) {
    if (!employee.value) return { ok: false, message: 'A request needs an employee' };
    value.employee = employee.value;
  }

  if (body.type !== undefined) {
    const type = trimmed(body.type);
    if (!TIME_OFF_TYPES.includes(type)) {
      return { ok: false, message: `type must be one of ${TIME_OFF_TYPES.join(', ')}` };
    }
    value.type = type;
  } else if (!isUpdate) {
    return { ok: false, message: 'A request needs a type' };
  }

  // A single day may be sent as `from` alone — the common case by a distance,
  // and making somebody type the same date twice invites getting one of them
  // wrong.
  const touchesDates =
    body.from !== undefined || body.to !== undefined || body.halfDay !== undefined;

  if (touchesDates) {
    const from = trimmed(body.from);
    const to = trimmed(body.to) || from;
    const window = timeOffWindow(from, to, body.halfDay, offsetMinutes);
    if (!window.ok) return { ok: false, message: window.message };
    value.startDate = window.start;
    value.endDate = window.end;
    value.halfDay = window.halfDay;
    value.days = timeOffDays(window);
  } else if (!isUpdate) {
    return { ok: false, message: 'A request needs a start date' };
  }

  if (body.reason !== undefined) value.reason = trimmed(body.reason);

  return { ok: true, value };
}

/**
 * Validate + normalise a swap request.
 *
 * `targetEmployee` is NULLABLE and that is the point: null means the shift is
 * offered to anyone holding the role, exactly like `Shift.employee`. Every read
 * path has to expect null rather than treating it as missing data.
 */
function buildSwapPayload(body = {}, opts = {}) {
  const isUpdate = Boolean(opts.isUpdate);
  const value = {};

  const shift = refField(body.shift);
  if (shift.bad) return { ok: false, message: 'shift must be a valid id' };
  if (!shift.skip) {
    if (!shift.value) return { ok: false, message: 'A swap needs a shift' };
    value.shift = shift.value;
  } else if (!isUpdate) {
    return { ok: false, message: 'A swap needs a shift' };
  }

  const target = refField(body.targetEmployee);
  if (target.bad) return { ok: false, message: 'targetEmployee must be a valid id' };
  // Absent on a create means an OPEN swap, which is a value — hence the null
  // rather than leaving the field off and letting the model default decide.
  if (!target.skip) value.targetEmployee = target.value;
  else if (!isUpdate) value.targetEmployee = null;

  if (body.note !== undefined) value.note = trimmed(body.note);

  return { ok: true, value };
}

/**
 * Is the shift under this swap still the shift that was offered?
 *
 * A swap passes through three hands over days — the owner offers it, the target
 * accepts, a manager approves — and approval is the ONLY thing that writes
 * `Shift.employee`. Between the accept and the decision the roster keeps moving:
 * the shift can be cancelled, re-rostered onto somebody else, emptied back to
 * open, or simply happen.
 *
 * WHY THIS IS NOT ONLY A ROSTER PROBLEM
 * -------------------------------------
 * attendanceRating.helpers.js takes its denominator from the shifts an employee
 * holds *now*, not from who held them on the day. So rewriting `Shift.employee`
 * on a shift that has already been worked rewrites two people's history at
 * once: the person who actually worked it keeps an attendance record that now
 * cites a shift belonging to somebody else (counted as `unrostered`), and the
 * person who never worked it inherits an ended, published shift with no record
 * against it — which is precisely the definition of an absence. Neither of them
 * did anything, and neither is told.
 *
 * `checkAssignment` cannot catch any of this: it judges whether the TARGET may
 * work the window, which stays true the whole time. This asks the other
 * question — whether the offer still refers to the thing that was offered.
 *
 * @param {object} swap  - the stored request (needs requestedBy)
 * @param {object|null} shift - the stored shift (needs employee, status, start)
 * @param {{now?: Date|number}} [opts]
 * @returns {{ok: true} | {ok: false, code: string, message: string}}
 */
function checkSwapShiftStillValid(swap, shift, opts = {}) {
  const now = new Date(opts.now ?? Date.now()).getTime();

  if (!shift) {
    return {
      ok: false,
      code: 'shift_missing',
      message: 'That shift no longer exists',
    };
  }

  // Reported ahead of the shift merely having started: both are true of an old
  // cancelled shift, and "it was cancelled" is the more useful of the two.
  if (shift.status === 'cancelled') {
    return {
      ok: false,
      code: 'shift_cancelled',
      message: 'That shift has been cancelled — there is nothing to swap',
    };
  }

  const start = new Date(shift.start).getTime();
  if (!Number.isNaN(start) && start <= now) {
    return {
      ok: false,
      code: 'shift_started',
      message: 'That shift has already started — it is a matter for attendance now',
    };
  }

  const holder = idOf(shift.employee);
  if (!holder) {
    return {
      ok: false,
      code: 'shift_open',
      message: 'That shift is open again — assign it from the roster instead',
    };
  }

  if (holder !== idOf(swap?.requestedBy)) {
    return {
      ok: false,
      code: 'shift_reassigned',
      message: 'That shift has been given to somebody else since the swap was raised',
    };
  }

  return { ok: true };
}

/**
 * Did somebody else win the claim on this swap while we were validating?
 *
 * An OPEN swap is claimed by whoever accepts it first, and two people tapping
 * "Take this shift" in the same second both pass every check on a stale read.
 * The controller settles the winner with a conditional update; this decides
 * what the LOSER is told, from the row as it now stands.
 *
 * Returns null when the row moved for any OTHER reason — withdrawn, rejected,
 * approved, or a spurious miss while still pending. Those get the ordinary
 * bad-transition refusal, because naming a rival that does not exist would be
 * its own confusion. Only an `accepted` row held by somebody else is a race
 * somebody lost.
 *
 * @param {object|null} current - the row re-read after the update missed
 * @param {string} me           - the id that tried to answer
 * @returns {{code: string, message: string}|null}
 */
function swapTakenByOther(current, me) {
  if (!current || current.status !== 'accepted') return null;
  const winner = idOf(current.targetEmployee);
  if (!winner || winner === idOf(me)) return null;
  return {
    code: 'already_taken',
    message: 'Somebody else has already taken that shift',
  };
}

module.exports = {
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
  checkSwapShiftStillValid,
  swapTakenByOther,
};
