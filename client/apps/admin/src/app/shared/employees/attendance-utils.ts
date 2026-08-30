// Pure helpers for the clock — the kiosk pad (`/employees/attendance/kiosk`)
// and the manager's log (`/employees/attendance`).
//
// Kept free of React so they can be unit-tested: the admin's Vitest environment
// is `node` with no jsdom, so components cannot be rendered and any logic worth
// testing has to live outside them — the same split as shift-roster-utils.ts,
// whose time-zone helpers this file reuses rather than restating.

import {
  LAGOS_OFFSET_MINUTES,
  addDays,
  employeeName,
  formatMinutes,
  toLocalDateKey,
  toLocalTimeLabel,
  toUtcIso,
  type LaneEmployee,
} from './shift-roster-utils';
import type {
  AttendanceRecord,
  EarlyLeave,
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

/**
 * Two local dates + two wall-clock times → the UTC instants an entry or a
 * correction stores.
 *
 * The inverse of `recordTimes`: the form collects wall clock, the API stores
 * instants, and both ends have to use the tenant's offset or an edit shifts the
 * record by an hour every time it is saved.
 *
 * EACH END CARRIES ITS OWN DATE, and that is the load-bearing part. A single
 * date plus an "ends the next day if the out is earlier" rule cannot express a
 * shift that ran more than one night, and — worse — it silently REWRITES one
 * that did: opening a record clocked in on the 10th and out on the 12th, then
 * saving it untouched, would move the clock-out to the 11th. An admin correcting
 * the note would lose a day of somebody's hours without being told.
 *
 * A blank `outTime` is a real instruction, not "unchanged": it leaves the
 * record open (or re-opens a closed one). An unparseable date or time returns
 * '' for that end, so the caller can reject it with its own words.
 */
export function entryUtcTimes(
  input: {
    startDate: string;
    inTime: string;
    /** Ignored when `outTime` is blank — an open record has no end to place. */
    endDate: string;
    outTime: string;
  },
  offsetMinutes = LAGOS_OFFSET_MINUTES
): { clockIn: string; clockOut: string | null } {
  const clockIn = toUtcIso(input.startDate, input.inTime, offsetMinutes);
  if (!input.outTime) return { clockIn, clockOut: null };
  return {
    clockIn,
    clockOut: toUtcIso(input.endDate, input.outTime, offsetMinutes),
  };
}

/**
 * Which local day the clock-out fell on, given the day the record started.
 *
 * The default an ADD form uses before anybody has typed an end date: an out at
 * or before the in time means the pair ran past midnight, the same rule the
 * roster applies to an overnight template. A correction never guesses this —
 * it reads the stored `clockOut` — which is why the rule lives in its own
 * function rather than inside `entryUtcTimes`.
 */
export function impliedEndDate(
  startDate: string,
  inTime: string,
  outTime: string
): string {
  if (!outTime) return startDate;
  return outTime <= inTime ? addDays(startDate, 1) : startDate;
}

/**
 * Whether a pair of local dates and times describes a record the server will
 * accept: the clock-out must come strictly after the clock-in.
 *
 * Mirrors `resolveAttendanceTimes` on the server, which refuses `end <= start`
 * with "Clock-out must be after clock-in". Checked here too so the drawer can
 * say so before a round trip, and so the two dates cannot be left in an order
 * that reads as a typo. An open record (no `outTime`) is always valid.
 */
export function isEntryRangeValid(input: {
  startDate: string;
  inTime: string;
  endDate: string;
  outTime: string;
}): boolean {
  if (!input.outTime) return true;
  const start = Date.parse(`${input.startDate}T${input.inTime}:00.000Z`);
  const end = Date.parse(`${input.endDate}T${input.outTime}:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return true; // let the caller's own parse guard speak
  return end > start;
}

// ── The badge scan ───────────────────────────────────────────────────────────

/**
 * An upper bound for a scanned code. The server's rfidBadge is free text, so
 * the guard exists to keep a garbage read (a blurry QR, a hand in front of
 * the lens) from being POSTed to a rate-limited endpoint — not to police
 * badge lengths.
 */
export const BADGE_SCAN_MAX_LENGTH = 256;

/**
 * Normalise whatever delivered the code into the string the server stores.
 *
 * Two scanners exist on a kiosk: a camera decodes the QR payload verbatim,
 * and a USB HID reader is a keyboard that types the payload and hits Enter,
 * so the captured text can carry a trailing newline (or a stray `\0` from a
 * decoder that pads its buffer). Both need the same trim before the code is
 * sent anywhere.
 *
 * Deliberately nothing more opinionated than whitespace and null bytes:
 * rfidBadge is free text, so a badge number containing spaces must survive
 * verbatim.
 */
export function normaliseBadgeScan(raw: string): string {
  if (raw == null) return '';
  return String(raw).replace(/\0/g, '').trim();
}

/** Whether a scan is worth sending to the clock. */
export function isValidBadgeScan(code: string): boolean {
  return code.length > 0 && code.length <= BADGE_SCAN_MAX_LENGTH;
}

/**
 * How long the same badge is ignored after it has been read.
 *
 * The camera decodes whatever is in front of it about ten times a second, so a
 * card resting against the lens would punch, punch, punch. Five seconds is
 * longer than it takes to lower your hand and shorter than anybody's patience.
 *
 * The server enforces its own, much longer floor (MIN_PUNCH_INTERVAL_SECONDS)
 * — that one protects the timesheet. This one keeps the pad from showing a
 * refusal to somebody who did nothing wrong.
 */
export const SCAN_COOLDOWN_MS = 5000;

/** The last code this pad accepted, and when. */
export interface LastScan {
  code: string;
  at: number;
}

/**
 * Whether a decoded code should be sent to the clock.
 *
 * Deduplicated BY CODE rather than by time alone: two people at a handover
 * queue behind each other, and the second must not be made to wait out the
 * first's cooldown.
 */
export function shouldAcceptScan(
  code: string,
  last: LastScan | null,
  now: number,
  cooldownMs: number = SCAN_COOLDOWN_MS
): boolean {
  if (!last || last.code !== code) return true;
  return now - last.at >= cooldownMs;
}

// ── The HID scanner buffer ───────────────────────────────────────────────────

/** A USB reader is a keyboard: the whole burst lands within this window. */
export const SCAN_BURST_MS = 150;

/**
 * Whether a keystroke landed inside something a person types into.
 *
 * The kiosk catches scanner bursts with a window-level listener, but the
 * keyboard-entry fallback renders a real <input> for manual typing. While that
 * field holds focus, IT owns the keystrokes — feeding them into the scan
 * buffer as well would submit one badge twice. Anything else (nothing
 * focused, a button, the page itself) belongs to the buffer, which is what
 * makes a scan work without anybody touching the screen.
 *
 * Duck-typed rather than `instanceof HTMLElement` so it stays testable in the
 * node-only Vitest environment, and so a synthetic event target from a future
 * input method still matches.
 */
export function isEditableTarget(target: unknown): boolean {
  if (target == null || typeof target !== 'object') return false;
  const el = target as {
    tagName?: unknown;
    type?: unknown;
    isContentEditable?: unknown;
  };
  if (el.isContentEditable === true) return true;
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') return false;
  // Checkbox/radio/etc. take no text, so their keys still belong to the buffer.
  const textless = new Set([
    'button',
    'checkbox',
    'radio',
    'submit',
    'reset',
    'file',
    'image',
  ]);
  return typeof el.type !== 'string' || !textless.has(el.type);
}

/** Characters typed so far, and when the last one arrived. */
export interface ScanBuffer {
  text: string;
  at: number;
}

/**
 * Fold one keystroke into the scanner buffer.
 *
 * Modifier and navigation keys are IGNORED rather than treated as the end of
 * the burst. A reader types an uppercase character as Shift then the letter,
 * so ending the burst on a non-printable key submitted a truncated prefix of
 * every badge code containing a capital — invisible while testing with the
 * lowercase-hex employee-id fallback, and broken for every real badge number.
 *
 * @returns the next buffer, and the code to submit when Enter completed one
 */
export function pushScanKey(
  buffer: ScanBuffer,
  key: string,
  now: number,
  burstMs: number = SCAN_BURST_MS
): { buffer: ScanBuffer; submit: string | null } {
  if (key === 'Enter') {
    const text = buffer.text;
    return { buffer: { text: '', at: now }, submit: text || null };
  }

  // Printable keys are the only thing a badge is made of.
  if (key.length === 1) {
    const stale = now - buffer.at > burstMs;
    return {
      buffer: { text: (stale ? '' : buffer.text) + key, at: now },
      submit: null,
    };
  }

  return { buffer, submit: null };
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
    earlyLeave?: EarlyLeave;
  },
  offsetMinutes = LAGOS_OFFSET_MINUTES
): ClockConfirmation {
  const name = employeeName(result.employee);
  const times = recordTimes(result.item, offsetMinutes);

  if (result.action === 'out') {
    const parts = [
      `Clocked out at ${times.out}`,
      `${recordDuration(result.item)} worked`,
    ];
    // Only when they actually left early. `no_shift` must not produce a note:
    // nobody rostered them, so "on time" and "early" are both inventions.
    if (result.earlyLeave?.code === 'early') {
      parts.push(`${formatMinutes(result.earlyLeave.minutes)} early`);
    }
    return {
      headline: `Goodbye, ${name}`,
      detail: parts.join(' · '),
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

// ── Leaving before the shift ends ────────────────────────────────────────────

export interface EarlyLeavePrompt {
  headline: string;
  detail: string;
  question: string;
}

/**
 * The words on the "you are leaving early" confirmation.
 *
 * Composed HERE, not on the server, for one reason: the shop's time zone. The
 * server sends the shift end as an ISO instant and how many minutes are left,
 * and this turns that into "18:00" — the number the employee can compare to the
 * clock above the door. A UTC timestamp on a wall-mounted screen is a puzzle.
 *
 * Phrased as a QUESTION, never a refusal. The employee is allowed to go: they
 * may be ill, or sent home, and the one thing worse than an early clock-out is
 * no clock-out at all, which leaves a record open for a manager to invent an
 * end for. `question` exists so the wording and the buttons cannot drift apart.
 */
export function describeEarlyLeavePrompt(
  details: {
    employee: LaneEmployee;
    minutesRemaining: number;
    shiftEnd: string;
  },
  offsetMinutes = LAGOS_OFFSET_MINUTES
): EarlyLeavePrompt {
  const name = employeeName(details.employee);
  const end = toLocalTimeLabel(details.shiftEnd, offsetMinutes);
  const left = formatMinutes(Math.max(0, details.minutesRemaining));

  return {
    // employeeName falls back to the email, then to a generic label, so a
    // profile with no name never reaches a wall as "undefined, your shift…".
    headline: `${name}, your shift is not over`,
    detail: `You are rostered until ${end} — ${left} still to go.`,
    question: 'Clock out anyway?',
  };
}

// ── How a kiosk screen authenticates itself ──────────────────────────────────

export type KioskAuthMode = 'device' | 'session' | 'none';

export interface KioskAuth {
  mode: KioskAuthMode;
  /** The credential to send, whichever kind it is. */
  token: string;
  /** Whether the pad may offer the PIN fallback at all. */
  pinOffered: boolean;
}

/**
 * Which credential this kiosk screen holds, and what it is therefore allowed to
 * offer.
 *
 * The URL decides, NOT whoever happens to be signed in to the browser. That
 * order is the whole rule, and it is not obvious:
 *
 * `/kiosk/<token>` is a public page, and it will very often be opened in a
 * browser that still holds a manager's session cookie — the manager who paired
 * the tablet in the first place. If the session won, that one device would
 * quietly get the PIN pad back, posting typed secrets to an endpoint that
 * accepts them because the request happened to carry a JWT. It would work
 * perfectly, so nobody would ever find out. A screen paired as a device is a
 * device, whatever else the browser is carrying.
 *
 * `mode: 'none'` is a real state, not an error: the in-app page renders before
 * `useSession()` resolves, and it must show that it is not ready rather than
 * posting scans that will come back 401.
 */
export function resolveKioskAuth(input: {
  kioskToken?: string | null;
  sessionToken?: string | null;
}): KioskAuth {
  const kioskToken = (input.kioskToken ?? '').trim();
  if (kioskToken) {
    // Badges only. The server refuses a typed PIN on this path, so a pad that
    // showed one would be a button that always fails.
    return { mode: 'device', token: kioskToken, pinOffered: false };
  }

  const sessionToken = (input.sessionToken ?? '').trim();
  if (sessionToken) {
    return { mode: 'session', token: sessionToken, pinOffered: true };
  }

  return { mode: 'none', token: '', pinOffered: false };
}
