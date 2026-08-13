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
 * How a template repeats. The template enum reads from here.
 *
 *   weekly — the original: a set of weekdays, repeating every 7 days.
 *   cycle  — N days on, M days off. A cycle whose length does not divide 7
 *            changes weekday every week (one-on/one-off is Mon/Wed/Fri, then
 *            Sun/Tue/Thu), so no set of weekday flags can express it.
 */
const RECURRENCE_TYPES = ['weekly', 'cycle'];

/**
 * A rotation longer than a year is a data-entry slip, not a pattern anyone
 * works, and it would make the roster's phase impossible to reason about.
 */
const MAX_CYCLE_LENGTH = 366;

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

// N employees x M days is a product, and MAX_GENERATION_DAYS only bounds M. A
// direct request with a huge employee list and a long range would otherwise
// plan and insertMany thousands of rows in a single call.
const MAX_FILL_ROWS = 2000;

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

/**
 * Whole days from `fromISO` to `toISO`. Negative when `toISO` is earlier.
 * Both are UTC midnights, so this is exact — no DST hour to lose.
 */
function daysBetween(fromISO, toISO) {
  const a = parseDateOnly(fromISO);
  const b = parseDateOnly(toISO);
  if (a === null || b === null) return null;
  return Math.round((b - a) / MS_PER_DAY);
}

/** Remainder that is always in 0..m-1. `%` alone goes negative before the anchor. */
function floorMod(n, m) {
  return ((n % m) + m) % m;
}

/**
 * Validate + normalise a cycle: `{cycleLength, cycleDays, anchorDate}`.
 *
 * `cycleDays` is de-duplicated and sorted for the same reason
 * normaliseDaysOfWeek does it — a repeated offset generated the same shift
 * twice. An EMPTY list is valid and means "nothing"; it is emphatically not
 * "every day", which is what a permissive reading would silently produce.
 *
 * `anchorDate` is required and never derived. Without a stored origin, "day 0"
 * would have to come from the range being generated, and generating March then
 * April would land on different phases — quietly breaking the top-up guarantee
 * planShiftGeneration makes.
 *
 * @returns {{ok: true, value: {cycleLength: number, cycleDays: number[], anchorDate: string}}
 *          | {ok: false, message: string}}
 */
function normaliseCycle(input = {}) {
  const length = Number(input?.cycleLength);
  if (!Number.isInteger(length) || length < 1 || length > MAX_CYCLE_LENGTH) {
    return {
      ok: false,
      message: `Cycle length must be a whole number of days from 1 to ${MAX_CYCLE_LENGTH}`,
    };
  }

  if (!Array.isArray(input?.cycleDays)) {
    return { ok: false, message: 'Cycle days must be a list of day numbers' };
  }
  const days = new Set();
  for (const raw of input.cycleDays) {
    // Coerced like normaliseDaysOfWeek, so a form posting "0" is not a mystery
    // 400 — but stored as a real integer, which is what generation compares.
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n >= length) {
      return {
        ok: false,
        message: `Each worked day must be a whole number from 0 to ${length - 1}`,
      };
    }
    days.add(n);
  }

  const anchorDate = typeof input?.anchorDate === 'string' ? input.anchorDate.trim() : '';
  if (parseDateOnly(anchorDate) === null) {
    return { ok: false, message: 'A cycle needs an anchor date like 2026-08-10 to fix its phase' };
  }

  return {
    ok: true,
    value: { cycleLength: length, cycleDays: [...days].sort((a, b) => a - b), anchorDate },
  };
}

/**
 * Is this local calendar date a worked day of the cycle?
 *
 * A pure function of the date and the stored cycle, so any range generates
 * identically however many times, in whatever order, it is run. Unusable input
 * is false rather than an exception — generation reports a bad template, it does
 * not crash on one.
 */
function isCycleWorkDay(dateISO, cycle) {
  const norm = normaliseCycle(cycle || {});
  if (!norm.ok) return false;
  const offset = daysBetween(norm.value.anchorDate, dateISO);
  if (offset === null) return false;
  // floorMod, not %: a manager backfilling last month is ordinary, and % would
  // hand back a negative that matches no offset.
  return norm.value.cycleDays.includes(floorMod(offset, norm.value.cycleLength));
}

const idOf = (v) => (v && v._id ? String(v._id) : v == null ? '' : String(v));

/**
 * Which dates in a range does this template actually work?
 *
 * The ONE reader of `recurrence` / `daysOfWeek` / `cycleDays` / `anchorDate` on
 * the server. Both planners call it, so a cycle bug fixed in one path cannot
 * silently survive in the other.
 *
 * Refusal reasons are the strings `planShiftGeneration` has always reported in
 * its `skipped` list — they are user-visible and must not drift.
 *
 * @param {object} template
 * @param {string[]} dates - 'YYYY-MM-DD', from eachDateInRange
 * @returns {{ok: true, template: string, dates: string[]}
 *          |{ok: false, template: string, reason: string}}
 */
function patternDates(template, dates = []) {
  const name = template?.name || idOf(template?._id);
  const no = (reason) => ({ ok: false, template: name, reason });

  if (template?.isActive === false) return no('Template is inactive');
  if (
    parseTimeOfDay(template?.startTime) === null ||
    parseTimeOfDay(template?.endTime) === null
  ) {
    return no('Template has an invalid start or end time');
  }

  // Two kinds of recurrence, decided once. Anything not explicitly a cycle is
  // weekly, so every template written before cycles existed keeps generating
  // exactly the roster it already generated.
  let isWorkDay;
  if (template?.recurrence === 'cycle') {
    const cycle = normaliseCycle(template);
    if (!cycle.ok) return no(cycle.message);
    if (!cycle.value.cycleDays.length) {
      return no('Template has no worked days in its cycle');
    }
    isWorkDay = (date) => isCycleWorkDay(date, cycle.value);
  } else {
    const days = Array.isArray(template.daysOfWeek)
      ? template.daysOfWeek.map(Number)
      : [];
    if (!days.length) return no('Template has no days of the week set');
    isWorkDay = (date) => days.includes(dayOfWeek(date));
  }

  return { ok: true, template: name, dates: dates.filter(isWorkDay) };
}

/**
 * A template's positions, with a legacy single-role template normalised into
 * one position of count 1.
 *
 * THE ONE READER of `positions` — every planner goes through it, exactly as
 * patternDates is the one reader of recurrence/cycleDays/anchorDate. A second
 * reader is how a template written before positions existed starts generating a
 * different roster from the one it has generated for months.
 *
 * A position with no roles is dropped rather than normalised: a shift nobody
 * can be checked against is the thing ShiftTemplate.role was made required to
 * prevent.
 *
 * @param {object} template
 * @returns {{_id: string|null, roles: string[], count: number}[]}
 */
function templatePositions(template) {
  const raw = Array.isArray(template?.positions) ? template.positions : [];
  const positions = raw
    .map((p) => ({
      _id: p?._id ? idOf(p._id) : null,
      roles: (Array.isArray(p?.roles) ? p.roles : []).map(idOf).filter(Boolean),
      count: Math.max(1, Math.floor(Number(p?.count)) || 1),
    }))
    .filter((p) => p.roles.length);

  if (positions.length) return positions;

  const role = template?.role ? idOf(template.role) : null;
  return role ? [{ _id: null, roles: [role], count: 1 }] : [];
}

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

  // Key on template + exact start instant + POSITION, and COUNT rather than
  // flag. One template now emits a row per position per day, so
  // `template@start` alone is no longer unique and a boolean "taken" can no
  // longer express "2 of the 3 servers this slot wants already exist".
  //
  // The position's _id is the handle because it survives BOTH reordering and
  // edits to its roles. A key derived from the role SET survives reordering
  // only: widening "Server" to "Server OR Runner" would rekey every day
  // already generated, and the next run would duplicate the lot.
  //
  // A legacy template has no positions, so templatePositions hands back
  // _id: null, the key is `template@start@`, and both an old row (no
  // templatePosition field at all) and a new one land on it — which is what
  // makes generation of an untouched template byte-identical to before.
  const keyOf = (templateId, startMs, positionId) =>
    `${templateId}@${startMs}@${positionId || ''}`;

  const counts = new Map();
  for (const s of existing) {
    if (s.status === 'cancelled') continue;
    const key = keyOf(
      idOf(s.template),
      new Date(s.start).getTime(),
      s.templatePosition ? idOf(s.templatePosition) : ''
    );
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const toCreate = [];
  const skipped = [];

  for (const tpl of templates) {
    const plan = patternDates(tpl, dates);
    if (!plan.ok) {
      skipped.push({ template: plan.template, reason: plan.reason });
      continue;
    }
    const name = plan.template;

    const positions = templatePositions(tpl);
    if (!positions.length) {
      skipped.push({ template: name, reason: 'Template has no role to fill' });
      continue;
    }

    for (const date of plan.dates) {
      const endDayOffset = tpl.endDayOffset ?? 0;
      const window = shiftWindow(
        date,
        tpl.startTime,
        tpl.endTime,
        offsetMinutes,
        endDayOffset
      );
      if (!window) {
        skipped.push({ template: name, date, reason: 'Could not build a time window' });
        continue;
      }

      for (const pos of positions) {
        const key = keyOf(idOf(tpl._id), window.start.getTime(), pos._id);
        const have = counts.get(key) || 0;
        if (have >= pos.count) {
          skipped.push({
            template: name,
            date,
            position: pos._id,
            reason: 'A shift already exists for this slot',
          });
          continue;
        }

        for (let i = have; i < pos.count; i += 1) {
          toCreate.push({
            template: idOf(tpl._id),
            templatePosition: pos._id,
            date,
            employee: null, // open by design
            role: pos.roles[0], // the primary: colours and labels the row
            altRoles: pos.roles.slice(1),
            department: tpl.department ? idOf(tpl.department) : null,
            start: window.start,
            end: window.end,
            breakMinutes: Number(tpl.breakMinutes) || 0,
            status: 'draft',
          });
        }
        counts.set(key, pos.count);
      }
    }
  }

  return { toCreate, skipped };
}

/** "Ada Obi", or the id when a name is missing — skips must always name someone. */
const employeeLabel = (e) =>
  [e?.firstName, e?.lastName].filter(Boolean).join(' ') || idOf(e?._id);

/**
 * Seats for a fill: who is going on the pattern, and in which position.
 *
 * Accepts a bare User doc as well as {employee, position}, because
 * POST /api/shifts/fill shipped in f91201bb taking a flat list of employee ids
 * and that contract must keep working. A bare entry takes the template's sole
 * position, or null when the template is a legacy single-role one.
 *
 * @param {object[]} entries
 * @param {{_id: string|null}[]} positions - from templatePositions
 * @returns {{employee: object, position: string|null}[]}
 */
function normaliseSeats(entries = [], positions = []) {
  const sole = positions.length === 1 ? positions[0]._id : null;
  return entries.filter(Boolean).map((entry) => {
    const isSeat = entry.employee !== undefined;
    return {
      employee: isSeat ? entry.employee : entry,
      position: isSeat ? (entry.position ? idOf(entry.position) : sole) : sole,
    };
  });
}

/**
 * Plan the shifts to create when several people are put on one pattern.
 *
 * Where planShiftGeneration builds an OPEN roster, this fills a pattern with
 * named people: one row per person per worked day.
 *
 * SKIPS RATHER THAN REFUSING. The multi-select create is all-or-nothing — if
 * anyone is blocked it writes nothing and answers 409 — which is right for 3
 * people on 1 day. Here it would be 3 x 30 = 90 judgements, and one overlap on
 * day 17 would refuse all 90 rows. So a blocked person-day is skipped and
 * reported, and everything else is still written. THIS DIVERGENCE IS
 * DELIBERATE — do not "fix" it back into all-or-nothing.
 *
 * Every verdict is checkAssignment's; this adds no rules of its own.
 *
 * @param {object} template
 * @param {object[]} seatEntries - each either a User doc (legacy, mapped to the
 *   template's sole position) or {employee: <User doc>, position: <positionId|null>}
 * @param {{from: string, to: string, offsetMinutes?: number, existing?: object[],
 *          ctxById?: Map, force?: boolean}} opts
 * @returns {{toCreate: object[], skipped: object[]}}
 */
function planPatternFill(template, seatEntries = [], opts = {}) {
  const {
    from,
    to,
    offsetMinutes = DEFAULT_OFFSET_MINUTES,
    existing = [],
    ctxById = new Map(),
    force = false,
  } = opts;

  const plan = patternDates(template, eachDateInRange(from, to));
  if (!plan.ok) {
    return { toCreate: [], skipped: [{ template: plan.template, reason: plan.reason }] };
  }

  const positions = templatePositions(template);
  if (!positions.length) {
    return {
      toCreate: [],
      skipped: [{ template: plan.template, reason: 'Template has no role to fill' }],
    };
  }
  const byPosition = new Map(positions.map((p) => [p._id, p]));
  const seats = normaliseSeats(seatEntries, positions);

  // Three-part key, unchanged. Two people's shifts from one template on one day
  // are two different rows, which `template@start` alone cannot express. An
  // open row from /generate keys as `template@start@` and so never collides
  // with a person's row.
  const taken = new Set(
    existing
      .filter((s) => s.status !== 'cancelled')
      .map(
        (s) =>
          `${idOf(s.template)}@${new Date(s.start).getTime()}@${idOf(s.employee)}`
      )
  );

  // How full each position already is, per instant. ONE cap in ONE place: the
  // same want-vs-have arithmetic planShiftGeneration does, so a night cannot be
  // staffed past its count from either entry point.
  const filled = new Map();
  const fillKey = (startMs, positionId) =>
    `${idOf(template._id)}@${startMs}@${positionId || ''}`;
  for (const s of existing) {
    if (s.status === 'cancelled') continue;
    const key = fillKey(
      new Date(s.start).getTime(),
      s.templatePosition ? idOf(s.templatePosition) : ''
    );
    filled.set(key, (filled.get(key) || 0) + 1);
  }

  // A MUTABLE copy of each person's shifts, so a row planned earlier in this
  // batch is a conflict for the rows planned after it. Without this a template
  // with endDayOffset >= 1 would write overlapping shifts for one person on
  // consecutive worked days — neither exists in the database yet when the other
  // is judged, and checkAssignment only sees the context it is handed.
  const batchShifts = new Map();
  for (const seat of seats) {
    const id = idOf(seat.employee?._id);
    batchShifts.set(id, [...contextFor(ctxById, id).shifts]);
  }

  const toCreate = [];
  const skipped = [];
  const endDayOffset = template.endDayOffset ?? 0;

  for (const date of plan.dates) {
    const window = shiftWindow(
      date,
      template.startTime,
      template.endTime,
      offsetMinutes,
      endDayOffset
    );
    if (!window) {
      skipped.push({ template: plan.template, date, reason: 'Could not build a time window' });
      continue;
    }

    for (const seat of seats) {
      const employee = seat.employee;
      const id = idOf(employee?._id);
      const name = employeeLabel(employee);

      const pos = byPosition.get(seat.position);
      if (!pos) {
        skipped.push({
          employee: id,
          name,
          date,
          code: 'no_position',
          reason: 'That position is not on this shift pattern',
          forceable: false,
        });
        continue;
      }

      const key = `${idOf(template._id)}@${window.start.getTime()}@${id}`;
      if (taken.has(key)) {
        skipped.push({
          employee: id,
          name,
          date,
          code: 'exists',
          reason: 'A shift already exists for this slot',
          forceable: false,
        });
        continue;
      }

      // A null-id position is templatePositions's LEGACY fallback — a template
      // with no real `positions` array, standing in for the old bare `role`.
      // Its count:1 is right for planShiftGeneration (one open slot to
      // generate), but it is not a seat cap here: the pre-crew fill contract
      // (f91201bb) always let several named people cover one legacy role on
      // the same day, and that must keep working. Only a REAL, explicitly
      // defined position enforces a capacity.
      const capKey = fillKey(window.start.getTime(), pos._id);
      if (pos._id && (filled.get(capKey) || 0) >= pos.count) {
        skipped.push({
          employee: id,
          name,
          date,
          code: 'position_full',
          reason: `That position is already filled ${pos.count} time${pos.count === 1 ? '' : 's'} — raise its count to add another`,
          forceable: false,
        });
        continue;
      }

      const candidate = {
        role: pos.roles[0],
        altRoles: pos.roles.slice(1),
        start: window.start,
        end: window.end,
      };

      const verdict = checkAssignment(candidate, employee, {
        shifts: batchShifts.get(id) || [],
        timeOff: contextFor(ctxById, id).timeOff,
        force,
      });

      if (!verdict.ok) {
        skipped.push({
          employee: id,
          name,
          date,
          code: verdict.code,
          reason: verdict.message,
          forceable: FORCEABLE_CODES.has(verdict.code),
        });
        continue;
      }

      taken.add(key);
      filled.set(capKey, (filled.get(capKey) || 0) + 1);
      toCreate.push({
        template: idOf(template._id),
        templatePosition: pos._id,
        date,
        employee: id,
        role: pos.roles[0],
        altRoles: pos.roles.slice(1),
        department: template.department ? idOf(template.department) : null,
        start: window.start,
        end: window.end,
        breakMinutes: Number(template.breakMinutes) || 0,
        status: 'draft',
      });

      // Feed this date's slot back so the NEXT date is judged against it —
      // only rows actually planned become conflicts, because a skipped day
      // leaves no shift behind. A template with endDayOffset >= 1 chains its
      // worked days end-to-start; the day after must be judged against the
      // day before's WRITTEN row, not a phantom slot that was never created.
      batchShifts.get(id).push({
        _id: null,
        employee: id,
        status: 'draft',
        start: window.start,
        end: window.end,
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

  // A shift generated from a crew position accepts several roles — "bartender
  // OR barback" — so the test is whether the sets INTERSECT, not whether one
  // id matches. With altRoles empty this is the old `held.includes(required)`
  // exactly, which is what keeps every shift written before crews existed
  // judged the way it has always been judged.
  const held = new Set((employee.employeeProfile?.planning?.roles || []).map(idOf));
  const accepted = [idOf(shift.role), ...(shift.altRoles || []).map(idOf)].filter(Boolean);
  if (accepted.length && !accepted.some((r) => held.has(r))) {
    const what = accepted.length > 1 ? 'any of the roles this shift accepts' : 'that role';
    if (!force) {
      return {
        ok: false,
        code: 'role_mismatch',
        message: `This employee is not marked as able to work ${what}`,
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
 * Which refusals an admin may push through with `force`.
 *
 * Only `role_mismatch` — a judgement call about who can cover what. An overlap
 * is physics and time off is a commitment already made to the person; neither
 * is the admin's to wave away, and offering a button that will be refused again
 * is worse than offering none.
 *
 * Exported so the browser stops keeping a second copy of this list: the picker
 * reads the `forceable` flag off the server's own verdict.
 */
const FORCEABLE_CODES = new Set(['role_mismatch']);

/** One employee's slice of a batched context, with empty lists rather than holes. */
function contextFor(ctxById, employeeId) {
  const entry = ctxById instanceof Map ? ctxById.get(employeeId) : ctxById?.[employeeId];
  return { shifts: entry?.shifts || [], timeOff: entry?.timeOff || [] };
}

/**
 * Judge one shift against several candidates at once.
 *
 * Adds NO rules of its own — every verdict is `checkAssignment`'s. That is the
 * point: the pre-flight badges in the picker and the refusal on save come from
 * the same judge, so they cannot drift apart. Pure; the caller loads the
 * context and passes it in.
 *
 * A `null` entry in `employees` is a candidate id that matched no user in the
 * tenant, and `checkAssignment` already answers `no_employee` for it.
 *
 * @param {object} shift    - { role, start, end, _id? }
 * @param {object[]} employees
 * @param {Map<string, {shifts: object[], timeOff: object[]}>|object} ctxById
 * @param {{force?: boolean}} opts
 * @returns {{allowed: object[], blocked: object[]}}
 */
function judgeAssignments(shift, employees = [], ctxById = new Map(), opts = {}) {
  const { force = false } = opts;
  const allowed = [];
  const blocked = [];

  for (const employee of employees) {
    const ctx = contextFor(ctxById, idOf(employee?._id));
    const verdict = checkAssignment(shift, employee, {
      shifts: ctx.shifts,
      timeOff: ctx.timeOff,
      force,
    });

    if (verdict.ok) {
      allowed.push({ employee, warnings: verdict.warnings });
    } else {
      blocked.push({
        employee,
        code: verdict.code,
        message: verdict.message,
        conflicts: verdict.conflicts || [],
        forceable: FORCEABLE_CODES.has(verdict.code),
      });
    }
  }

  return { allowed, blocked };
}

/**
 * Split a ticked employee set across the shift being edited and the new rows it
 * fans out into.
 *
 * The edited row keeps its identity: it holds the original person if they are
 * still ticked, otherwise the first newcomer — an ordinary reassignment — and
 * everybody left over gets a row of their own. Unticking everybody UNASSIGNS
 * the row: `employee: null` is an open shift waiting to be filled, not a
 * deletion. Cancelling has its own action and this is not it.
 *
 * `ticked` is taken in the order it arrives (the picker sends display order),
 * so which person lands on the existing row never depends on click order.
 *
 * @param {string|object|null} currentEmployeeId
 * @param {Array<string|object>} ticked
 * @returns {{keep: string|null, create: string[]}}
 */
function bindEditedAssignment(currentEmployeeId, ticked = []) {
  const current = idOf(currentEmployeeId);

  const ids = [];
  for (const t of ticked) {
    const id = idOf(t);
    if (id && !ids.includes(id)) ids.push(id);
  }

  if (!ids.length) return { keep: null, create: [] };

  const keep = current && ids.includes(current) ? current : ids[0];
  return { keep, create: ids.filter((id) => id !== keep) };
}

/**
 * Fan flat `$in` query results back out, one context per candidate.
 *
 * Split from the controller so the grouping is testable without a database —
 * the queries themselves stay in the controller, where the IO belongs.
 *
 * Every candidate gets an entry, and an employee with nothing scheduled gets
 * EMPTY ARRAYS rather than `undefined`: `checkAssignment` iterates both lists,
 * and a missing one would read as "no context was loaded" instead of the true
 * "nothing is booked".
 *
 * @param {object[]} employees - the User docs that were found
 * @param {object[]} shifts    - every nearby shift for any of them
 * @param {object[]} timeOff   - every nearby approved request for any of them
 * @returns {Map<string, {employee: object, shifts: object[], timeOff: object[]}>}
 */
function groupAssignmentContexts(employees = [], shifts = [], timeOff = []) {
  const byId = new Map();

  for (const employee of employees) {
    const id = idOf(employee?._id);
    if (id) byId.set(id, { employee, shifts: [], timeOff: [] });
  }
  for (const s of shifts) {
    const entry = byId.get(idOf(s?.employee));
    if (entry) entry.shifts.push(s);
  }
  for (const t of timeOff) {
    const entry = byId.get(idOf(t?.employee));
    if (entry) entry.timeOff.push(t);
  }

  return byId;
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

  // Recurrence. Absent means weekly on create and "leave it alone" on update, so
  // an existing template's rotation cannot be lost by a patch that never
  // mentions it.
  const recurrence = body.recurrence === undefined ? (isUpdate ? null : 'weekly') : body.recurrence;
  if (recurrence !== null) {
    if (!RECURRENCE_TYPES.includes(recurrence)) {
      return { ok: false, message: `recurrence must be one of: ${RECURRENCE_TYPES.join(', ')}` };
    }
    value.recurrence = recurrence;
  }

  if (recurrence === 'cycle') {
    // Validated as a whole: length, offsets and anchor only mean anything
    // together, and a half-set cycle would generate on the wrong days.
    const cycle = normaliseCycle(body);
    if (!cycle.ok) return { ok: false, message: cycle.message };
    Object.assign(value, cycle.value);
  } else if (recurrence === 'weekly') {
    // Cleared, not merely ignored: a stale anchor left behind would silently
    // resurrect the old rotation if the template were switched back.
    value.cycleLength = null;
    value.cycleDays = [];
    value.anchorDate = null;
  } else if (
    body.cycleLength !== undefined ||
    body.cycleDays !== undefined ||
    body.anchorDate !== undefined
  ) {
    // A patch touching the cycle without saying which recurrence it is for
    // cannot be checked against a length it may not have sent.
    return { ok: false, message: 'Send recurrence along with the cycle it describes' };
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

/**
 * The part of a requested range a publish is actually allowed to reach.
 *
 * WHY PUBLISHING CANNOT REACH BACKWARDS
 * ------------------------------------
 * Publishing is what makes a roster visible to the people on it — a draft is a
 * plan the staff have never seen. Attendance, separately, counts a PUBLISHED
 * shift that produced no punch as an absence, because the roster is the
 * denominator (see attendanceRating.helpers.js).
 *
 * Put those together and publishing a range that reaches into the past marks
 * people absent, retroactively, for shifts nobody ever told them about — and
 * there is no action they could have taken, because the day is over. It damages
 * an attendance rating that managers use to judge people. A draft in the past is
 * a plan that did not happen, and it stays a draft.
 *
 * The floor is the START OF TODAY, not the current instant. Refusing a shift
 * that began an hour ago would be an hourly moving target no manager can
 * predict, and that shift is one somebody may be standing in the shop working
 * right now — publishing today's roster at 09:00 has to include the 08:00
 * opening. Whole past DAYS are the harm; the current day is not.
 *
 * The far end is never moved: this is a floor, not a window.
 *
 * @param {object} range the result of parseRosterRange — a failed parse is
 *   passed straight back so the caller reports the real reason rather than
 *   this function turning it into a publishing verdict.
 * @param {number} offsetMinutes the tenant's UTC offset. "Today" is the
 *   TENANT's today: at 00:30 in Lagos it is still yesterday in UTC, and taking
 *   the floor from the wrong calendar publishes an extra day of past drafts.
 * @param {number} [now]
 * @returns {{ok: true, start: Date, end: Date, from: string, to: string,
 *   clamped: boolean} | {ok: false, message: string}}
 */
function clampPublishRange(range, offsetMinutes, now = Date.now()) {
  if (!range?.ok) return range;

  const today = tenantToday(offsetMinutes, now);
  const floor = parseRosterRange({ from: today, to: today }, offsetMinutes);
  // Unreachable in practice — tenantToday always yields a parseable date — but
  // falling back to the range as asked would silently restore the old
  // behaviour, so a floor we cannot compute refuses instead.
  if (!floor.ok) return { ok: false, message: 'Could not work out today’s date' };

  if (range.end <= floor.start) {
    return {
      ok: false,
      message:
        'That range is in the past. Publishing it would mark staff absent for shifts they were never shown.',
    };
  }

  const clamped = range.start < floor.start;
  return {
    ok: true,
    from: range.from,
    to: range.to,
    start: clamped ? floor.start : range.start,
    end: range.end,
    clamped,
  };
}

/**
 * Widen a roster range's context window so it covers every candidate shift a
 * pattern fill can produce, not just the ones that start and end inside the
 * requested range.
 *
 * `parseRosterRange` sets `end` to the start of the day AFTER `to`, which is
 * exactly right for a same-day shift. But a fill candidate is built per date
 * and can run PAST that boundary — whenever the template crosses midnight
 * (`endTime <= startTime`) or carries `endDayOffset > 0`. Loading scheduling
 * context with the un-widened `end` would silently exclude an existing shift
 * or approved time-off request that starts exactly at (or after) that
 * boundary, and `checkAssignment` — the one judge of an assignment — would
 * never see it.
 *
 * Only the end needs widening: a candidate never starts before `range.start`,
 * and a shift straddling `range.start` is already caught by
 * `assignmentContexts`' `end: { $gt: window.start }` condition.
 *
 * Widening the window only ever makes `checkAssignment` better informed, so
 * it cannot cause a false refusal for a shift that genuinely does not
 * overlap — overlap is still decided by the real window comparison.
 *
 * @param {{start: Date, end: Date}} range
 * @param {{endDayOffset?: number}} template
 * @returns {{start: Date, end: Date}}
 */
function fillContextWindow(range, template = {}) {
  const offset = Number(template?.endDayOffset) || 0;
  const widenedEnd = new Date(range.end.getTime() + (offset + 1) * MS_PER_DAY);
  return { start: range.start, end: widenedEnd };
}

module.exports = {
  SHIFT_STATUSES,
  SHIFT_TRANSITIONS,
  clampPublishRange,
  DAYS_OF_WEEK,
  RECURRENCE_TYPES,
  MAX_CYCLE_LENGTH,
  DEFAULT_OFFSET_MINUTES,
  MAX_GENERATION_DAYS,
  MAX_FILL_ROWS,
  tenantOffsetMinutes,
  tenantToday,
  parseTimeOfDay,
  formatTimeOfDay,
  crossesMidnight,
  shiftWindow,
  shiftDurationMinutes,
  eachDateInRange,
  dayOfWeek,
  daysBetween,
  normaliseCycle,
  isCycleWorkDay,
  patternDates,
  planShiftGeneration,
  planPatternFill,
  normaliseSeats,
  findOverlaps,
  overlapsTimeOff,
  checkAssignment,
  FORCEABLE_CODES,
  judgeAssignments,
  bindEditedAssignment,
  groupAssignmentContexts,
  summariseRoster,
  canTransitionShift,
  statusesThatCanBecome,
  buildShiftTemplatePayload,
  buildShiftPayload,
  validateShiftTimes,
  parseRosterRange,
  fillContextWindow,
  templatePositions,
};
