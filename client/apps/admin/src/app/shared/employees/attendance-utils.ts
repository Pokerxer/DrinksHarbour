// Pure helpers for the clock — the kiosk pad (`/employees/attendance/kiosk`)
// and the manager's log (`/employees/attendance`).
//
// Kept free of React so they can be unit-tested: the admin's Vitest environment
// is `node` with no jsdom, so components cannot be rendered and any logic worth
// testing has to live outside them — the same split as shift-roster-utils.ts,
// whose time-zone helpers this file reuses rather than restating.

import {
  LAGOS_OFFSET_MINUTES,
  employeeName,
  formatMinutes,
  toLocalDateKey,
  toLocalTimeLabel,
} from './shift-roster-utils';
import type {
  AttendanceRecord,
  Punctuality,
  PunctualityCode,
} from '@/services/attendance.service';
import { refId } from '@/services/orgStructure.service';

/** A POS PIN is 4–6 digits (server: `isValidPin`). The pad enforces the same. */
export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;

// ── The pad ──────────────────────────────────────────────────────────────────

/**
 * Append a digit, ignoring anything that is not one and anything past the
 * maximum. Returning the entry unchanged rather than throwing means a stray
 * key press on a wall-mounted screen is a no-op, not an error state somebody
 * has to clear before the next person can clock in.
 */
export function pressDigit(
  entry: string,
  digit: string,
  max = PIN_MAX_LENGTH
): string {
  const d = String(digit);
  if (!/^[0-9]$/.test(d)) return entry;
  if (entry.length >= max) return entry;
  return entry + d;
}

/** Remove the last digit. Empty stays empty. */
export function pressBackspace(entry: string): string {
  return entry.slice(0, -1);
}

/**
 * The dots the pad draws: one filled per digit entered, one hollow for each
 * remaining slot up to the minimum.
 *
 * Slots grow past the minimum as the PIN does, because PINs are 4–6 digits and
 * showing six empty boxes to somebody with a four-digit PIN implies they have
 * mistyped when they have not.
 */
export function pinSlots(entry: string, min = PIN_MIN_LENGTH): boolean[] {
  const length = Math.max(min, entry.length);
  return Array.from({ length }, (_, i) => i < entry.length);
}

/** Whether the entry is long enough to be worth sending. */
export function isPinReady(entry: string, min = PIN_MIN_LENGTH): boolean {
  return entry.length >= min;
}

// ── Punctuality ──────────────────────────────────────────────────────────────

const PUNCTUALITY_TONES: Record<PunctualityCode, string> = {
  no_shift: 'bg-gray-100 text-gray-500',
  early: 'bg-sky-50 text-sky-700',
  on_time: 'bg-green-50 text-green-700',
  late: 'bg-amber-50 text-amber-700',
};

/** The one place a punctuality code becomes a visual treatment. */
export function punctualityTone(code: PunctualityCode | undefined): string {
  return PUNCTUALITY_TONES[code ?? 'no_shift'] ?? PUNCTUALITY_TONES.no_shift;
}

/**
 * Words for a punctuality verdict.
 *
 * `no_shift` is deliberately NOT rendered as "on time": nothing was rostered,
 * so there was nothing to be on time for, and calling it on time would invent a
 * shift that does not exist. `minutes` is always non-negative — the code says
 * which side of the start time it falls on.
 */
export function punctualityLabel(p: Punctuality | undefined): string {
  if (!p) return 'No shift';
  switch (p.code) {
    case 'late':
      return `${formatMinutes(p.minutes)} late`;
    case 'early':
      return `${formatMinutes(p.minutes)} early`;
    case 'on_time':
      return 'On time';
    default:
      return 'No shift';
  }
}

// ── Records ──────────────────────────────────────────────────────────────────

/**
 * How long a record represents.
 *
 * An open record is an em dash, never "time so far". The server reports 0
 * minutes for one on purpose — a running total would make the same record read
 * differently on every refresh, and a day's totals would drift while nobody was
 * looking. "Still in" is the honest answer until somebody clocks out.
 */
export function recordDuration(
  record: Pick<AttendanceRecord, 'status' | 'minutesWorked'>
): string {
  if (record.status === 'open') return '—';
  return formatMinutes(record.minutesWorked);
}

/** Local 'HH:MM' for each end, with '—' standing in for an open clock-out. */
export function recordTimes(
  record: Pick<AttendanceRecord, 'clockIn' | 'clockOut'>,
  offsetMinutes = LAGOS_OFFSET_MINUTES
): { in: string; out: string } {
  return {
    in: toLocalTimeLabel(record.clockIn, offsetMinutes),
    out: record.clockOut
      ? toLocalTimeLabel(record.clockOut, offsetMinutes)
      : '—',
  };
}

/** 'Kiosk' / 'Added by hand' — a punch and a claim are not the same thing. */
export function sourceLabel(source: AttendanceRecord['source']): string {
  return source === 'admin' ? 'Added by hand' : 'Kiosk';
}

/**
 * Who last corrected a record, or '' when nobody has.
 *
 * The empty string matters: a record nobody has touched must not display an
 * "edited by" line at all, or every kiosk punch would look as though it had
 * been altered.
 */
export function editedByName(
  record: Pick<AttendanceRecord, 'editedBy'>
): string {
  const by = record.editedBy;
  if (!by || typeof by === 'string') return '';
  return employeeName(by);
}

/** Only an admin row may be deleted; a kiosk punch is corrected instead. */
export function canDeleteRecord(
  record: Pick<AttendanceRecord, 'source'>
): boolean {
  return record.source === 'admin';
}

// ── The log ──────────────────────────────────────────────────────────────────

export interface AttendanceGroup {
  /** The employee's id, or '' when the ref did not populate. */
  employeeId: string;
  name: string;
  records: AttendanceRecord[];
  /** Closed minutes only — an open record has none yet. */
  minutes: number;
  /** True while any of their records is still open: they are here now. */
  isIn: boolean;
  lateCount: number;
}

/**
 * One row per person, their punches inside it, earliest first.
 *
 * Grouped rather than listed flat because the question a manager opens this
 * screen with is "who is in", and a flat list answers "what happened" — the
 * same person appears three times on a day with two breaks and you have to
 * read all of it to work out whether they are still here.
 *
 * People still clocked in sort first, then by name, so the answer to "who is
 * here" is the top of the table rather than something to hunt for.
 */
export function groupAttendance(items: AttendanceRecord[]): AttendanceGroup[] {
  const byEmployee = new Map<string, AttendanceGroup>();

  for (const record of items) {
    const employeeId = refId(record.employee);
    const key = employeeId || `unknown:${record._id}`;
    let group = byEmployee.get(key);
    if (!group) {
      group = {
        employeeId,
        name:
          record.employee && typeof record.employee !== 'string'
            ? employeeName(record.employee)
            : 'Unknown employee',
        records: [],
        minutes: 0,
        isIn: false,
        lateCount: 0,
      };
      byEmployee.set(key, group);
    }
    group.records.push(record);
    group.minutes +=
      record.status === 'closed' ? Number(record.minutesWorked) || 0 : 0;
    if (record.status === 'open') group.isIn = true;
    if (record.punctuality?.code === 'late') group.lateCount += 1;
  }

  // Array.from, not [...map.values()] — this tsconfig targets ES5 iteration and
  // spreading an iterator trips TS2802.
  const groups = Array.from(byEmployee.values());
  for (const group of groups) {
    group.records.sort((a, b) => Date.parse(a.clockIn) - Date.parse(b.clockIn));
  }

  return groups.sort((a, b) => {
    if (a.isIn !== b.isIn) return a.isIn ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** Which local day a record belongs to — the day it STARTED, not ended. */
export function recordDateKey(
  record: Pick<AttendanceRecord, 'clockIn'>,
  offsetMinutes = LAGOS_OFFSET_MINUTES
): string {
  return toLocalDateKey(record.clockIn, offsetMinutes);
}

// ── The kiosk's confirmation ─────────────────────────────────────────────────

export interface ClockConfirmation {
  headline: string;
  detail: string;
  tone: 'in' | 'out';
}

/**
 * The sentence the pad shows after a press, then clears.
 *
 * It names one person — the one standing at the screen — and never anybody
 * else. The pad must not become a directory of who works here, which is the
 * whole reason there is no employee list on that page.
 */
export function describeClock(
  result: {
    action: 'in' | 'out';
    employee: {
      firstName?: string;
      lastName?: string;
      email?: string;
      _id: string;
    };
    item: Pick<
      AttendanceRecord,
      'clockIn' | 'clockOut' | 'status' | 'minutesWorked' | 'shift'
    >;
    punctuality?: Punctuality;
  },
  offsetMinutes = LAGOS_OFFSET_MINUTES
): ClockConfirmation {
  const name = employeeName(result.employee);
  const times = recordTimes(result.item, offsetMinutes);

  if (result.action === 'out') {
    return {
      headline: `Goodbye, ${name}`,
      detail: `Clocked out at ${times.out} · ${recordDuration(result.item)} worked`,
      tone: 'out',
    };
  }

  const shift = result.item.shift;
  const shiftLabel =
    shift && typeof shift !== 'string'
      ? `${toLocalTimeLabel(shift.start, offsetMinutes)}–${toLocalTimeLabel(shift.end, offsetMinutes)}`
      : '';

  const parts = [`Clocked in at ${times.in}`];
  if (shiftLabel) parts.push(`shift ${shiftLabel}`);
  if (result.punctuality && result.punctuality.code !== 'no_shift') {
    parts.push(punctualityLabel(result.punctuality));
  }

  return {
    headline: `Welcome, ${name}`,
    detail: parts.join(' · '),
    tone: 'in',
  };
}
