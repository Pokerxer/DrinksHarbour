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

import type { Shift, ShiftStatus } from '@/services/shift.service';
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
};

/** A 409's `code` as a short line for the assignment form. */
export function conflictLabel(
  code: string,
  fallback = 'Could not be scheduled'
): string {
  return CONFLICT_LABELS[code] ?? fallback;
}

/**
 * May the admin push this refusal through?
 *
 * Only `role_mismatch` — a judgement call about who can cover what. An overlap
 * is physics and time off is a commitment already made to the person; neither
 * is the admin's to wave away, and offering a button that will be refused again
 * is worse than offering none.
 */
export function canForce(code: string): boolean {
  return code === 'role_mismatch';
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
  return Array.from({ length: Math.min(n, MAX_FORM_CYCLE_LENGTH) }, (_, i) => i);
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
  return (cycleDays ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d < n);
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
