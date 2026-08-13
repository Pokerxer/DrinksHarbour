// Pure helpers for the week roster (`/employees/shifts`).
//
// Kept free of React so they can be unit-tested: the admin's Vitest environment
// is `node` with no jsdom, so components cannot be rendered and any logic worth
// testing has to live outside them — same split as org-config-utils.ts.
//
// ON TIME ZONES
// -------------
// The server stores absolute UTC instants; a roster is read in the tenant's
// local wall clock. Every conversion here takes `offsetMinutes` explicitly
// rather than using the browser's own zone, so an admin travelling does not see
// the Lagos morning shift land on the wrong column. Africa/Lagos is UTC+1 with
// no daylight saving, which is why a fixed offset is exact.

import type {
  Shift,
  ShiftStatus,
  AvailabilityVerdict,
} from '@/services/shift.service';
import { refId } from '@/services/orgStructure.service';

/** Africa/Lagos. Mirrors DEFAULT_OFFSET_MINUTES on the server. */
export const LAGOS_OFFSET_MINUTES = 60;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

const WEEKDAY_SHORT = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;
const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** 'YYYY-MM-DD' → its UTC-midnight instant. NaN when unparseable. */
function dayMs(dateISO: string): number {
  return Date.parse(`${dateISO}T00:00:00.000Z`);
}

/** Shift a 'YYYY-MM-DD' by whole days, staying in that format. */
export function addDays(dateISO: string, days: number): string {
  const ms = dayMs(dateISO);
  if (Number.isNaN(ms)) return dateISO;
  return new Date(ms + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Which LOCAL calendar day a UTC instant falls on. */
export function toLocalDateKey(
  iso: string | Date,
  offsetMinutes = LAGOS_OFFSET_MINUTES
): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  return new Date(ms + offsetMinutes * MS_PER_MINUTE)
    .toISOString()
    .slice(0, 10);
}

/** A UTC instant as a local 'HH:MM'. */
export function toLocalTimeLabel(
  iso: string | Date,
  offsetMinutes = LAGOS_OFFSET_MINUTES
): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  return new Date(ms + offsetMinutes * MS_PER_MINUTE)
    .toISOString()
    .slice(11, 16);
}

/**
 * A local calendar date + 'HH:MM' wall clock → the absolute UTC instant.
 *
 * The inverse of toLocalTimeLabel, and the mirror of the server's shiftWindow:
 * a form collects wall clock, the API stores instants, and the conversion has
 * to use the tenant's offset at both ends or an edit shifts the shift by an
 * hour every time it is saved.
 */
export function toUtcIso(
  dateISO: string,
  time: string,
  offsetMinutes = LAGOS_OFFSET_MINUTES
): string {
  const base = dayMs(dateISO);
  const [h, m] = String(time).split(':').map(Number);
  if (Number.isNaN(base) || !Number.isFinite(h) || !Number.isFinite(m))
    return '';
  return new Date(
    base + (h * 60 + m - offsetMinutes) * MS_PER_MINUTE
  ).toISOString();
}

/**
 * The UTC window for a shift entered as a local date and two wall-clock times.
 * An end at or before the start means it runs into the next day — the same rule
 * the server applies to a template, so a hand-made overnight shift behaves like
 * a generated one.
 *
 * When `endDayOffset` is provided and > 0, it overrides the legacy heuristic
 * and places the end on the requested calendar day.
 */
export function localWindowToUtc(
  dateISO: string,
  startTime: string,
  endTime: string,
  offsetMinutes = LAGOS_OFFSET_MINUTES,
  endDayOffset?: number
): { start: string; end: string } {
  const start = toUtcIso(dateISO, startTime, offsetMinutes);
  const explicit = Number(endDayOffset) || 0;
  const endDate =
    explicit > 0
      ? addDays(dateISO, explicit)
      : endTime <= startTime
        ? addDays(dateISO, 1)
        : dateISO;
  return { start, end: toUtcIso(endDate, endTime, offsetMinutes) };
}

/** Today in the tenant's local calendar, not the browser's. */
export function localToday(offsetMinutes = LAGOS_OFFSET_MINUTES): string {
  return toLocalDateKey(new Date(), offsetMinutes);
}

/**
 * The first day of the week containing `dateISO`.
 * @param weekStartsOn 0 = Sunday, 1 = Monday (the default: the trading week).
 */
export function startOfWeek(dateISO: string, weekStartsOn = 1): string {
  const ms = dayMs(dateISO);
  if (Number.isNaN(ms)) return dateISO;
  const dow = new Date(ms).getUTCDay();
  return addDays(dateISO, -((dow - weekStartsOn + 7) % 7));
}

export interface DayColumn {
  /** 'YYYY-MM-DD' — the key every lane buckets against. */
  date: string;
  /** 0 = Sunday .. 6 = Saturday, matching a template's daysOfWeek. */
  dow: number;
  weekday: string;
  dayNumber: string;
  month: string;
  isWeekend: boolean;
}

/** The seven columns of the week containing `anchorISO`. */
export function buildWeek(anchorISO: string, weekStartsOn = 1): DayColumn[] {
  const first = startOfWeek(anchorISO, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(first, i);
    const d = new Date(dayMs(date));
    const dow = d.getUTCDay();
    return {
      date,
      dow,
      weekday: WEEKDAY_SHORT[dow],
      dayNumber: String(d.getUTCDate()),
      month: MONTH_SHORT[d.getUTCMonth()],
      isWeekend: dow === 0 || dow === 6,
    };
  });
}

/** '10 – 16 Aug 2026', collapsing the month and year when they are shared. */
export function weekRangeLabel(days: DayColumn[]): string {
  if (!days.length) return '';
  const a = days[0];
  const b = days[days.length - 1];
  const yearA = dayMs(a.date) ? new Date(dayMs(a.date)).getUTCFullYear() : '';
  const yearB = dayMs(b.date) ? new Date(dayMs(b.date)).getUTCFullYear() : '';
  if (a.month === b.month && yearA === yearB) {
    return `${a.dayNumber} – ${b.dayNumber} ${b.month} ${yearB}`;
  }
  if (yearA === yearB) {
    return `${a.dayNumber} ${a.month} – ${b.dayNumber} ${b.month} ${yearB}`;
  }
  return `${a.dayNumber} ${a.month} ${yearA} – ${b.dayNumber} ${b.month} ${yearB}`;
}

/** Paid minutes on one shift: the window less its unpaid break, never negative. */
export function shiftMinutes(
  shift: Pick<Shift, 'start' | 'end' | 'breakMinutes'>
): number {
  const start = new Date(shift.start).getTime();
  const end = new Date(shift.end).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.max(
    0,
    Math.round((end - start) / MS_PER_MINUTE) -
      (Number(shift.breakMinutes) || 0)
  );
}

/** '8h', '7h 30m', '45m'. */
export function formatMinutes(minutes: number): string {
  const n = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export interface LaneEmployee {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface RosterLane {
  /** An employee id, or 'open' for the unassigned lane. */
  key: string;
  employeeId: string | null;
  name: string;
  /** date → the shifts starting that local day, earliest first. */
  cells: Record<string, Shift[]>;
  minutes: number;
  count: number;
}

/** Display name for an employee row, never blank. */
export function employeeName(e: LaneEmployee | null | undefined): string {
  if (!e) return 'Unassigned';
  const name = `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim();
  return name || e.email || 'Unnamed employee';
}

function emptyLane(
  key: string,
  employeeId: string | null,
  name: string,
  days: DayColumn[]
): RosterLane {
  const cells: Record<string, Shift[]> = {};
  for (const d of days) cells[d.date] = [];
  return { key, employeeId, name, cells, minutes: 0, count: 0 };
}

/**
 * Bucket a week's shifts into the grid: one lane per employee, plus the open
 * lane the page pins above them.
 *
 * A shift lands on the local day it STARTS, so an overnight shift appears once,
 * on the evening it begins, rather than being split or shown twice.
 *
 * Cancelled shifts are dropped. `cancelled` is terminal — there is no move back
 * out of it — so a cancelled chip would be a permanent piece of clutter with no
 * action attached, and its hours must not count toward the week.
 *
 * Every employee in `employees` gets a lane even with no shifts (that empty row
 * is how an admin sees who is free). An employee who holds a shift but is not in
 * the list — deactivated mid-week — still gets one, or their shift would vanish
 * from the roster while remaining in the database.
 */
export function buildRosterLanes(opts: {
  shifts: Shift[];
  days: DayColumn[];
  employees: LaneEmployee[];
  offsetMinutes?: number;
}): { open: RosterLane; rows: RosterLane[] } {
  const {
    shifts,
    days,
    employees,
    offsetMinutes = LAGOS_OFFSET_MINUTES,
  } = opts;
  const dayKeys = new Set(days.map((d) => d.date));

  const open = emptyLane('open', null, 'Unassigned / open shifts', days);
  const lanes = new Map<string, RosterLane>();
  const known = new Map<string, LaneEmployee>();

  for (const e of employees) {
    const id = String(e._id);
    known.set(id, e);
    lanes.set(id, emptyLane(id, id, employeeName(e), days));
  }

  for (const shift of shifts) {
    if (shift.status === 'cancelled') continue;
    const date = toLocalDateKey(shift.start, offsetMinutes);
    if (!dayKeys.has(date)) continue;

    const id = refId(shift.employee);
    let lane: RosterLane;
    if (!id) {
      lane = open;
    } else {
      if (!lanes.has(id)) {
        // Populated by the API even when the employee is no longer in the
        // active list, so the row can still be named.
        const populated =
          shift.employee && typeof shift.employee === 'object'
            ? shift.employee
            : known.get(id);
        lanes.set(
          id,
          emptyLane(id, id, employeeName(populated as LaneEmployee), days)
        );
      }
      lane = lanes.get(id) as RosterLane;
    }

    lane.cells[date].push(shift);
    lane.minutes += shiftMinutes(shift);
    lane.count += 1;
  }

  // Array.from, not spread: this tsconfig targets ES5 iteration, where
  // spreading a Map/Set iterator is a TS2802.
  const allLanes = [open].concat(Array.from(lanes.values()));
  for (const lane of allLanes) {
    for (const day of days) {
      lane.cells[day.date].sort(
        (a, b) => Date.parse(a.start) - Date.parse(b.start)
      );
    }
  }

  const rows = Array.from(lanes.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  return { open, rows };
}

// ── Conflicts ────────────────────────────────────────────────────────────────

const CONFLICT_LABELS: Record<string, string> = {
  overlap: 'Already scheduled at that time',
  time_off: 'On approved time off',
  role_mismatch: 'Not marked as able to work this role',
  inactive: 'Not an active employee',
  no_employee: 'Employee not found',
  not_draft: 'Published — cancel it instead of deleting',
  // Fill-only: a seat's position was already staffed, or points at a position
  // the pattern doesn't have (edited out from under an in-flight fill). Both
  // are judgements about the SEAT, not the person, so they read as such —
  // display text only; `role_mismatch` stays the only forceable code (that
  // decision is the server's `forceable` flag, never a client-side list).
  position_full: 'That position is already fully staffed',
  no_position: 'That position is not on this shift pattern',
};

/** A 409's `code` as a short line for the assignment form. */
export function conflictLabel(
  code: string,
  fallback = 'Could not be scheduled'
): string {
  return CONFLICT_LABELS[code] ?? fallback;
}

/** One line in the assignment picker: a person, and what stands in their way. */
export interface PickerRow {
  id: string;
  name: string;
  ok: boolean;
  code: string | null;
  reason: string | null;
  forceable: boolean;
}

/**
 * Pair the employee list with the server's pre-flight verdicts.
 *
 * An employee with no verdict is left UNBADGED rather than hidden or blocked:
 * the verdicts arrive after the list does, and a picker that empties itself
 * while a request is in flight is worse than one that shows no warnings yet.
 * The server judges again on save regardless, so nothing here can let a bad
 * assignment through.
 *
 * `extra` is for someone who has to be IN the picker without being in the
 * active-employee list — the clearest case is a shift's current holder, since
 * the page loads `employees` filtered to `status: 'active'` while a shift's own
 * ref can point at someone since suspended or terminated. Left out, that
 * person's tick has nowhere to render: "1 selected" shows with no ticked row,
 * and ticking a colleague on top of it would silently reassign the shift away
 * from them (see toggleTicked). Somebody already in `employees` is not
 * duplicated — `extra` only ever ADDS people, never re-orders the ones already
 * there ahead of the final sort.
 */
export function mergeAvailability(
  employees: LaneEmployee[],
  // Typed as the service's own verdict, NOT a narrower structural shape: the
  // tests pass object literals, and an omitted field would trip TypeScript's
  // excess-property check on every one of them.
  verdicts: AvailabilityVerdict[],
  extra: LaneEmployee[] = []
): PickerRow[] {
  const byId = new Map(
    (verdicts ?? [])
      .filter((v) => v.employee?._id)
      .map((v) => [String(v.employee!._id), v] as const)
  );

  const known = new Set((employees ?? []).map((e) => String(e._id)));
  const combined = (employees ?? []).concat(
    (extra ?? []).filter((e) => !known.has(String(e._id)))
  );

  return (
    combined
      .map((e) => {
        const id = String(e._id);
        const v = byId.get(id);
        return {
          id,
          name: employeeName(e),
          ok: v ? v.ok : true,
          code: v && !v.ok ? v.code : null,
          reason: v && !v.ok && v.code ? conflictLabel(v.code) : null,
          forceable: v ? v.forceable : false,
        };
      })
      // Sorted by name here rather than trusted from `employees`: the employee
      // API orders by `createdAt: -1` for other pages, and `bindEditedAssignment`
      // on the server binds the FIRST ticked id to the row being edited — so
      // which person inherits a row has to track name order, the picker's own
      // stated display order, not an unrelated reverse-creation order that
      // happens to be what this list arrived in.
      .sort((a, b) => a.name.localeCompare(b.name))
  );
}

/**
 * Rebuild the ticked list in the picker's OWN display order, not the order the
 * admin happened to click things in.
 *
 * `bindEditedAssignment` on the server binds the FIRST id in the array to the
 * row already being edited, so if ticking simply appended to a click-ordered
 * list, who inherits that row would depend on which button was pressed first
 * rather than anything visible on screen. Sorting against a position index
 * built from the full, unfiltered `pickerRows` on every tick fixes that — and
 * using the full list rather than whatever the filter currently shows means a
 * person hidden behind a filter term stays ticked instead of silently falling
 * out of the selection the moment someone else is ticked.
 *
 * A ticked id that `pickerRows` does not recognise is KEPT, not dropped, and
 * sorted AHEAD of every recognised id. That id is how a shift's current
 * holder can be ticked (`openExisting` seeds `draft.employees` from the shift
 * itself) while missing from the active-employee list the picker is built
 * from (see `mergeAvailability`'s `extra` param for making them visible, too).
 * Dropping them here — filtering the ticked list down to what `pickerRows`
 * recognises, as this used to — would silently un-tick them the moment
 * anyone else was ticked, and losing the FIRST position on top of that would
 * hand `bindEditedAssignment`'s `keep` to whoever was left, reassigning the
 * row with nothing on screen having said so.
 */
export function toggleTicked(
  pickerRows: PickerRow[],
  ticked: string[],
  id: string,
  checked: boolean
): string[] {
  if (!checked) return ticked.filter((t) => t !== id);
  const want = new Set([...ticked, id]);
  const position = new Map(pickerRows.map((r, i) => [r.id, i]));
  // Array.prototype.sort is a stable sort (guaranteed since ES2019), so two
  // ids that both fail to resolve — position -1 — keep the relative order
  // they had in `want`, i.e. Set insertion order, rather than being shuffled.
  return Array.from(want).sort(
    (a, b) => (position.get(a) ?? -1) - (position.get(b) ?? -1)
  );
}

/** What the conflict panel shows, and which of its two escapes are offered. */
export interface AssignmentOutcome {
  heading: string;
  lines: { id: string; name: string; reason: string }[];
  /** Every block is a judgement call, so "Assign anyway" will actually work. */
  canForceAll: boolean;
  /** Somebody would still be scheduled, so "skip these" means something. */
  canSkip: boolean;
}

/**
 * Turn a 409 into the panel.
 *
 * Both 409 shapes land here: the multi-select one carries `blocked`/`allowed`,
 * and a single-employee save carries only a `code`. The two escape hatches are
 * offered from the SERVER's `forceable` flag, never from a list kept here —
 * offering a button that will be refused again is worse than offering none.
 */
export function summariseAssignmentResult(err: {
  code: string;
  blocked?: {
    employee: LaneEmployee | null;
    code: string;
    forceable: boolean;
    /** Set only on an edit's fan-out: this refusal belongs to the row's OWN
     * reassignment, not one of the newcomers. See the `canSkip` line below. */
    pinned?: boolean;
  }[];
  allowed?: unknown[];
}): AssignmentOutcome {
  const blocked = err.blocked ?? [];
  const allowedCount = (err.allowed ?? []).length;

  if (!blocked.length) {
    // This is the single-employee 409 — a bare `{ code, conflicts }` with no
    // `blocked` array at all, from the back-compat single-or-open save path.
    // It is currently unreachable from THIS drawer (every save here either
    // sends `employees` or assigns nobody), kept as a legacy fallback rather
    // than deleted outright. `canForceAll` stays false deliberately: whether a
    // code is forceable is a decision `judgeAssignments`' `forceable` flag
    // makes on the SERVER, and this shape does not carry one — reintroducing a
    // browser-side FORCEABLE_CODES list to answer it here would be exactly the
    // duplicated rule this feature deleted the last copy of.
    return {
      heading: conflictLabel(err.code),
      lines: [
        {
          id: 'single',
          name: 'This employee',
          reason: conflictLabel(err.code),
        },
      ],
      canForceAll: false,
      canSkip: false,
    };
  }

  const total = blocked.length + allowedCount;
  return {
    heading: allowedCount
      ? `${blocked.length} of ${total} people cannot be scheduled`
      : 'Nobody selected can be scheduled',
    lines: blocked.map((b, i) => ({
      // `employee` can legitimately be null for a `no_employee` verdict, so a
      // real id is preferred but the line's position is the fallback rather
      // than leaving two such lines to collide on the same rendered key.
      id: b.employee?._id ?? `blocked-${i}`,
      name: employeeName(b.employee),
      reason: conflictLabel(b.code),
    })),
    canForceAll: blocked.every((b) => b.forceable),
    // A block PINNED to the row's own reassignment can never be skipped away —
    // `skipBlocked` on the server never touches that person, so offering the
    // button here would just be refused again, byte for byte. Somebody being
    // allowed is not enough on its own; none of the blocks may be pinned.
    canSkip: allowedCount > 0 && !blocked.some((b) => b.pinned),
  };
}

/**
 * The picker's own summary. Zero ticked is not "none" — it is an OPEN SHIFT,
 * the state the whole roster is built in, and the label has to say so.
 */
export function assignedLabel(count: number): string {
  return count ? `${count} selected` : 'Open shift — nobody yet';
}

// ── Generation results ───────────────────────────────────────────────────────

export interface SkipGroup {
  reason: string;
  count: number;
  templates: string[];
}

/**
 * Group a generate run's skips by reason.
 *
 * Skips are the useful output of a generation: "created 0 shifts" with nothing
 * else said is indistinguishable from a broken feature, whereas "5 skipped — a
 * shift already exists for this slot" is the whole answer.
 */
export function summariseSkips(
  skipped: { template: string; reason: string }[]
): SkipGroup[] {
  const groups = new Map<string, SkipGroup>();
  for (const s of skipped ?? []) {
    const reason = s?.reason ?? 'Skipped';
    const group = groups.get(reason) ?? { reason, count: 0, templates: [] };
    group.count += 1;
    if (s?.template && !group.templates.includes(s.template))
      group.templates.push(s.template);
    groups.set(reason, group);
  }
  return Array.from(groups.values()).sort(
    (a, b) => b.count - a.count || a.reason.localeCompare(b.reason)
  );
}

// ── Template display ─────────────────────────────────────────────────────────

/**
 * 'Mon–Fri', 'Mon, Wed, Fri', 'Every day'. Contiguous runs of three or more are
 * collapsed, because a seven-item list of abbreviations is unreadable in a
 * palette chip.
 */
export function templateDaysLabel(daysOfWeek: number[] | undefined): string {
  const days = Array.from(new Set((daysOfWeek ?? []).map(Number)))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b);

  if (!days.length) return 'No days set';
  if (days.length === 7) return 'Every day';

  const parts: string[] = [];
  let run: number[] = [days[0]];
  for (let i = 1; i <= days.length; i += 1) {
    if (i < days.length && days[i] === days[i - 1] + 1) {
      run.push(days[i]);
      continue;
    }
    if (run.length >= 3)
      parts.push(
        `${WEEKDAY_SHORT[run[0]]}–${WEEKDAY_SHORT[run[run.length - 1]]}`
      );
    else parts.push(...run.map((d) => WEEKDAY_SHORT[d]));
    if (i < days.length) run = [days[i]];
  }
  return parts.join(', ');
}

// ── Cycle recurrence ─────────────────────────────────────────────────────────
//
// A mirror of `isCycleWorkDay` in server/services/shift.helpers.js, and it has
// to stay one: this is what the template form previews, and a preview that
// disagrees with the generator is worse than no preview at all. The rule is
// deliberately tiny — offset from a stored anchor, floor-modulo the cycle
// length — so the two copies can be read against each other.

/** What pins a rotation to the calendar. */
export interface ShiftCycle {
  cycleLength?: number | null;
  cycleDays?: number[] | null;
  anchorDate?: string | null;
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 'Mon' … 'Sun' for a local date key. Empty when it cannot be read. */
export function weekdayShort(dateISO: string): string {
  if (!DATE_KEY_RE.test(dateISO ?? '')) return '';
  const ms = dayMs(dateISO);
  return Number.isNaN(ms) ? '' : WEEKDAY_SHORT[new Date(ms).getUTCDay()];
}

/** Remainder that is always in 0..m-1, so dates before the anchor still resolve. */
function floorMod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Is this local calendar day a worked day of the cycle? False if unusable. */
export function isCycleWorkDay(
  dateISO: string,
  cycle: ShiftCycle | null | undefined
): boolean {
  const length = Number(cycle?.cycleLength);
  if (!Number.isInteger(length) || length < 1) return false;

  const days = (cycle?.cycleDays ?? []).map(Number);
  if (!days.length) return false; // empty means nothing, never "every day"

  const anchor = (cycle?.anchorDate ?? '').trim();
  if (!DATE_KEY_RE.test(anchor) || !DATE_KEY_RE.test(dateISO)) return false;
  const anchorMs = dayMs(anchor);
  const ms = dayMs(dateISO);
  if (Number.isNaN(anchorMs) || Number.isNaN(ms)) return false;

  const offset = Math.round((ms - anchorMs) / MS_PER_DAY);
  return days.includes(floorMod(offset, length));
}

/**
 * `count` consecutive days from `fromISO`, each marked worked or off.
 *
 * A rotation is hard to picture and a wrong anchor is invisible until the
 * roster is generated, so the form shows the next fortnight rather than asking
 * the admin to do the arithmetic.
 */
export function cyclePreview(
  cycle: ShiftCycle | null | undefined,
  fromISO: string,
  count = 14
): { date: string; worked: boolean }[] {
  if (!DATE_KEY_RE.test(fromISO ?? '')) return [];
  const days = (cycle?.cycleDays ?? []).map(Number);
  const length = Number(cycle?.cycleLength);
  const anchor = (cycle?.anchorDate ?? '').trim();
  if (!days.length || !Number.isInteger(length) || length < 1) return [];
  if (!DATE_KEY_RE.test(anchor)) return [];

  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const date = addDays(fromISO, i);
    return { date, worked: isCycleWorkDay(date, cycle) };
  });
}

/** '4 on / 4 off', 'Every day', or '2 days in every 5' when it is not a run. */
export function cycleSummaryLabel(
  cycleLength: number | null | undefined,
  cycleDays: number[] | null | undefined
): string {
  const length = Number(cycleLength);
  const days = Array.from(new Set((cycleDays ?? []).map(Number)))
    .filter((d) => Number.isInteger(d) && d >= 0 && d < length)
    .sort((a, b) => a - b);

  if (!Number.isInteger(length) || length < 1) return 'No cycle set';
  if (!days.length) return 'No cycle days set';
  if (days.length === length) return 'Every day';

  // A run from day 0 is the shape people actually name ("four on, four off");
  // anything else has no such name and is better stated as a proportion.
  const isRunFromZero = days.every((d, i) => d === i);
  return isRunFromZero
    ? `${days.length} on / ${length - days.length} off`
    : `${days.length} days in every ${length}`;
}

/**
 * The form caps a rotation at a month. Longer is a typo — nobody works a
 * 400-day pattern — and it would render hundreds of toggles.
 */
const MAX_FORM_CYCLE_LENGTH = 31;

/** One offset per day of the cycle, for the "which days are worked" toggles. */
export function cycleOffsets(cycleLength: number | null | undefined): number[] {
  const n = Math.floor(Number(cycleLength) || 0);
  if (!Number.isFinite(n) || n < 1) return [];
  return Array.from(
    { length: Math.min(n, MAX_FORM_CYCLE_LENGTH) },
    (_, i) => i
  );
}

/** Add or remove a worked offset, keeping the list sorted and unique. */
export function toggleCycleDay(
  cycleDays: number[] | null | undefined,
  offset: number
): number[] {
  const days = cycleDays ?? [];
  return days.includes(offset)
    ? days.filter((d) => d !== offset)
    : [...days, offset].sort((a, b) => a - b);
}

/**
 * Drop offsets a shortened cycle no longer has.
 * Left behind they are simply outside the cycle, which the server rejects.
 */
export function clampCycleDays(
  cycleDays: number[] | null | undefined,
  cycleLength: number | null | undefined
): number[] {
  const n = Math.floor(Number(cycleLength) || 0);
  return (cycleDays ?? []).filter(
    (d) => Number.isInteger(d) && d >= 0 && d < n
  );
}

/** How a template repeats, whichever kind of recurrence it uses. */
export function templateRepeatLabel(
  template: ShiftCycle & { recurrence?: string; daysOfWeek?: number[] }
): string {
  if (template?.recurrence !== 'cycle') {
    return templateDaysLabel(template?.daysOfWeek);
  }
  if (!(template.anchorDate ?? '').trim()) return 'Cycle needs an anchor date';
  return cycleSummaryLabel(template.cycleLength, template.cycleDays);
}

/**
 * 'Overnight' templates read wrong without a marker on the chip.
 *
 * The offset suffix is the explicit `endDayOffset` when set, or a legacy
 * "+1" when `endTime <= startTime` and the offset is absent.
 */
export function templateTimeLabel(
  startTime: string,
  endTime: string,
  endDayOffset?: number
): string {
  const explicitOffset = Number(endDayOffset) || 0;
  if (explicitOffset > 0) {
    return `${startTime}–${endTime} +${explicitOffset}`;
  }
  const overnight = endTime <= startTime;
  return `${startTime}–${endTime}${overnight ? ' +1' : ''}`;
}

const STATUS_TONES: Record<ShiftStatus, string> = {
  draft: 'border-dashed',
  published: 'border-solid',
  cancelled: 'opacity-50 line-through',
};

/** The one place a status becomes a visual treatment on a roster chip. */
export function statusTone(status: ShiftStatus): string {
  return STATUS_TONES[status] ?? 'border-solid';
}

/**
 * What to tell the manager after pressing Publish.
 *
 * A rule rather than a template string, because the interesting case is the one
 * that is easy to render as a failure. The server will not publish into the
 * past: a published shift with no punch against it counts as an ABSENCE, so
 * publishing last week marks staff absent for shifts they were never shown, on
 * days they can no longer do anything about. Those stay drafts, deliberately.
 *
 * Reporting only the shifts that went through would read as a partial failure —
 * the manager presses it again, gets the same number, and concludes the button
 * is broken. And "Nothing left to publish" when six past shifts were held back
 * is simply untrue: there is plenty, and it is being withheld on purpose.
 */
export function publishOutcomeMessage(result: {
  published: number;
  heldBack?: number;
}): string {
  const { published } = result;
  // The server did not always send this field. Rendering "undefined shifts are
  // in the past" is worse than saying nothing about them.
  const heldBack = result.heldBack ?? 0;

  const shifts = (n: number) => `${n} shift${n === 1 ? '' : 's'}`;
  const past = `${shifts(heldBack)} in the past stayed as drafts, so nobody is marked absent for them`;

  if (published > 0) {
    const done = `${shifts(published)} published`;
    return heldBack > 0 ? `${done} · ${past}` : done;
  }
  return heldBack > 0
    ? `Nothing published — ${past}`
    : 'Nothing left to publish';
}

// ── Fill (pattern across a date range) ──────────────────────────────────────

/**
 * The shape of a skip as the /fill endpoint reports it.
 *
 * Two different entries share this type: a per person-day skip carries
 * `employee`/`name`/`date`/`code`, but a whole-template refusal (the pattern
 * itself is unusable — no worked days, no days of the week, a bad start/end
 * time, or an inactive template) carries only `template` — the template's
 * NAME — and `reason`. `template` has to be declared here or that name is
 * silently dropped and the refusal reads as if it were about a person.
 */
export type FillSkip = {
  employee?: string;
  name?: string;
  date?: string;
  code?: string;
  reason: string;
  forceable?: boolean;
  template?: string;
};

/** Every date from `from` to `to` inclusive, as 'YYYY-MM-DD'. */
function eachDate(from: string, to: string): string[] {
  const a = dayMs(from);
  const b = dayMs(to);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return [];
  const out: string[] = [];
  for (let ms = a; ms <= b && out.length < 92; ms += MS_PER_DAY) {
    out.push(new Date(ms).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Which days a pattern would fill between two dates.
 *
 * A LABEL, not an instruction: the server re-derives this from the same
 * template and its answer is the one that gets written. If the two ever
 * disagree the server is right and this is the bug.
 */
export function fillPreview(
  template: {
    recurrence?: string | null;
    daysOfWeek?: number[] | null;
    cycleLength?: number | null;
    cycleDays?: number[] | null;
    anchorDate?: string | null;
  },
  from: string,
  to: string
): { dates: string[]; count: number } {
  const all = eachDate(from, to);

  let dates: string[];
  if (template.recurrence === 'cycle') {
    const cycleLength = Number(template.cycleLength) || 0;
    const cycleDays = template.cycleDays ?? [];
    const anchorDate = template.anchorDate ?? '';
    dates =
      cycleLength >= 1 && cycleDays.length && anchorDate
        ? all.filter((d) =>
            isCycleWorkDay(d, { cycleLength, cycleDays, anchorDate })
          )
        : [];
  } else {
    const days = template.daysOfWeek ?? [];
    dates = days.length
      ? all.filter((d) => days.includes(new Date(`${d}T00:00:00Z`).getUTCDay()))
      : [];
  }

  return { dates, count: dates.length };
}

/**
 * The maximum number of individual dates a fill preview spells out before
 * collapsing the rest into a "+N more" suffix — a 92-day fill must not print
 * 92 dates into the drawer.
 */
const MAX_FILL_DATES_SHOWN = 8;

/**
 * "Mon 10, Wed 12, Fri 14, Sun 16 · 4 days" — the worked dates a pattern fill
 * would actually create, so an admin can spot a wrong cycle anchor BEFORE
 * writing rows, not after. "4 days" alone does not show that.
 *
 * Reuses `weekdayShort` rather than writing new date formatting, so this stays
 * whatever that already agrees with the server about.
 */
export function fillDatesLabel(
  dates: string[],
  maxShown = MAX_FILL_DATES_SHOWN
): string {
  const total = dates.length;
  if (!total) return 'No days in this range';

  const label = (d: string): string => {
    const wd = weekdayShort(d);
    const dayNumber = Number(d.slice(8, 10));
    return wd && Number.isFinite(dayNumber) ? `${wd} ${dayNumber}` : d;
  };

  const shown = dates.slice(0, maxShown).map(label).join(', ');
  const remaining = total - maxShown;
  const list = remaining > 0 ? `${shown} +${remaining} more` : shown;
  const days = `${total} day${total === 1 ? '' : 's'}`;
  return `${list} · ${days}`;
}

/** "4 days × 2 people = 8 shifts", or why nothing would be created. */
export function fillSummaryLabel(days: number, people: number): string {
  if (days <= 0) return 'No days in this range — nothing to create';
  if (people <= 0) return 'Nobody selected — nothing to create';
  const total = days * people;
  const d = `${days} day${days === 1 ? '' : 's'}`;
  const p = `${people} ${people === 1 ? 'person' : 'people'}`;
  const t = `${total} shift${total === 1 ? '' : 's'}`;
  return `${d} × ${p} = ${t}`;
}

/**
 * The created/skipped report, grouped by person.
 *
 * Never claims success when nothing was written: a fill that created 0 rows and
 * said "0 shifts created" cheerfully is indistinguishable from a broken button.
 */
export function summariseFillResult(result: {
  created: number;
  skipped: FillSkip[];
}): { heading: string; groups: { name: string; lines: string[] }[] } {
  const created = Number(result.created) || 0;
  const heading =
    created > 0
      ? `${created} shift${created === 1 ? '' : 's'} created · all draft, unpublished`
      : 'No shifts created';

  const byPerson = new Map<string, string[]>();
  for (const s of result.skipped ?? []) {
    // A whole-template refusal (no `employee`/`name` — see FillSkip) is a
    // judgement about the PATTERN, not any person, so it must never be filed
    // under "This employee": that would send an admin looking for a member
    // of staff to blame when the template itself is misconfigured.
    const name =
      s.name || (s.template ? `Pattern: ${s.template}` : 'This employee');
    const when = s.date ? `${s.date} — ` : '';
    if (!byPerson.has(name)) byPerson.set(name, []);
    byPerson.get(name)!.push(`${when}${s.reason}`);
  }

  return {
    heading,
    // Array.from, not spread: this tsconfig targets ES5 iteration, where
    // spreading a Map iterator is a TS2802 (see buildRosterLanes above).
    groups: Array.from(byPerson.entries()).map(([name, lines]) => ({
      name,
      lines,
    })),
  };
}
