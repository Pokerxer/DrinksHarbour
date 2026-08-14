// Pure derivation for the attendance screen — `/employees/attendance`.
//
// The screen shows five framings of one window, and every one of them needs the
// same thing first: punches joined to the ROSTER. An absence is precisely the
// absence of a record, so it cannot be computed from punches at any price — the
// roster is the denominator, exactly as the server's employeeHistory does it.
//
// Kept free of React because the admin's Vitest environment is `node` with no
// jsdom: components cannot be rendered, so anything worth testing has to live
// outside them. Same split as attendance-utils.ts and shift-roster-utils.ts.

import type { AttendanceRecord } from '@/services/attendance.service';
import type { Shift } from '@/services/shift.service';
import type { TimeOffRequest } from '@/services/timeOff.service';
import { refId } from '@/services/orgStructure.service';
import { employeeName } from './shift-roster-utils';

/** What one rostered slot (or one unrostered punch) came to. */
export type EntryState =
  | 'in'
  | 'done'
  | 'due'
  | 'absent'
  | 'leave'
  | 'unrostered';

/**
 * Worst-first, and this order is load-bearing.
 *
 * `in` outranks `absent` because "are they here" is the live question: somebody
 * standing in the shop reads as present even if they missed a shift this
 * morning, and the missed shift still surfaces in the exceptions worklist.
 * `leave` ranks last — it is the one state that is not a call to action.
 */
export const ENTRY_STATE_RANK: Record<EntryState, number> = {
  in: 0,
  absent: 1,
  due: 2,
  unrostered: 3,
  done: 4,
  leave: 5,
};

export interface BoardShift {
  _id: string;
  start: string;
  end: string;
  status: string;
  roleName: string;
  roleColor: string;
}

export interface BoardEntry {
  /** Stable across renders: the shift id, or the record id for an unrostered punch. */
  key: string;
  /** null = a punch that matched no shift. */
  shift: BoardShift | null;
  /** Punches the server matched to this shift. More than one is legal. */
  records: AttendanceRecord[];
  excused: boolean;
  state: EntryState;
  /** Non-negative; the state carries the direction. */
  lateMinutes: number;
}

export interface BoardPerson {
  employeeId: string;
  name: string;
  avatar: string;
  entries: BoardEntry[];
  /** Closed minutes only — an open record has none yet. */
  minutesWorked: number;
  isIn: boolean;
  /** The worst of their entries. See ENTRY_STATE_RANK. */
  state: EntryState;
  lateCount: number;
}

export interface BoardTotals {
  onTheClock: number;
  /** Published, ended, unexcused shifts that produced no punch. */
  absent: number;
  late: number;
  /** Closed minutes across everyone. */
  minutes: number;
  /** Rostered slots that were owed an appearance (excludes excused). */
  expected: number;
  /** Of those, the ones that got one. */
  attended: number;
}

export interface AttendanceBoard {
  people: BoardPerson[];
  totals: BoardTotals;
}

export interface BoardInput {
  records: AttendanceRecord[];
  shifts: Shift[];
  timeOff: TimeOffRequest[];
  /** Injected so "has this shift ended" is testable. Defaults to now. */
  now?: number;
}

function ms(iso: string | null | undefined): number {
  if (!iso) return NaN;
  return new Date(iso).getTime();
}

/** An avatar ref is a string, a `{url}`, or absent. */
function avatarUrl(person: unknown): string {
  if (!person || typeof person !== 'object') return '';
  const a = (person as { avatar?: { url?: string } | string }).avatar;
  if (!a) return '';
  return typeof a === 'string' ? a : (a.url ?? '');
}

/**
 * Does an approved request cover any part of this window?
 *
 * Mirrors server/services/shift.helpers.js#overlapsTimeOff: a PENDING request
 * is still a question and excuses nothing, and the window is HALF-OPEN, so
 * leave ending at 08:00 does not cover a shift starting at 08:00.
 */
function isExcused(
  shift: Pick<Shift, 'start' | 'end'>,
  timeOff: TimeOffRequest[]
): boolean {
  const start = ms(shift.start);
  const end = ms(shift.end);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;

  return timeOff.some((t) => {
    if (t.status !== 'approved') return false;
    const tStart = ms(t.startDate);
    const tEnd = ms(t.endDate);
    if (Number.isNaN(tStart) || Number.isNaN(tEnd)) return false;
    return start < tEnd && tStart < end;
  });
}

function toBoardShift(shift: Shift): BoardShift {
  const role = shift.role;
  const populated = role && typeof role !== 'string' ? role : null;
  return {
    _id: String(shift._id),
    start: shift.start,
    end: shift.end,
    status: shift.status,
    roleName: populated?.name ?? '',
    roleColor: populated?.color ?? '#9ca3af',
  };
}

/**
 * What one rostered slot came to.
 *
 * TWO RULES MIRROR THE SERVER (attendanceRating.helpers.js:89-95) AND MUST NOT
 * DRIFT FROM IT:
 *
 * 1. Only a PUBLISHED shift counts. A draft is a plan the staff have never
 *    seen; marking somebody absent for one blames them for missing a shift
 *    nobody told them about.
 * 2. Only an ENDED shift counts. At 10:00, nobody rostered 14:00–22:00 is
 *    absent — `due` is the honest answer, and it is not a fault. A board that
 *    said otherwise would have managers chasing people who are not late yet,
 *    which is the fastest way to make the whole screen untrusted.
 */
function resolveEntryState(
  records: AttendanceRecord[],
  shift: BoardShift,
  excused: boolean,
  now: number
): EntryState {
  if (records.some((r) => r.status === 'open')) return 'in';
  if (records.length) return 'done';
  if (excused) return 'leave';

  const end = ms(shift.end);
  if (Number.isNaN(end) || end > now) return 'due';
  return 'absent';
}

/** The worst state among a person's entries, or 'done' when they have none. */
function headlineState(entries: BoardEntry[]): EntryState {
  let worst: EntryState = 'done';
  let rank = Number.POSITIVE_INFINITY;
  for (const entry of entries) {
    const r = ENTRY_STATE_RANK[entry.state];
    if (r < rank) {
      rank = r;
      worst = entry.state;
    }
  }
  return worst;
}

interface Draft {
  employeeId: string;
  name: string;
  avatar: string;
  entries: BoardEntry[];
}

/**
 * Punches × roster × approved leave → one shift-led board.
 *
 * Shift-led rather than punch-led because a row has to be able to exist for a
 * shift that produced nothing at all. The same shape employeeHistory returns,
 * so the day board and the per-employee rating cannot tell different stories
 * about the same day.
 *
 * A DRAFT shift contributes nothing — not an entry, not a person. Somebody
 * whose only shift is a draft and who did not punch does not appear here,
 * because there is nothing to report about them.
 */
export function buildAttendanceBoard(input: BoardInput): AttendanceBoard {
  const now = input.now ?? Date.now();
  const people = new Map<string, Draft>();

  // Punches indexed by the shift they cite. `shift` arrives as an id, a
  // populated doc, or null — refId normalises all three, and this is the same
  // id | doc | null shape that has blanked pages in this codebase before.
  const byShift = new Map<string, AttendanceRecord[]>();
  const unrostered: AttendanceRecord[] = [];
  for (const record of input.records) {
    const key = refId(record.shift);
    if (!key) {
      unrostered.push(record);
      continue;
    }
    const list = byShift.get(key);
    if (list) list.push(record);
    else byShift.set(key, [record]);
  }

  function draftFor(ref: unknown, fallbackKey: string): Draft {
    const employeeId = refId(ref as Parameters<typeof refId>[0]);
    const key = employeeId || `unknown:${fallbackKey}`;
    let draft = people.get(key);
    if (!draft) {
      draft = {
        employeeId,
        name:
          ref && typeof ref !== 'string'
            ? employeeName(ref as Parameters<typeof employeeName>[0])
            : 'Unknown employee',
        avatar: avatarUrl(ref),
        entries: [],
      };
      people.set(key, draft);
    }
    return draft;
  }

  for (const shift of input.shifts) {
    // A draft roster is not something anybody can be judged against.
    if (shift.status !== 'published') continue;

    const board = toBoardShift(shift);
    const records = byShift.get(board._id) ?? [];
    const excused = isExcused(shift, input.timeOff);
    const state = resolveEntryState(records, board, excused, now);

    draftFor(shift.employee, board._id).entries.push({
      key: board._id,
      shift: board,
      records,
      excused,
      state,
      lateMinutes: Math.max(
        0,
        ...records.map((r) =>
          r.punctuality?.code === 'late' ? r.punctuality.minutes : 0
        ),
        0
      ),
    });
  }

  for (const record of unrostered) {
    draftFor(record.employee, record._id).entries.push({
      key: record._id,
      shift: null,
      records: [record],
      excused: false,
      state: 'unrostered',
      lateMinutes: 0,
    });
  }

  // Array.from, not [...map.values()] — this tsconfig targets ES5 iteration and
  // spreading an iterator trips TS2802.
  const result: BoardPerson[] = Array.from(people.values()).map((draft) => {
    const entries = draft.entries
      .slice()
      .sort((a, b) => entryStart(a) - entryStart(b));

    let minutesWorked = 0;
    let lateCount = 0;
    let isIn = false;
    for (const entry of entries) {
      for (const record of entry.records) {
        if (record.status === 'closed') {
          minutesWorked += Number(record.minutesWorked) || 0;
        }
        if (record.status === 'open') isIn = true;
        if (record.punctuality?.code === 'late') lateCount += 1;
      }
    }

    return {
      employeeId: draft.employeeId,
      name: draft.name,
      avatar: draft.avatar,
      entries,
      minutesWorked,
      isIn,
      state: headlineState(entries),
      lateCount,
    };
  });

  result.sort((a, b) => {
    const rank = ENTRY_STATE_RANK[a.state] - ENTRY_STATE_RANK[b.state];
    if (rank !== 0) return rank;
    return a.name.localeCompare(b.name);
  });

  return { people: result, totals: totalsFor(result) };
}

/** When an entry begins — its shift's start, else its first punch. */
export function entryStart(entry: BoardEntry): number {
  const shiftStart = entry.shift ? ms(entry.shift.start) : NaN;
  if (!Number.isNaN(shiftStart)) return shiftStart;
  const punch = ms(entry.records[0]?.clockIn);
  return Number.isNaN(punch) ? 0 : punch;
}

function totalsFor(people: BoardPerson[]): BoardTotals {
  const totals: BoardTotals = {
    onTheClock: 0,
    absent: 0,
    late: 0,
    minutes: 0,
    expected: 0,
    attended: 0,
  };

  for (const person of people) {
    if (person.isIn) totals.onTheClock += 1;
    totals.late += person.lateCount;
    totals.minutes += person.minutesWorked;
    for (const entry of person.entries) {
      if (entry.state === 'absent') totals.absent += 1;
      // Excused and unrostered slots are outside the reckoning entirely: one
      // was forgiven, the other was never owed.
      if (!entry.shift || entry.excused) continue;
      totals.expected += 1;
      if (entry.records.length) totals.attended += 1;
    }
  }

  return totals;
}

/**
 * Attendance as a percentage of what was owed, or null when nothing was.
 *
 * NULL, never 0: a day nobody was rostered for is not 0% attendance, it is no
 * attendance figure at all. The caller renders null as '—'.
 */
export function attendanceRate(totals: BoardTotals): number | null {
  if (!totals.expected) return null;
  return Math.round((totals.attended / totals.expected) * 100);
}
