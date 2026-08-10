// server/services/shift.helpers.js
//
// Pure scheduling rules for the shift roster: clock arithmetic, generation from
// templates, overlap detection and assignment eligibility. No database, no
// Express — every rule here is unit-tested directly.
//
// ON TIME ZONES
// -------------
// A template stores wall-clock times ("09:00"), because "the morning shift" is
// a local-time idea. A Shift stores absolute UTC instants, because that is the
// only thing you can compare, sort or index. Converting between the two needs
// the tenant's offset, which callers pass explicitly (`offsetMinutes`) rather
// than this module reading a global — the server's own TZ is irrelevant and
// relying on it makes results depend on where the process happens to run.
//
// Nigeria (Africa/Lagos, the default tenant timezone) is UTC+1 with no daylight
// saving, so a fixed offset is exact. A tenant in a DST zone would need a real
// tz library; that is deliberately out of scope until one exists.

const { isObjectIdLike } = require('./orgStructure.helpers');

/** Lifecycle of a shift. The model enum reads from here. */
const SHIFT_STATUSES = ['draft', 'published', 'cancelled'];

/** Sunday-first, matching Date#getUTCDay. The template enum reads from here. */
const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6];

/**
 * Africa/Lagos, the only timezone this business operates in, is UTC+1 with no
 * daylight saving. Callers pass an offset explicitly; this is what they fall
 * back to. It is deliberately NOT the server's own offset — the roster must not
 * shift because the process moved host.
 */
const DEFAULT_OFFSET_MINUTES = 60;

/**
 * A tenant's UTC offset in minutes.
 *
 * Read from the tenant document, never from the process — a roster rendered on
 * a UTC build host and one rendered locally have to agree, and
 * `new Date().getTimezoneOffset()` guarantees they will not. Every controller
 * that converts between instants and local days goes through here so there is
 * one answer to "what time is it for this business".
 */
function tenantOffsetMinutes(tenant) {
  const raw = tenant?.utcOffsetMinutes ?? tenant?.settings?.utcOffsetMinutes;
  const n = Number(raw);
  return Number.isFinite(n) ? n : DEFAULT_OFFSET_MINUTES;
}

/** Today on the tenant's calendar as 'YYYY-MM-DD'. */
function tenantToday(offsetMinutes = DEFAULT_OFFSET_MINUTES, now = Date.now()) {
  const offset = Number(offsetMinutes) || 0;
  return new Date(now + offset * 60_000).toISOString().slice(0, 10);
}

/** Legal status moves. Anything absent is refused. */
const SHIFT_TRANSITIONS = {
  draft: ['published', 'cancelled'],
  published: ['cancelled'],
  cancelled: [],
};

// Generating more than a quarter at a time is always a mistake (a slipped date,
// a bad form value) and would write thousands of rows before anyone noticed.
const MAX_GENERATION_DAYS = 92;

const MINUTES_PER_DAY = 24 * 60;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * "HH:MM" → minutes past midnight, or null when it is not a real clock time.
 * @param {string} value
 * @returns {number|null}
 */
function parseTimeOfDay(value) {
  if (typeof value !== 'string') return null;
  const m = TIME_RE.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Minutes past midnight → "HH:MM". */
function formatTimeOfDay(minutes) {
  const n = ((Number(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Does this shift run past midnight?
 *
 * An end at or before the start means it does. Equal times are a 24-hour cover,
 * not a zero-length shift — nobody schedules zero minutes, and reading it that
 * way would silently create empty shifts.
 *
 * When `endDayOffset` is provided and > 0, the shift explicitly crosses into
 * a later calendar day (e.g. 08:40→09:00 with offset 1 = 24h 20m), so it
 * returns true regardless of the wall-clock comparison.
 */
function crossesMidnight(startTime, endTime, endDayOffset) {
  const offset = Number(endDayOffset) || 0;
  if (offset > 0) return true;
  const s = parseTimeOfDay(startTime);
  const e = parseTimeOfDay(endTime);
  if (s === null || e === null) return false;
  return e <= s;
}

/** Parse a 'YYYY-MM-DD' local date into its UTC midnight instant, or null. */
function parseDateOnly(dateISO) {
  if (typeof dateISO !== 'string' || !DATE_RE.test(dateISO.trim())) return null;
  const ms = Date.parse(`${dateISO.trim()}T00:00:00.000Z`);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Build the absolute UTC window for a shift on a local calendar date.
 *
 * @param {string} dateISO       - 'YYYY-MM-DD' in the tenant's local calendar
 * @param {string} startTime     - 'HH:MM' local
 * @param {string} endTime       - 'HH:MM' local
 * @param {number} offsetMinutes - the tenant's UTC offset (Africa/Lagos = 60)
 * @param {number} endDayOffset  - calendar days after start the end falls on
 *                                 (0 = same day, 1 = next day, etc.)
 * @returns {{start: Date, end: Date}|null} null when any input is unusable
 */
function shiftWindow(dateISO, startTime, endTime, offsetMinutes = 60, endDayOffset) {
  const dayMs = parseDateOnly(dateISO);
  const s = parseTimeOfDay(startTime);
  const e = parseTimeOfDay(endTime);
  if (dayMs === null || s === null || e === null) return null;

  const offset = Number(offsetMinutes) || 0;
  const startMs = dayMs + (s - offset) * MS_PER_MINUTE;
  // Use the explicit offset when provided (> 0); fall back to the legacy
  // heuristic: endTime ≤ startTime means next day.
  const daysAhead = Number(endDayOffset) || 0;
  const endDayMs =
    daysAhead > 0
      ? dayMs + daysAhead * MS_PER_DAY
      : e <= s
        ? dayMs + MS_PER_DAY
        : dayMs;
  const endMs = endDayMs + (e - offset) * MS_PER_MINUTE;

  return { start: new Date(startMs), end: new Date(endMs) };
}

/**
 * Paid minutes: the window less the unpaid break.
 * Clamped at zero — a break longer than the shift is bad data, not negative
 * worked time that would then subtract from a roster's totals.
 */
function shiftDurationMinutes(shift = {}) {
  const start = shift.start ? new Date(shift.start).getTime() : NaN;
  const end = shift.end ? new Date(shift.end).getTime() : NaN;
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  const gross = Math.round((end - start) / MS_PER_MINUTE);
  return Math.max(0, gross - (Number(shift.breakMinutes) || 0));
}

/**
 * Every local calendar date from `from` to `to`, inclusive.
 * Returns [] when the range is inverted or unparseable, and is hard-capped at
 * MAX_GENERATION_DAYS so one bad request cannot write a year of shifts.
 */
function eachDateInRange(from, to) {
  const a = parseDateOnly(from);
  const b = parseDateOnly(to);
  if (a === null || b === null || b < a) return [];

  const out = [];
  for (let ms = a; ms <= b && out.length < MAX_GENERATION_DAYS; ms += MS_PER_DAY) {
    out.push(new Date(ms).toISOString().slice(0, 10));
  }
  return out;
}

/** Day of week (0=Sun..6=Sat) for a local calendar date. */
function dayOfWeek(dateISO) {
  const ms = parseDateOnly(dateISO);
  return ms === null ? null : new Date(ms).getUTCDay();
}

const idOf = (v) => (v && v._id ? String(v._id) : v == null ? '' : String(v));

/**
 * Plan the shifts to create for a date range from a set of templates.
 *
 * Everything it produces is an OPEN draft: the roster is built first and filled
 * afterwards, which is the whole point of allowing an unassigned shift.
 *
 * Idempotent — a shift already stored for the same (template, start) is skipped,
 * so re-running over a range that was partly generated tops it up instead of
 * duplicating it.
 *
 * @param {object[]} templates
 * @param {{from: string, to: string, offsetMinutes?: number, existing?: object[]}} opts
 * @returns {{toCreate: object[], skipped: {template: string, date?: string, reason: string}[]}}
 */
function planShiftGeneration(templates = [], opts = {}) {
  const { from, to, offsetMinutes = 60, existing = [] } = opts;
  const dates = eachDateInRange(from, to);

  // Key on template + exact start instant: the same template on the same day is
  // one shift, however many times generation is re-run.
  const taken = new Set(
    existing
      .filter((s) => s.status !== 'cancelled')
      .map((s) => `${idOf(s.template)}@${new Date(s.start).getTime()}`)
  );

  const toCreate = [];
  const skipped = [];

  for (const tpl of templates) {
    const name = tpl?.name || idOf(tpl?._id);

    if (tpl?.isActive === false) {
      skipped.push({ template: name, reason: 'Template is inactive' });
      continue;
    }
    if (parseTimeOfDay(tpl?.startTime) === null || parseTimeOfDay(tpl?.endTime) === null) {
      skipped.push({ template: name, reason: 'Template has an invalid start or end time' });
      continue;
    }

    const days = Array.isArray(tpl.daysOfWeek) ? tpl.daysOfWeek.map(Number) : [];
    if (!days.length) {
      skipped.push({ template: name, reason: 'Template has no days of the week set' });
      continue;
    }

    for (const date of dates) {
      if (!days.includes(dayOfWeek(date))) continue;

      const endDayOffset = tpl.endDayOffset ?? 0;
      const window = shiftWindow(date, tpl.startTime, tpl.endTime, offsetMinutes, endDayOffset);
      if (!window) {
        skipped.push({ template: name, date, reason: 'Could not build a time window' });
        continue;
      }

      const key = `${idOf(tpl._id)}@${window.start.getTime()}`;
      if (taken.has(key)) {
        skipped.push({ template: name, date, reason: 'A shift already exists for this slot' });
        continue;
      }
      taken.add(key);

      toCreate.push({
        template: idOf(tpl._id),
        date,
        employee: null, // open by design
        role: idOf(tpl.role),
        department: tpl.department ? idOf(tpl.department) : null,
        start: window.start,
        end: window.end,
        breakMinutes: Number(tpl.breakMinutes) || 0,
        status: 'draft',
      });
    }
  }

  return { toCreate, skipped };
}

/**
 * Shifts belonging to the same employee whose time overlaps the candidate.
 *
 * Windows are half-open — `[start, end)` — so a shift starting exactly when the
 * previous one ends is a legal back-to-back double, not a conflict.
 *
 * Open shifts, cancelled shifts and the candidate itself are never conflicts.
 */
function findOverlaps(candidate, existing = []) {
  const employeeId = idOf(candidate?.employee);
  if (!employeeId) return []; // an open shift conflicts with nobody

  const start = new Date(candidate.start).getTime();
  const end = new Date(candidate.end).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return [];

  const selfId = idOf(candidate?._id);

  return existing.filter((s) => {
    if (s.status === 'cancelled') return false;
    if (idOf(s.employee) !== employeeId) return false;
    if (selfId && idOf(s._id) === selfId) return false;

    const sStart = new Date(s.start).getTime();
    const sEnd = new Date(s.end).getTime();
    if (Number.isNaN(sStart) || Number.isNaN(sEnd)) return false;

    return start < sEnd && sStart < end;
  });
}

/** Does an approved time-off request cover any part of this window? */
function overlapsTimeOff(candidate, timeOff = []) {
  const start = new Date(candidate.start).getTime();
  const end = new Date(candidate.end).getTime();

  return timeOff.filter((t) => {
    // Only an approved request is a commitment; pending is still a question.
    if (t.status !== 'approved') return false;
    const tStart = new Date(t.startDate).getTime();
    const tEnd = new Date(t.endDate).getTime();
    if (Number.isNaN(tStart) || Number.isNaN(tEnd)) return false;
    return start < tEnd && tStart < end;
  });
}

/**
 * May this employee be assigned to this shift?
 *
 * The two failures are deliberately different in kind:
 *
 *   role_mismatch — a judgement call. An admin who knows the person can cover it
 *                   may override with `force`, and the override is reported back
 *                   as a warning so it is never silent.
 *   overlap       — physics. Nobody works two shifts at once, so `force` does
 *                   NOT override it.
 *
 * @param {object} shift    - { role, start, end, _id? }
 * @param {object} employee - the User doc (needs status + employeeProfile.planning.roles)
 * @param {{shifts?: object[], timeOff?: object[], force?: boolean}} ctx
 * @returns {{ok: true, warnings: object[]} | {ok: false, code: string, message: string, conflicts?: object[]}}
 */
function checkAssignment(shift, employee, ctx = {}) {
  const { shifts = [], timeOff = [], force = false } = ctx;
  const warnings = [];

  if (!employee) {
    return { ok: false, code: 'no_employee', message: 'Employee not found' };
  }
  if (employee.status && employee.status !== 'active') {
    return {
      ok: false,
      code: 'inactive',
      message: 'Only active employees can be scheduled',
    };
  }

  // Overlap first: it is unconditional, so reporting it takes priority over a
  // role warning the admin could otherwise wave through.
  const conflicts = findOverlaps({ ...shift, employee: employee._id }, shifts);
  if (conflicts.length) {
    return {
      ok: false,
      code: 'overlap',
      message: 'This employee is already scheduled during that time',
      conflicts,
    };
  }

  const away = overlapsTimeOff(shift, timeOff);
  if (away.length) {
    return {
      ok: false,
      code: 'time_off',
      message: 'This employee has approved time off covering that period',
      conflicts: away,
    };
  }

  const held = (employee.employeeProfile?.planning?.roles || []).map(idOf);
  const required = idOf(shift.role);
  if (required && !held.includes(required)) {
    if (!force) {
      return {
        ok: false,
        code: 'role_mismatch',
        message: 'This employee is not marked as able to work that role',
      };
    }
    warnings.push({
      code: 'role_mismatch',
      message: 'Assigned to a role this employee is not marked for',
    });
  }

  return { ok: true, warnings };
}

/**
 * Headline numbers for a roster view. Cancelled shifts are excluded from every
 * count and from the hours — they are kept for audit, not for planning.
 */
function summariseRoster(shifts = []) {
  const live = shifts.filter((s) => s.status !== 'cancelled');
  let minutes = 0;
  let open = 0;
  let draft = 0;
  let published = 0;

  for (const s of live) {
    minutes += shiftDurationMinutes(s);
    if (!idOf(s.employee)) open += 1;
    if (s.status === 'draft') draft += 1;
    if (s.status === 'published') published += 1;
  }

  return {
    total: live.length,
    open,
    assigned: live.length - open,
    draft,
    published,
    scheduledHours: Math.round((minutes / 60) * 100) / 100,
  };
}

/** Is this status move legal? */
function canTransitionShift(from, to) {
  return (SHIFT_TRANSITIONS[from] || []).includes(to);
}

/** Every status a shift may legally move to `to` FROM. Keeps the transition
 *  table the single source of truth for bulk moves like publish, which would
 *  otherwise hard-code `status: 'draft'` in a query and drift from it. */
function statusesThatCanBecome(to) {
  return SHIFT_STATUSES.filter((from) => canTransitionShift(from, to));
}

// ── Request payloads ──────────────────────────────────────────────────────────
//
// Same split as orgStructure.helpers.js: the controller does IO, everything that
// can be decided from the request body alone is decided here and unit-tested.

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Coerce a reference field. `undefined` means the caller omitted it, `null`/''
 * means an explicit clear, anything else must be castable to an ObjectId.
 */
function refField(value) {
  if (value === undefined) return { skip: true };
  if (value === null || value === '') return { value: null };
  if (!isObjectIdLike(value)) return { bad: true };
  return { value: typeof value === 'object' && value._id ? String(value._id) : String(value) };
}

/**
 * Non-negative minutes, used for break lengths.
 * @returns {{ok: true, value: number} | {ok: false}}
 */
function nonNegativeMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  return { ok: true, value: Math.round(n) };
}

/**
 * Normalise `daysOfWeek`: integers 0..6, de-duplicated and sorted.
 * A day list out of order or with repeats would generate the same shift twice.
 * @returns {{ok: true, value: number[]} | {ok: false}}
 */
function normaliseDaysOfWeek(input) {
  if (!Array.isArray(input)) return { ok: false };
  const out = new Set();
  for (const raw of input) {
    const n = Number(raw);
    if (!Number.isInteger(n) || !DAYS_OF_WEEK.includes(n)) return { ok: false };
    out.add(n);
  }
  return { ok: true, value: [...out].sort((a, b) => a - b) };
}

/**
 * Validate + normalise a ShiftTemplate payload.
 *
 * @param {object} body
 * @param {{isUpdate?: boolean}} [opts]
 * @returns {{ok: true, value: object} | {ok: false, message: string}}
 */
function buildShiftTemplatePayload(body = {}, opts = {}) {
  const isUpdate = Boolean(opts.isUpdate);
  const value = {};

  if (body.name !== undefined) {
    const name = trimmed(body.name);
    if (!name) return { ok: false, message: 'Template name cannot be empty' };
    value.name = name;
  } else if (!isUpdate) {
    return { ok: false, message: 'Template name is required' };
  }

  // A shift exists to be filled by someone qualified, so the role it needs is
  // the one ref that is never optional.
  const role = refField(body.role);
  if (role.bad) return { ok: false, message: 'role must be a valid id' };
  if (!role.skip) {
    if (!role.value) return { ok: false, message: 'A template must require a role' };
    value.role = role.value;
  } else if (!isUpdate) {
    return { ok: false, message: 'A template must require a role' };
  }

  const dept = refField(body.department);
  if (dept.bad) return { ok: false, message: 'department must be a valid id' };
  if (!dept.skip) value.department = dept.value;

  for (const field of ['startTime', 'endTime']) {
    if (body[field] !== undefined) {
      if (parseTimeOfDay(body[field]) === null) {
        return { ok: false, message: `${field} must be a time like 09:00` };
      }
      value[field] = trimmed(body[field]);
    } else if (!isUpdate) {
      return { ok: false, message: `${field} is required` };
    }
  }

  if (body.endDayOffset !== undefined) {
    const n = Number(body.endDayOffset);
    if (!Number.isFinite(n) || n < 0 || n > 6 || Math.floor(n) !== n) {
      return { ok: false, message: 'End day offset must be a whole number from 0 to 6' };
    }
    value.endDayOffset = n;
  }

  if (body.breakMinutes !== undefined) {
    const mins = nonNegativeMinutes(body.breakMinutes);
    if (!mins.ok) return { ok: false, message: 'Break minutes must be zero or more' };
    value.breakMinutes = mins.value;
  }

  if (body.daysOfWeek !== undefined) {
    const days = normaliseDaysOfWeek(body.daysOfWeek);
    if (!days.ok) {
      return { ok: false, message: 'Days of the week must be numbers from 0 (Sunday) to 6' };
    }
    value.daysOfWeek = days.value;
  }

  if (body.color !== undefined) {
    const color = trimmed(body.color);
    if (color && !HEX_COLOR_RE.test(color)) {
      return { ok: false, message: 'Colour must be a hex value like #b20202' };
    }
    value.color = color;
  }

  if (body.note !== undefined) value.note = trimmed(body.note);
  if (body.isActive !== undefined) value.isActive = Boolean(body.isActive);
  else if (!isUpdate) value.isActive = true;

  return { ok: true, value };
}

/**
 * Validate + normalise a Shift payload.
 *
 * `employee` is nullable on purpose: an open shift is the normal starting state
 * of every generated roster, so "no employee" is a value, not a missing field.
 *
 * @param {object} body
 * @param {{isUpdate?: boolean}} [opts]
 * @returns {{ok: true, value: object} | {ok: false, message: string}}
 */
function buildShiftPayload(body = {}, opts = {}) {
  const isUpdate = Boolean(opts.isUpdate);
  const value = {};

  for (const field of ['employee', 'template', 'department']) {
    const ref = refField(body[field]);
    if (ref.bad) return { ok: false, message: `${field} must be a valid id` };
    if (!ref.skip) value[field] = ref.value;
  }

  const role = refField(body.role);
  if (role.bad) return { ok: false, message: 'role must be a valid id' };
  if (!role.skip) {
    if (!role.value) return { ok: false, message: 'A shift must require a role' };
    value.role = role.value;
  } else if (!isUpdate) {
    return { ok: false, message: 'A shift must require a role' };
  }

  for (const field of ['start', 'end']) {
    if (body[field] !== undefined) {
      const ms = Date.parse(body[field]);
      if (Number.isNaN(ms)) return { ok: false, message: `${field} must be a valid date and time` };
      value[field] = new Date(ms);
    } else if (!isUpdate) {
      return { ok: false, message: `${field} is required` };
    }
  }

  if (body.breakMinutes !== undefined) {
    const mins = nonNegativeMinutes(body.breakMinutes);
    if (!mins.ok) return { ok: false, message: 'Break minutes must be zero or more' };
    value.breakMinutes = mins.value;
  }

  if (body.note !== undefined) value.note = trimmed(body.note);

  return { ok: true, value };
}

/**
 * Check a shift's own times once both ends are known.
 *
 * Split from buildShiftPayload because a PATCH may send only one end, and the
 * other has to come off the stored document before the pair can be compared.
 */
function validateShiftTimes(start, end) {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return { ok: false, message: 'A shift needs a valid start and end' };
  }
  if (b <= a) return { ok: false, message: 'A shift must end after it starts' };
  return { ok: true };
}

/**
 * Turn `?from=&to=` into the absolute UTC window covering those LOCAL calendar
 * days, inclusive of `to`.
 *
 * The end is the start of the day AFTER `to`, so a shift beginning at 23:30 on
 * the last day is inside the window — an inclusive-end comparison against the
 * day's own midnight would silently drop it.
 *
 * @returns {{ok: true, from: string, to: string, start: Date, end: Date}
 *          | {ok: false, message: string}}
 */
function parseRosterRange(query = {}, offsetMinutes = DEFAULT_OFFSET_MINUTES) {
  const from = trimmed(query.from);
  const to = trimmed(query.to);
  const dates = eachDateInRange(from, to);

  if (!dates.length) {
    return { ok: false, message: 'from and to must be dates like 2026-08-10, with to on or after from' };
  }
  // eachDateInRange caps at MAX_GENERATION_DAYS rather than erroring, so a
  // truncated list is how an over-long range shows up here.
  if (dates[dates.length - 1] !== to) {
    return { ok: false, message: `A range may cover at most ${MAX_GENERATION_DAYS} days` };
  }

  const offset = Number(offsetMinutes) || 0;
  const startMs = parseDateOnly(from) - offset * MS_PER_MINUTE;
  const endMs = parseDateOnly(to) + MS_PER_DAY - offset * MS_PER_MINUTE;

  return { ok: true, from, to, start: new Date(startMs), end: new Date(endMs) };
}

module.exports = {
  SHIFT_STATUSES,
  SHIFT_TRANSITIONS,
  DAYS_OF_WEEK,
  DEFAULT_OFFSET_MINUTES,
  MAX_GENERATION_DAYS,
  tenantOffsetMinutes,
  tenantToday,
  parseTimeOfDay,
  formatTimeOfDay,
  crossesMidnight,
  shiftWindow,
  shiftDurationMinutes,
  eachDateInRange,
  dayOfWeek,
  planShiftGeneration,
  findOverlaps,
  overlapsTimeOff,
  checkAssignment,
  summariseRoster,
  canTransitionShift,
  statusesThatCanBecome,
  buildShiftTemplatePayload,
  buildShiftPayload,
  validateShiftTimes,
  parseRosterRange,
};
