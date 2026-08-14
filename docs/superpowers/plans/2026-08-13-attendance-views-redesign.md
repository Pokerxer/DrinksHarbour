# Attendance Views Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/employees/attendance` from a single day-table into five framings of the same window — Live board, Day timeline, Log, Week timesheet, Exceptions — including absences, which the screen cannot show today.

**Architecture:** All derivation moves into one pure module, `attendance-board-utils.ts`, joining three existing API reads (punches + roster + approved leave) into a shift-led board model. `attendance-log-page.tsx` becomes a shell that fetches, holds view/date state, and renders one of five presentational panes. No server changes.

**Tech Stack:** Next.js App Router (client components), TypeScript, Tailwind, framer-motion, react-icons/pi, Vitest (`environment: 'node'`).

**Spec:** `docs/superpowers/specs/2026-08-13-attendance-views-redesign-design.md`

## Global Constraints

- **Working directory for every command is `client/apps/admin`.** Commands below assume it.
- **Vitest environment is `node` — there is NO jsdom. Components cannot be rendered in a test.** Only pure functions get unit tests. Component tasks are verified by typecheck + a smoke route.
- **NEVER run `npx tsc` in this package.** It installs a decoy `tsc@2.0.4` that prints "This is not the tsc command you are looking for" and exits 0 — a typecheck that checked nothing. Always use `./node_modules/.bin/tsc`.
- **The tsc error count is contaminated by `.next/`.** Measure source-only:
  `./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -vc "\.next/"`
- **Baselines that must not regress:** admin Vitest **713/713 passing** (39 files); admin source-only tsc **453 errors**. *(Corrected 2026-08-14 after Task 1: the 635 figure was stale — the merged multi-role-shift-templates work raised it.)*
- **Brand colour is `#b20202`.** Cards are `rounded-2xl border border-gray-200 bg-white`. Headings use `fraunces` from `./employees-fonts`.
- **Tenant offset is `LAGOS_OFFSET_MINUTES` (60)** from `./shift-roster-utils`, aliased `const OFFSET = LAGOS_OFFSET_MINUTES` as the existing page does.
- **`Ref<T> = string | T | null | undefined`.** Always normalise with `refId()` from `@/services/orgStructure.service`. Never read `._id` off a ref directly.
- **Next 15: any client component calling `useSearchParams()` must be wrapped in `<Suspense>` by its route page**, or `npm run build` fails with "useSearchParams() should be wrapped in a suspense boundary". `npm run dev` does NOT catch this. The established pattern is `src/app/(hydrogen)/purchases/page.tsx:12`.
- **Absence semantics must mirror `server/services/attendanceRating.helpers.js:89-95` exactly:** only a `published` shift that has **ended** can be an absence.
- **Time-off windows are half-open:** `startDate` inclusive, `endDate` EXCLUSIVE. Only `status === 'approved'` counts.
- **Do NOT commit unless the plan step says to.** Steps that commit say so explicitly.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/app/shared/employees/attendance-board-utils.ts` | **NEW.** All derivation: the join, exception buckets, week aggregation, timeline geometry. Pure — no React import. |
| `src/app/shared/employees/attendance-board-utils.test.ts` | **NEW.** Vitest cover for the above. |
| `src/app/shared/employees/attendance-log-table.tsx` | **NEW.** The existing grouped table, lifted out of the page verbatim. |
| `src/app/shared/employees/attendance-live-board.tsx` | **NEW.** Card sections + ticking elapsed. |
| `src/app/shared/employees/attendance-day-timeline.tsx` | **NEW.** Gantt lanes. |
| `src/app/shared/employees/attendance-week-timesheet.tsx` | **NEW.** Employees × 7 days matrix. |
| `src/app/shared/employees/attendance-exceptions.tsx` | **NEW.** Ordered worklist. |
| `src/app/shared/employees/attendance-log-page.tsx` | **MODIFY.** Shell: fetch, view/date state, KPIs, toolbar, drawer. |
| `src/app/(hydrogen)/employees/attendance/page.tsx` | **MODIFY.** Adds the `<Suspense>` boundary the shell's `useSearchParams()` requires. |

---

## Task 1: The board model and the join

**Files:**
- Create: `src/app/shared/employees/attendance-board-utils.ts`
- Create: `src/app/shared/employees/attendance-board-utils.test.ts`

**Interfaces:**
- Consumes: `AttendanceRecord` from `@/services/attendance.service`; `Shift` from `@/services/shift.service`; `TimeOffRequest` from `@/services/timeOff.service`; `refId` from `@/services/orgStructure.service`; `employeeName` from `./shift-roster-utils`.
- Produces: `EntryState`, `BoardShift`, `BoardEntry`, `BoardPerson`, `AttendanceBoard`, `buildAttendanceBoard(input)`, `ENTRY_STATE_RANK`.

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/employees/attendance-board-utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildAttendanceBoard } from './attendance-board-utils';
import type { AttendanceRecord } from '@/services/attendance.service';
import type { Shift } from '@/services/shift.service';
import type { TimeOffRequest } from '@/services/timeOff.service';

/** 2026-08-13T09:00 Lagos === 08:00Z, since the tenant offset is +60. */
const D = (hhmm: string) => `2026-08-13T${hhmm}:00.000Z`;
/** Well after every shift below has ended. */
const AFTER = Date.parse(D('23:00'));
/** Before any of them start. */
const BEFORE = Date.parse(D('05:00'));

function shift(over: Partial<Shift> = {}): Shift {
  return {
    _id: 's1',
    employee: { _id: 'e1', firstName: 'Ada', lastName: 'N' },
    role: { _id: 'r1', name: 'Bar', color: '#b20202' },
    start: D('08:00'),
    end: D('16:00'),
    breakMinutes: 0,
    status: 'published',
    createdAt: D('00:00'),
    updatedAt: D('00:00'),
    ...over,
  } as Shift;
}

function record(over: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    _id: 'a1',
    employee: { _id: 'e1', firstName: 'Ada', lastName: 'N' },
    shift: 's1',
    clockIn: D('08:00'),
    clockOut: D('16:00'),
    source: 'kiosk',
    minutesWorked: 480,
    status: 'closed',
    createdAt: D('00:00'),
    updatedAt: D('00:00'),
    ...over,
  } as AttendanceRecord;
}

function leave(over: Partial<TimeOffRequest> = {}): TimeOffRequest {
  return {
    _id: 't1',
    employee: { _id: 'e1' },
    type: 'annual',
    startDate: D('00:00'),
    endDate: `2026-08-14T00:00:00.000Z`,
    halfDay: 'none',
    days: 1,
    status: 'approved',
    createdAt: D('00:00'),
    updatedAt: D('00:00'),
    ...over,
  } as TimeOffRequest;
}

describe('buildAttendanceBoard', () => {
  it('is shift-led: a published, ended shift with no punch is absent', () => {
    const board = buildAttendanceBoard({
      records: [],
      shifts: [shift()],
      timeOff: [],
      now: AFTER,
    });

    expect(board.people).toHaveLength(1);
    expect(board.people[0].entries).toHaveLength(1);
    expect(board.people[0].entries[0].state).toBe('absent');
    expect(board.people[0].state).toBe('absent');
  });

  it('does not mark a DRAFT shift absent — staff were never told about it', () => {
    const board = buildAttendanceBoard({
      records: [],
      shifts: [shift({ status: 'draft' })],
      timeOff: [],
      now: AFTER,
    });

    expect(board.people).toHaveLength(0);
  });

  it('a published shift that has not ended yet is due, never absent', () => {
    const board = buildAttendanceBoard({
      records: [],
      shifts: [shift()],
      timeOff: [],
      now: BEFORE,
    });

    expect(board.people[0].entries[0].state).toBe('due');
  });

  it('approved leave excuses the shift and outranks absent', () => {
    const board = buildAttendanceBoard({
      records: [],
      shifts: [shift()],
      timeOff: [leave()],
      now: AFTER,
    });

    expect(board.people[0].entries[0].state).toBe('leave');
    expect(board.people[0].entries[0].excused).toBe(true);
  });

  it('a PENDING request excuses nothing — it is still a question', () => {
    const board = buildAttendanceBoard({
      records: [],
      shifts: [shift()],
      timeOff: [leave({ status: 'pending' })],
      now: AFTER,
    });

    expect(board.people[0].entries[0].state).toBe('absent');
  });

  it('treats the time-off end as EXCLUSIVE', () => {
    // Leave ends at 08:00, the instant the shift starts. No overlap.
    const board = buildAttendanceBoard({
      records: [],
      shifts: [shift()],
      timeOff: [leave({ startDate: D('00:00'), endDate: D('08:00') })],
      now: AFTER,
    });

    expect(board.people[0].entries[0].state).toBe('absent');
  });

  it('joins a punch to its shift whether the ref is an id or a doc', () => {
    const asId = buildAttendanceBoard({
      records: [record({ shift: 's1' })],
      shifts: [shift()],
      timeOff: [],
      now: AFTER,
    });
    const asDoc = buildAttendanceBoard({
      records: [
        record({
          shift: { _id: 's1', start: D('08:00'), end: D('16:00'), status: 'published' },
        }),
      ],
      shifts: [shift()],
      timeOff: [],
      now: AFTER,
    });

    expect(asId.people[0].entries[0].state).toBe('done');
    expect(asDoc.people[0].entries[0].state).toBe('done');
  });

  it('buckets a punch with a null shift as unrostered, not as an absence', () => {
    const board = buildAttendanceBoard({
      records: [record({ _id: 'a9', shift: null })],
      shifts: [],
      timeOff: [],
      now: AFTER,
    });

    expect(board.people[0].entries[0].state).toBe('unrostered');
    expect(board.people[0].entries[0].shift).toBeNull();
  });

  it('an open record reads in, and counts no minutes yet', () => {
    const board = buildAttendanceBoard({
      records: [record({ clockOut: null, status: 'open', minutesWorked: 0 })],
      shifts: [shift()],
      timeOff: [],
      now: AFTER,
    });

    expect(board.people[0].entries[0].state).toBe('in');
    expect(board.people[0].isIn).toBe(true);
    expect(board.people[0].minutesWorked).toBe(0);
  });

  it('sums CLOSED minutes only', () => {
    const board = buildAttendanceBoard({
      records: [
        record({ _id: 'a1', shift: 's1', minutesWorked: 480, status: 'closed' }),
        record({ _id: 'a2', shift: null, minutesWorked: 0, status: 'open', clockOut: null }),
      ],
      shifts: [shift()],
      timeOff: [],
      now: AFTER,
    });

    expect(board.people[0].minutesWorked).toBe(480);
  });

  it('headline state is in when they are here now, despite an earlier miss', () => {
    const board = buildAttendanceBoard({
      records: [
        record({ _id: 'a2', shift: 's2', clockOut: null, status: 'open', minutesWorked: 0 }),
      ],
      shifts: [
        shift({ _id: 's1', start: D('06:00'), end: D('09:00') }),
        shift({ _id: 's2', start: D('12:00'), end: D('20:00') }),
      ],
      timeOff: [],
      now: AFTER,
    });

    const person = board.people[0];
    expect(person.state).toBe('in');
    expect(person.entries.map((e) => e.state)).toEqual(['absent', 'in']);
  });

  it('counts late arrivals off the punctuality the server attached', () => {
    const board = buildAttendanceBoard({
      records: [record({ punctuality: { code: 'late', minutes: 22 } })],
      shifts: [shift()],
      timeOff: [],
      now: AFTER,
    });

    expect(board.people[0].lateCount).toBe(1);
    expect(board.people[0].entries[0].lateMinutes).toBe(22);
  });

  it('sorts people by headline state, then by name', () => {
    const board = buildAttendanceBoard({
      records: [
        record({
          _id: 'a2',
          employee: { _id: 'e2', firstName: 'Zoe', lastName: 'B' },
          shift: 's2',
          clockOut: null,
          status: 'open',
          minutesWorked: 0,
        }),
      ],
      shifts: [
        shift(),
        shift({ _id: 's2', employee: { _id: 'e2', firstName: 'Zoe', lastName: 'B' } }),
      ],
      timeOff: [],
      now: AFTER,
    });

    // Zoe is IN, Ada is ABSENT. `in` ranks first even though Z sorts after A.
    expect(board.people.map((p) => p.name)).toEqual(['Zoe B', 'Ada N']);
  });

  it('reports totals across everyone', () => {
    const board = buildAttendanceBoard({
      records: [record({ punctuality: { code: 'late', minutes: 10 } })],
      shifts: [
        shift(),
        shift({ _id: 's2', employee: { _id: 'e2', firstName: 'Zoe', lastName: 'B' } }),
      ],
      timeOff: [],
      now: AFTER,
    });

    expect(board.totals.onTheClock).toBe(0);
    expect(board.totals.absent).toBe(1);
    expect(board.totals.late).toBe(1);
    expect(board.totals.minutes).toBe(480);
    expect(board.totals.expected).toBe(2);
    expect(board.totals.attended).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/shared/employees/attendance-board-utils.test.ts`
Expected: FAIL — `Failed to resolve import "./attendance-board-utils"`.

- [ ] **Step 3: Write the implementation**

Create `src/app/shared/employees/attendance-board-utils.ts`:

```ts
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
  shift: Pick<Shift, 'start' | 'end' | 'employee'>,
  timeOff: TimeOffRequest[]
): boolean {
  const start = ms(shift.start);
  const end = ms(shift.end);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;

  const employeeId = refId(shift.employee);

  return timeOff.some((t) => {
    if (t.status !== 'approved') return false;
    // BOTH sides through refId: either can be a populated doc, a bare id, or
    // null, and comparing a doc to an id string silently never matches —
    // which would leave every shift unexcused instead of over-excused.
    if (refId(t.employee) !== employeeId) return false;
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
      // A `due` shift has not ended yet, so nobody has failed to show up for
      // it — it is not owed YET. Counting it would drag the KPI down every
      // time a manager opens the board mid-day, for people who are not even
      // late. It rejoins once it resolves to `done` or `absent`.
      if (entry.state === 'due') continue;
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/shared/employees/attendance-board-utils.test.ts`
Expected: PASS — 14 passed.

- [ ] **Step 5: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -vc "\.next/"`
Expected: `453` (the baseline — no new errors).

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/employees/attendance-board-utils.ts src/app/shared/employees/attendance-board-utils.test.ts
git commit -m "feat(attendance): join punches to the roster so an absence can be seen"
```

---

## Task 2: Exception buckets

**Files:**
- Modify: `src/app/shared/employees/attendance-board-utils.ts` (append)
- Modify: `src/app/shared/employees/attendance-board-utils.test.ts` (append)

**Interfaces:**
- Consumes: `BoardPerson`, `BoardEntry`, `EntryState` from Task 1.
- Produces: `ExceptionKind`, `ExceptionRow`, `EXCEPTION_ORDER`, `buildExceptions(people, opts)`.

- [ ] **Step 1: Write the failing test**

Append to `src/app/shared/employees/attendance-board-utils.test.ts`:

```ts
import { buildExceptions } from './attendance-board-utils';

describe('buildExceptions', () => {
  const dayStart = Date.parse('2026-08-13T00:00:00.000Z');

  it('ranks a stale open record above every other exception', () => {
    const board = buildAttendanceBoard({
      records: [
        // Yesterday's punch, never closed.
        record({
          _id: 'stale',
          clockIn: '2026-08-12T08:00:00.000Z',
          clockOut: null,
          status: 'open',
          minutesWorked: 0,
        }),
        record({
          _id: 'late',
          shift: 's2',
          punctuality: { code: 'late', minutes: 30 },
        }),
      ],
      shifts: [
        shift({ _id: 's1', start: '2026-08-12T08:00:00.000Z', end: '2026-08-12T16:00:00.000Z' }),
        shift({ _id: 's2' }),
      ],
      timeOff: [],
      now: AFTER,
    });

    const rows = buildExceptions(board.people, { dayStart });

    expect(rows[0].kind).toBe('stale_open');
    expect(rows.map((r) => r.kind)).toEqual(['stale_open', 'late']);
  });

  it('does not call today’s open record stale — they are still working', () => {
    const board = buildAttendanceBoard({
      records: [record({ clockOut: null, status: 'open', minutesWorked: 0 })],
      shifts: [shift()],
      timeOff: [],
      now: AFTER,
    });

    const rows = buildExceptions(board.people, { dayStart });
    expect(rows).toHaveLength(0);
  });

  it('reports an absence, and never reports a leave day', () => {
    const board = buildAttendanceBoard({
      records: [],
      shifts: [
        shift({ _id: 's1' }),
        shift({ _id: 's2', employee: { _id: 'e2', firstName: 'Zoe', lastName: 'B' } }),
      ],
      timeOff: [leave({ employee: { _id: 'e2' } })],
      now: AFTER,
    });

    const rows = buildExceptions(board.people, { dayStart });
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('absent');
    expect(rows[0].name).toBe('Ada N');
  });

  it('reports an early leave off the shift end', () => {
    const board = buildAttendanceBoard({
      // Rostered to 16:00, gone at 15:00.
      records: [record({ clockOut: D('15:00'), minutesWorked: 420 })],
      shifts: [shift()],
      timeOff: [],
      now: AFTER,
    });

    const rows = buildExceptions(board.people, { dayStart });
    expect(rows[0].kind).toBe('left_early');
    expect(rows[0].minutes).toBe(60);
  });

  it('tolerates a few minutes at the end of a shift', () => {
    const board = buildAttendanceBoard({
      records: [record({ clockOut: D('15:56'), minutesWorked: 476 })],
      shifts: [shift()],
      timeOff: [],
      now: AFTER,
    });

    expect(buildExceptions(board.people, { dayStart })).toHaveLength(0);
  });

  it('reports an unrostered punch last', () => {
    const board = buildAttendanceBoard({
      records: [record({ _id: 'a9', shift: null })],
      shifts: [],
      timeOff: [],
      now: AFTER,
    });

    const rows = buildExceptions(board.people, { dayStart });
    expect(rows[0].kind).toBe('unrostered');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/shared/employees/attendance-board-utils.test.ts`
Expected: FAIL — `buildExceptions is not a function` / no export named `buildExceptions`.

- [ ] **Step 3: Write the implementation**

Append to `src/app/shared/employees/attendance-board-utils.ts`:

```ts
// ── The exceptions worklist ──────────────────────────────────────────────────

/**
 * How long past the rostered end a clock-out is still "on time".
 *
 * Mirrors the server's DEFAULT_DEPARTURE_GRACE_MINUTES. Without it every
 * shift produces an exception, because nobody clocks out on the exact minute,
 * and a worklist that always has a hundred rows is a worklist nobody reads.
 */
export const DEPARTURE_GRACE_MINUTES = 5;

export type ExceptionKind =
  | 'stale_open'
  | 'absent'
  | 'late'
  | 'left_early'
  | 'unrostered';

/** Ordered by how much it needs a human, not alphabetically. */
export const EXCEPTION_ORDER: ExceptionKind[] = [
  'stale_open',
  'absent',
  'late',
  'left_early',
  'unrostered',
];

export interface ExceptionRow {
  key: string;
  kind: ExceptionKind;
  employeeId: string;
  name: string;
  entry: BoardEntry;
  /** The punch to correct, when there is one. */
  record: AttendanceRecord | null;
  /** Non-negative; the kind carries the meaning. 0 where it does not apply. */
  minutes: number;
}

export interface ExceptionOptions {
  /** Start of the day in view. An open record from BEFORE this is stale. */
  dayStart: number;
}

/**
 * Everything on this board that wants a manager, worst first.
 *
 * A `stale_open` record leads because it is the only one actively lying: it
 * scores 0 minutes and will keep doing so until somebody closes it. An
 * absence is a fact about yesterday; an unclosed record is a number that is
 * wrong right now.
 *
 * Excused and `due` entries never appear. One was forgiven, the other has not
 * happened yet — putting either in a worklist trains people to ignore it.
 */
export function buildExceptions(
  people: BoardPerson[],
  opts: ExceptionOptions
): ExceptionRow[] {
  const rows: ExceptionRow[] = [];

  for (const person of people) {
    for (const entry of person.entries) {
      if (entry.excused || entry.state === 'due') continue;

      const base = {
        employeeId: person.employeeId,
        name: person.name,
        entry,
      };

      if (entry.state === 'absent') {
        rows.push({ ...base, key: `absent:${entry.key}`, kind: 'absent', record: null, minutes: 0 });
        continue;
      }

      for (const record of entry.records) {
        if (record.status === 'open') {
          // Open is only a problem once the day it belongs to is over.
          const started = new Date(record.clockIn).getTime();
          if (!Number.isNaN(started) && started < opts.dayStart) {
            rows.push({
              ...base,
              key: `stale:${record._id}`,
              kind: 'stale_open',
              record,
              minutes: 0,
            });
          }
          continue;
        }

        if (entry.state === 'unrostered') {
          rows.push({
            ...base,
            key: `unrostered:${record._id}`,
            kind: 'unrostered',
            record,
            minutes: Number(record.minutesWorked) || 0,
          });
          continue;
        }

        if (record.punctuality?.code === 'late') {
          rows.push({
            ...base,
            key: `late:${record._id}`,
            kind: 'late',
            record,
            minutes: record.punctuality.minutes,
          });
        }

        const shiftEnd = entry.shift ? new Date(entry.shift.end).getTime() : NaN;
        const out = record.clockOut ? new Date(record.clockOut).getTime() : NaN;
        if (!Number.isNaN(shiftEnd) && !Number.isNaN(out)) {
          const short = Math.round((shiftEnd - out) / 60_000);
          if (short > DEPARTURE_GRACE_MINUTES) {
            rows.push({
              ...base,
              key: `early:${record._id}`,
              kind: 'left_early',
              record,
              minutes: short,
            });
          }
        }
      }
    }
  }

  return rows.sort((a, b) => {
    const kind =
      EXCEPTION_ORDER.indexOf(a.kind) - EXCEPTION_ORDER.indexOf(b.kind);
    if (kind !== 0) return kind;
    return a.name.localeCompare(b.name);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/shared/employees/attendance-board-utils.test.ts`
Expected: PASS — 24 passed (18 after the Task 1 fix, plus these 6).

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/employees/attendance-board-utils.ts src/app/shared/employees/attendance-board-utils.test.ts
git commit -m "feat(attendance): order the exceptions worklist by what needs a human"
```

---

## Task 3: Week timesheet aggregation

**Files:**
- Modify: `src/app/shared/employees/attendance-board-utils.ts` (append)
- Modify: `src/app/shared/employees/attendance-board-utils.test.ts` (append)

**Interfaces:**
- Consumes: `BoardPerson` from Task 1; `DayColumn`, `recordDateKey` from `./shift-roster-utils` / `./attendance-utils`.
- Produces: `TimesheetCell`, `TimesheetRow`, `Timesheet`, `buildTimesheet(people, days, offsetMinutes)`.

- [ ] **Step 1: Write the failing test**

Append to `src/app/shared/employees/attendance-board-utils.test.ts`:

```ts
import { buildTimesheet } from './attendance-board-utils';
import { buildWeek } from './shift-roster-utils';

describe('buildTimesheet', () => {
  // 2026-08-13 is a Thursday; the trading week starts Monday 2026-08-10.
  const week = buildWeek('2026-08-13');

  it('buckets minutes by the day the punch STARTED, not the day it ended', () => {
    const board = buildAttendanceBoard({
      records: [
        // 22:00 Thu → 06:00 Fri. It belongs to Thursday.
        record({
          clockIn: '2026-08-13T21:00:00.000Z',
          clockOut: '2026-08-14T05:00:00.000Z',
          minutesWorked: 480,
        }),
      ],
      shifts: [shift({ start: '2026-08-13T21:00:00.000Z', end: '2026-08-14T05:00:00.000Z' })],
      timeOff: [],
      now: Date.parse('2026-08-15T00:00:00.000Z'),
    });

    const sheet = buildTimesheet(board.people, week, 60);
    const row = sheet.rows[0];

    expect(row.cells['2026-08-13'].minutes).toBe(480);
    expect(row.cells['2026-08-14'].minutes).toBe(0);
    expect(row.total).toBe(480);
  });

  it('counts CLOSED minutes only — an open record is not time so far', () => {
    const board = buildAttendanceBoard({
      records: [record({ clockOut: null, status: 'open', minutesWorked: 0 })],
      shifts: [shift()],
      timeOff: [],
      now: AFTER,
    });

    const sheet = buildTimesheet(board.people, week, 60);
    expect(sheet.rows[0].total).toBe(0);
    expect(sheet.rows[0].cells['2026-08-13'].open).toBe(true);
  });

  it('marks the cell late and absent so payroll still sees the exceptions', () => {
    const board = buildAttendanceBoard({
      records: [record({ shift: 's1', punctuality: { code: 'late', minutes: 15 } })],
      shifts: [
        shift({ _id: 's1' }),
        shift({ _id: 's2', start: D('18:00'), end: D('22:00') }),
      ],
      timeOff: [],
      now: AFTER,
    });

    const cell = buildTimesheet(board.people, week, 60).rows[0].cells['2026-08-13'];
    expect(cell.late).toBe(true);
    expect(cell.absent).toBe(true);
  });

  it('totals each day and the whole week', () => {
    const board = buildAttendanceBoard({
      records: [
        record({ _id: 'a1', shift: 's1', minutesWorked: 480 }),
        record({
          _id: 'a2',
          shift: 's2',
          employee: { _id: 'e2', firstName: 'Zoe', lastName: 'B' },
          minutesWorked: 240,
        }),
      ],
      shifts: [
        shift({ _id: 's1' }),
        shift({ _id: 's2', employee: { _id: 'e2', firstName: 'Zoe', lastName: 'B' } }),
      ],
      timeOff: [],
      now: AFTER,
    });

    const sheet = buildTimesheet(board.people, week, 60);
    expect(sheet.dayTotals['2026-08-13']).toBe(720);
    expect(sheet.total).toBe(720);
  });

  it('gives every row a cell for every day, so the grid is never ragged', () => {
    const board = buildAttendanceBoard({
      records: [record()],
      shifts: [shift()],
      timeOff: [],
      now: AFTER,
    });

    const cells = sheetKeys(buildTimesheet(board.people, week, 60));
    expect(cells).toEqual(week.map((d) => d.date));
  });
});

function sheetKeys(sheet: ReturnType<typeof buildTimesheet>): string[] {
  return Object.keys(sheet.rows[0].cells);
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/shared/employees/attendance-board-utils.test.ts`
Expected: FAIL — no export named `buildTimesheet`.

- [ ] **Step 3: Write the implementation**

Append to `src/app/shared/employees/attendance-board-utils.ts`. Add `DayColumn` and `LAGOS_OFFSET_MINUTES` to the existing `./shift-roster-utils` import, and add a new import of `recordDateKey` from `./attendance-utils`:

```ts
// ── The week timesheet ───────────────────────────────────────────────────────

export interface TimesheetCell {
  date: string;
  /** Closed minutes only. */
  minutes: number;
  /** Somebody is still on the clock on this day. */
  open: boolean;
  late: boolean;
  absent: boolean;
}

export interface TimesheetRow {
  employeeId: string;
  name: string;
  avatar: string;
  /** One entry per column, always — a ragged grid cannot be rendered. */
  cells: Record<string, TimesheetCell>;
  total: number;
}

export interface Timesheet {
  rows: TimesheetRow[];
  dayTotals: Record<string, number>;
  total: number;
}

function emptyCell(date: string): TimesheetCell {
  return { date, minutes: 0, open: false, late: false, absent: false };
}

/**
 * Employees × days, in minutes.
 *
 * Bucketed by the day the punch STARTED (recordDateKey — the existing rule),
 * so an overnight shift belongs to the day it began on this screen and on the
 * roster both. Splitting it across midnight would make one person's Thursday
 * disagree with their Thursday shift.
 *
 * An absence has no punch, so it cannot be bucketed from a record — it is
 * taken from the entry's SHIFT start instead. That is the whole reason this
 * takes board people rather than raw records.
 */
export function buildTimesheet(
  people: BoardPerson[],
  days: DayColumn[],
  offsetMinutes = LAGOS_OFFSET_MINUTES
): Timesheet {
  const dayTotals: Record<string, number> = {};
  for (const day of days) dayTotals[day.date] = 0;

  const rows: TimesheetRow[] = people.map((person) => {
    const cells: Record<string, TimesheetCell> = {};
    for (const day of days) cells[day.date] = emptyCell(day.date);

    let total = 0;

    for (const entry of person.entries) {
      if (entry.state === 'absent' && entry.shift) {
        const key = toLocalDateKey(entry.shift.start, offsetMinutes);
        if (cells[key]) cells[key].absent = true;
      }

      for (const record of entry.records) {
        const key = recordDateKey(record, offsetMinutes);
        const cell = cells[key];
        if (!cell) continue;

        if (record.status === 'closed') {
          const minutes = Number(record.minutesWorked) || 0;
          cell.minutes += minutes;
          total += minutes;
          dayTotals[key] += minutes;
        } else {
          cell.open = true;
        }
        if (record.punctuality?.code === 'late') cell.late = true;
      }
    }

    return {
      employeeId: person.employeeId,
      name: person.name,
      avatar: person.avatar,
      cells,
      total,
    };
  });

  return {
    rows,
    dayTotals,
    total: Object.values(dayTotals).reduce((sum, n) => sum + n, 0),
  };
}
```

Update the import block at the top of the file to:

```ts
import type { DayColumn } from './shift-roster-utils';
import {
  LAGOS_OFFSET_MINUTES,
  employeeName,
  toLocalDateKey,
} from './shift-roster-utils';
import { recordDateKey } from './attendance-utils';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/shared/employees/attendance-board-utils.test.ts`
Expected: PASS — 29 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/employees/attendance-board-utils.ts src/app/shared/employees/attendance-board-utils.test.ts
git commit -m "feat(attendance): aggregate a week of punches into a timesheet grid"
```

---

## Task 4: Timeline geometry

**Files:**
- Modify: `src/app/shared/employees/attendance-board-utils.ts` (append)
- Modify: `src/app/shared/employees/attendance-board-utils.test.ts` (append)

**Interfaces:**
- Consumes: `BoardPerson`, `BoardEntry` from Task 1.
- Produces: `TimelineWindow`, `TimelineTick`, `Bar`, `timelineWindow(people, now)`, `barGeometry(startMs, endMs, window)`, `MIN_TIMELINE_SPAN_MINUTES`.

- [ ] **Step 1: Write the failing test**

Append to `src/app/shared/employees/attendance-board-utils.test.ts`:

```ts
import { barGeometry, timelineWindow } from './attendance-board-utils';

describe('timelineWindow', () => {
  it('fits the day’s real extent, snapped out to whole hours', () => {
    const board = buildAttendanceBoard({
      records: [record({ clockIn: D('07:40'), clockOut: D('16:20') })],
      shifts: [shift({ start: D('08:00'), end: D('16:00') })],
      timeOff: [],
      now: AFTER,
    });

    const win = timelineWindow(board.people, Date.parse(D('17:00')), 60);
    // 07:40 snaps back to 07:00; `now` at 17:00 is the right edge.
    expect(win.startLabel).toBe('07:00');
    expect(win.endLabel).toBe('17:00');
  });

  it('honours an 8-hour minimum so one short shift is not drawn edge to edge', () => {
    const board = buildAttendanceBoard({
      records: [],
      shifts: [shift({ start: D('09:00'), end: D('11:00') })],
      timeOff: [],
      now: Date.parse(D('11:00')),
    });

    const win = timelineWindow(board.people, Date.parse(D('11:00')), 60);
    expect((win.endMs - win.startMs) / 3_600_000).toBeGreaterThanOrEqual(8);
  });

  it('emits an hourly tick per hour of the window', () => {
    const board = buildAttendanceBoard({
      records: [],
      shifts: [shift({ start: D('08:00'), end: D('16:00') })],
      timeOff: [],
      now: Date.parse(D('16:00')),
    });

    const win = timelineWindow(board.people, Date.parse(D('16:00')), 60);
    expect(win.ticks[0].label).toBe(win.startLabel);
    expect(win.ticks[0].leftPct).toBe(0);
    expect(win.ticks.every((t) => t.leftPct >= 0 && t.leftPct <= 100)).toBe(true);
  });

  it('falls back to a sane window when there is nothing at all', () => {
    const win = timelineWindow([], Date.parse(D('12:00')), 60);
    expect(win.endMs).toBeGreaterThan(win.startMs);
    expect(win.ticks.length).toBeGreaterThan(0);
  });
});

describe('barGeometry', () => {
  const win = {
    startMs: Date.parse(D('08:00')),
    endMs: Date.parse(D('16:00')),
  };

  it('places a bar as a percentage of the window', () => {
    const bar = barGeometry(Date.parse(D('10:00')), Date.parse(D('12:00')), win);
    expect(bar.leftPct).toBe(25);
    expect(bar.widthPct).toBe(25);
  });

  it('clamps a bar that crosses the window edge — an overnight must not overflow', () => {
    const bar = barGeometry(Date.parse(D('14:00')), Date.parse('2026-08-14T02:00:00.000Z'), win);
    expect(bar.leftPct).toBe(75);
    expect(bar.widthPct).toBe(25);
    expect(bar.leftPct + bar.widthPct).toBeLessThanOrEqual(100);
    expect(bar.clippedEnd).toBe(true);
  });

  it('clamps a bar starting before the window', () => {
    const bar = barGeometry(Date.parse(D('04:00')), Date.parse(D('10:00')), win);
    expect(bar.leftPct).toBe(0);
    expect(bar.clippedStart).toBe(true);
  });

  it('gives a zero-length bar a visible minimum width', () => {
    const bar = barGeometry(Date.parse(D('10:00')), Date.parse(D('10:00')), win);
    expect(bar.widthPct).toBeGreaterThan(0);
  });

  it('reports nothing for a bar entirely outside the window', () => {
    const bar = barGeometry(Date.parse(D('02:00')), Date.parse(D('04:00')), win);
    expect(bar.visible).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/shared/employees/attendance-board-utils.test.ts`
Expected: FAIL — no export named `timelineWindow`.

- [ ] **Step 3: Write the implementation**

Append to `src/app/shared/employees/attendance-board-utils.ts` (add `toLocalTimeLabel` to the existing `./shift-roster-utils` import):

```ts
// ── The day timeline ─────────────────────────────────────────────────────────

const MS_PER_HOUR = 3_600_000;

/**
 * The narrowest window the timeline will draw.
 *
 * A day with one two-hour shift would otherwise stretch it edge to edge, which
 * reads as "everybody worked all day" — the exact opposite of the truth.
 */
export const MIN_TIMELINE_SPAN_MINUTES = 8 * 60;

export interface TimelineTick {
  label: string;
  leftPct: number;
}

export interface TimelineWindow {
  startMs: number;
  endMs: number;
  startLabel: string;
  endLabel: string;
  ticks: TimelineTick[];
}

export interface Bar {
  leftPct: number;
  widthPct: number;
  visible: boolean;
  clippedStart: boolean;
  clippedEnd: boolean;
}

/** A hair of width, so a zero-length bar is still something you can see. */
const MIN_BAR_WIDTH_PCT = 0.4;

/**
 * The span the lanes are drawn across.
 *
 * Auto-fitted rather than a hardcoded 06:00–22:00, because a night shift under
 * a fixed window is drawn off-canvas — the lane looks empty and the person
 * looks absent. Snapped OUT to whole hours so the tick labels are round
 * numbers rather than 07:43.
 */
export function timelineWindow(
  people: BoardPerson[],
  now: number,
  offsetMinutes = LAGOS_OFFSET_MINUTES
): TimelineWindow {
  const points: number[] = [];
  for (const person of people) {
    for (const entry of person.entries) {
      if (entry.shift) {
        points.push(new Date(entry.shift.start).getTime());
        points.push(new Date(entry.shift.end).getTime());
      }
      for (const record of entry.records) {
        points.push(new Date(record.clockIn).getTime());
        if (record.clockOut) points.push(new Date(record.clockOut).getTime());
        // An open record runs to now — the lane has to reach far enough to
        // draw it, or somebody still working is drawn as though they left.
        else points.push(now);
      }
    }
  }

  const usable = points.filter((n) => !Number.isNaN(n));
  // With nothing at all, centre a default span on `now` rather than returning
  // a zero-width window that divides by zero downstream.
  const lo = usable.length ? Math.min(...usable) : now - 4 * MS_PER_HOUR;
  const hi = usable.length ? Math.max(...usable, now) : now + 4 * MS_PER_HOUR;

  let startMs = Math.floor(lo / MS_PER_HOUR) * MS_PER_HOUR;
  let endMs = Math.ceil(hi / MS_PER_HOUR) * MS_PER_HOUR;

  const minSpan = MIN_TIMELINE_SPAN_MINUTES * 60_000;
  if (endMs - startMs < minSpan) {
    const pad = Math.ceil((minSpan - (endMs - startMs)) / 2 / MS_PER_HOUR) * MS_PER_HOUR;
    startMs -= pad;
    endMs += pad;
  }

  const span = endMs - startMs;
  const ticks: TimelineTick[] = [];
  const hours = Math.round(span / MS_PER_HOUR);
  // Thin the labels out on a long window so they do not collide.
  const every = hours > 16 ? 3 : hours > 10 ? 2 : 1;
  for (let i = 0; i <= hours; i += every) {
    const at = startMs + i * MS_PER_HOUR;
    ticks.push({
      label: toLocalTimeLabel(new Date(at).toISOString(), offsetMinutes),
      leftPct: (i * MS_PER_HOUR * 100) / span,
    });
  }

  return {
    startMs,
    endMs,
    startLabel: toLocalTimeLabel(new Date(startMs).toISOString(), offsetMinutes),
    endLabel: toLocalTimeLabel(new Date(endMs).toISOString(), offsetMinutes),
    ticks,
  };
}

/**
 * One bar's placement, as percentages of the window.
 *
 * CLAMPED to [0, 100] on both ends. A shift crossing midnight otherwise
 * produces a width past the lane and overflows into the layout — and the
 * honest reading of a clipped bar is "it continues", which `clippedEnd` lets
 * the caller draw.
 */
export function barGeometry(
  startMs: number,
  endMs: number,
  window: { startMs: number; endMs: number }
): Bar {
  const span = window.endMs - window.startMs;
  const hidden: Bar = {
    leftPct: 0,
    widthPct: 0,
    visible: false,
    clippedStart: false,
    clippedEnd: false,
  };
  if (!(span > 0) || Number.isNaN(startMs) || Number.isNaN(endMs)) return hidden;

  const from = Math.min(startMs, endMs);
  const to = Math.max(startMs, endMs);
  if (to < window.startMs || from > window.endMs) return hidden;

  const clampedFrom = Math.max(from, window.startMs);
  const clampedTo = Math.min(to, window.endMs);

  const leftPct = ((clampedFrom - window.startMs) * 100) / span;
  const widthPct = Math.max(
    MIN_BAR_WIDTH_PCT,
    ((clampedTo - clampedFrom) * 100) / span
  );

  return {
    leftPct,
    // Never let the rounding-up minimum push the bar past the right edge.
    widthPct: Math.min(widthPct, 100 - leftPct),
    visible: true,
    clippedStart: from < window.startMs,
    clippedEnd: to > window.endMs,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/shared/employees/attendance-board-utils.test.ts`
Expected: PASS — 38 passed.

- [ ] **Step 5: Run the whole admin suite — nothing else may have moved**

Run: `npx vitest run`
Expected: **751 passed** (the 713 baseline plus this file's 38).

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/employees/attendance-board-utils.ts src/app/shared/employees/attendance-board-utils.test.ts
git commit -m "feat(attendance): fit the timeline window to the day and clamp its bars"
```

---

## Task 5: Lift the log table out of the page

Pure extraction, no behaviour change. Doing it first keeps Task 6's diff to the shell alone.

**Files:**
- Create: `src/app/shared/employees/attendance-log-table.tsx`
- Modify: `src/app/shared/employees/attendance-log-page.tsx:378-536` (the `{/* Log */}` block) and its now-unused imports

**Interfaces:**
- Consumes: `groupAttendance`, `recordTimes`, `editedByName`, `punctualityLabel`, `punctualityTone`, `recordDuration`, `sourceLabel`, `canDeleteRecord` from `./attendance-utils`.
- Produces: `AttendanceLogTable` (default export) with props `{ records, loading, dayLabel, onCorrect, onDelete }`.

- [ ] **Step 1: Create the component**

Create `src/app/shared/employees/attendance-log-table.tsx`:

```tsx
'use client';

// The flat log — every punch, grouped by person.
//
// Lifted out of attendance-log-page.tsx unchanged when that page grew a view
// switcher. This is the "what happened" framing; the live board answers "who is
// in" and the timeline answers "when". All three read the same records.

import Link from 'next/link';
import { PiPencilSimple, PiTrash } from 'react-icons/pi';
import {
  LAGOS_OFFSET_MINUTES,
  formatMinutes,
  toLocalTimeLabel,
} from './shift-roster-utils';
import {
  canDeleteRecord,
  editedByName,
  groupAttendance,
  punctualityLabel,
  punctualityTone,
  recordDuration,
  recordTimes,
  sourceLabel,
} from './attendance-utils';
import type { AttendanceRecord } from '@/services/attendance.service';
import { routes } from '@/config/routes';

const OFFSET = LAGOS_OFFSET_MINUTES;

interface Props {
  records: AttendanceRecord[];
  loading: boolean;
  /** Already-formatted, e.g. 'Thu, 13 Aug' — used in the empty state. */
  dayLabel: string;
  onCorrect: (record: AttendanceRecord) => void;
  onDelete: (record: AttendanceRecord) => void;
}

export default function AttendanceLogTable({
  records,
  loading,
  dayLabel,
  onCorrect,
  onDelete,
}: Props) {
  const groups = groupAttendance(records);

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/60 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <th className="px-4 py-3">Employee</th>
            <th className="px-4 py-3">In</th>
            <th className="px-4 py-3">Out</th>
            <th className="px-4 py-3">Shift</th>
            <th className="px-4 py-3">Punctuality</th>
            <th className="px-4 py-3">Worked</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                Loading…
              </td>
            </tr>
          )}

          {!loading && !groups.length && (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center">
                <p className="text-sm font-medium text-gray-500">
                  Nobody clocked in on {dayLabel}
                </p>
                <Link
                  href={routes.employees.attendanceKiosk}
                  className="mt-2 inline-block text-sm font-semibold text-[#b20202] hover:underline"
                >
                  Open the kiosk
                </Link>
              </td>
            </tr>
          )}

          {!loading &&
            groups.map((group) =>
              group.records.map((record, i) => {
                const times = recordTimes(record, OFFSET);
                const editor = editedByName(record);
                const shift = record.shift;
                return (
                  <tr
                    key={record._id}
                    className={`border-b border-gray-100 last:border-0 ${
                      i === 0 ? '' : 'bg-gray-50/40'
                    }`}
                  >
                    <td className="px-4 py-3">
                      {i === 0 ? (
                        <div>
                          {/* Through to their history and rating. Plain text
                              when the ref did not populate — there is no id
                              to route to. */}
                          {group.employeeId ? (
                            <Link
                              href={routes.employees.attendanceFor(
                                group.employeeId
                              )}
                              className="font-semibold text-gray-900 underline-offset-2 hover:text-[#b20202] hover:underline"
                            >
                              {group.name}
                            </Link>
                          ) : (
                            <span className="font-semibold text-gray-900">
                              {group.name}
                            </span>
                          )}
                          <p className="text-xs text-gray-400">
                            {group.isIn ? (
                              <span className="font-semibold text-green-600">
                                On the clock
                              </span>
                            ) : (
                              `${formatMinutes(group.minutes)} today`
                            )}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">↳</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-900">
                      {times.in}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-600">
                      {record.clockOut ? (
                        times.out
                      ) : (
                        <span className="text-green-600">still in</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {shift && typeof shift !== 'string'
                        ? `${toLocalTimeLabel(shift.start, OFFSET)}–${toLocalTimeLabel(shift.end, OFFSET)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${punctualityTone(
                          record.punctuality?.code
                        )}`}
                      >
                        {punctualityLabel(record.punctuality)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-gray-900">
                      {recordDuration(record)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">
                        {sourceLabel(record.source)}
                      </span>
                      {editor && (
                        <p className="text-[11px] text-amber-700">
                          Corrected by {editor}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onCorrect(record)}
                          aria-label="Correct this record"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                        >
                          <PiPencilSimple className="h-4 w-4" />
                        </button>
                        {/* Offered only for admin rows: the API refuses a
                            kiosk punch with a 409, and a button that always
                            fails is worse than no button. */}
                        {canDeleteRecord(record) && (
                          <button
                            type="button"
                            onClick={() => onDelete(record)}
                            aria-label="Delete this record"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <PiTrash className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Replace the block in the page**

In `attendance-log-page.tsx`, delete the entire `{/* Log */}` block (the `<div className="overflow-x-auto rounded-2xl …">` through its closing `</div>`, lines 378–536) and put in its place:

```tsx
      <AttendanceLogTable
        records={items}
        loading={loading}
        dayLabel={dayLabel(day)}
        onCorrect={openCorrection}
        onDelete={(record) => void remove(record)}
      />
```

Add the import beside the other local imports:

```tsx
import AttendanceLogTable from './attendance-log-table';
```

Then delete the imports the page no longer uses. After this edit the page still uses `toLocalTimeLabel`? **No** — remove it. The surviving `./shift-roster-utils` import is:

```tsx
import {
  LAGOS_OFFSET_MINUTES,
  addDays,
  localToday,
  toLocalDateKey,
  formatMinutes,
} from './shift-roster-utils';
```

and the surviving `./attendance-utils` import is:

```tsx
import { recordTimes } from './attendance-utils';
```

Remove `PiPencilSimple` and `PiTrash` from the `react-icons/pi` import, and remove the now-unused `useMemo`-derived `groups` binding:

```tsx
  const groups = useMemo(() => groupAttendance(items), [items]);
```

- [ ] **Step 3: Typecheck — this is the only check a pure extraction needs**

Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -vc "\.next/"`
Expected: `453`. Any number above it means a leftover import or a dropped binding; the error text names the file and line.

- [ ] **Step 4: Lint for unused imports**

Run: `npx next lint --file src/app/shared/employees/attendance-log-page.tsx --file src/app/shared/employees/attendance-log-table.tsx`
Expected: no errors. Warnings about unused vars mean an import survived its last use — delete it.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/employees/attendance-log-table.tsx src/app/shared/employees/attendance-log-page.tsx
git commit -m "refactor(attendance): lift the log table out of the page unchanged"
```

---

## Task 6: The shell — three-way fetch, view state, KPI cards, toolbar

The biggest task. It rewires the page but renders only the log table; Tasks 7–10 slot their panes into the `switch` this creates.

**Files:**
- Modify: `src/app/shared/employees/attendance-log-page.tsx`
- Modify: `src/app/(hydrogen)/employees/attendance/page.tsx`

**Interfaces:**
- Consumes: `buildAttendanceBoard`, `attendanceRate` (Task 1); `shiftService.roster`, `timeOffService.list`; `buildWeek`, `startOfWeek`, `weekRangeLabel` from `./shift-roster-utils`.
- Produces: the `AttendanceView` type and the shell's local contract — every pane receives `{ board, loading }` and calls back with `onCorrect(record)`.

- [ ] **Step 1: Add the view type and range helper to the page**

At the top of `attendance-log-page.tsx`, after the existing constants:

```tsx
const VIEWS = [
  { key: 'live', label: 'Live' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'log', label: 'Log' },
  { key: 'week', label: 'Week' },
  { key: 'exceptions', label: 'Exceptions' },
] as const;

export type AttendanceView = (typeof VIEWS)[number]['key'];

const VIEW_KEYS = VIEWS.map((v) => v.key) as readonly string[];

/** An unknown ?view= falls back rather than rendering nothing. */
function parseView(raw: string | null): AttendanceView {
  return VIEW_KEYS.includes(raw ?? '') ? (raw as AttendanceView) : 'live';
}

/** Only the week view widens the window; every other view is one day. */
function rangeFor(view: AttendanceView, day: string): { from: string; to: string } {
  if (view !== 'week') return { from: day, to: day };
  const first = startOfWeek(day);
  return { from: first, to: addDays(first, 6) };
}
```

- [ ] **Step 2: Replace the state and fetch effect**

Replace the `useState` block and the `load` callback with:

```tsx
  const router = useRouter();
  const searchParams = useSearchParams();

  const view = parseView(searchParams.get('view'));
  const day = searchParams.get('date') || localToday(OFFSET);

  const [employeeFilter, setEmployeeFilter] = useState('');
  const [items, setItems] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>(EMPTY_SUMMARY);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffRequest[]>([]);
  /** False when the roster or leave read failed. Absence counts go '—'. */
  const [rosterReady, setRosterReady] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [saving, setSaving] = useState(false);
  /** Ticks so open records show a live elapsed. Display only. */
  const [now, setNow] = useState(() => Date.now());

  /** Both are in the URL, so a manager can send somebody this exact screen. */
  const setParams = useCallback(
    (next: { view?: AttendanceView; date?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.view) params.set('view', next.view);
      if (next.date) params.set('date', next.date);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const range = useMemo(() => rangeFor(view, day), [view, day]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    const employee = employeeFilter || undefined;

    // The punches are the only required read. The roster and leave are what
    // make an ABSENCE visible — an absence leaves no record, so it cannot be
    // computed from punches at any price — but a failure in either must not
    // blank the punches, which are still true.
    const [log, roster, leave] = await Promise.allSettled([
      attendanceService.log({ ...range, employee }, token),
      shiftService.roster({ ...range, employee }, token),
      timeOffService.list(
        { ...range, employee, status: 'approved', scope: 'all' },
        token
      ),
    ]);

    if (log.status === 'fulfilled') {
      setItems(log.value.items);
      setSummary(log.value.summary);
    } else {
      toast.error(
        log.reason instanceof Error
          ? log.reason.message
          : 'Failed to load attendance'
      );
      setItems([]);
      setSummary(EMPTY_SUMMARY);
    }

    setShifts(roster.status === 'fulfilled' ? roster.value.items : []);
    setTimeOff(leave.status === 'fulfilled' ? leave.value.items : []);
    // Reporting zero absences from a failed roster read would be good news
    // nobody verified. The page says "unknown" instead.
    setRosterReady(
      roster.status === 'fulfilled' && leave.status === 'fulfilled'
    );

    setLoading(false);
  }, [token, range, employeeFilter]);
```

**The employee filter is passed to all three reads.** Filtering only the punches would join one person's punches against everybody's roster, and every other employee would render as an absence.

**Keep the existing effect that drives it** — `load`'s identity now changes with `range`, so switching view or date refetches:

```tsx
  useEffect(() => {
    void load();
  }, [load]);
```

- [ ] **Step 3: Add the board, the poll, and the KPI figures**

After the existing `withoutPin` memo:

```tsx
  const board = useMemo(
    () =>
      buildAttendanceBoard({
        records: items,
        shifts,
        timeOff,
        now,
      }),
    [items, shifts, timeOff, now]
  );

  const rate = attendanceRate(board.totals);

  // Only the live board polls, and only while it is on screen. An interval
  // left running behind the other four views is background traffic nobody
  // asked for, and a hidden tab is nobody looking.
  useEffect(() => {
    if (view !== 'live') return;
    const tick = () => {
      if (document.hidden) return;
      setNow(Date.now());
      void load();
    };
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [view, load]);
```

- [ ] **Step 4: Replace the stats strip with KPI cards**

Replace the `stats` array and the `<div className="ml-auto flex flex-wrap items-center gap-4">` block with:

```tsx
  const kpis = [
    {
      label: 'On the clock',
      value: String(board.totals.onTheClock),
      tone: board.totals.onTheClock ? 'text-green-600' : 'text-gray-900',
    },
    {
      // '—' rather than 100% when the roster never arrived: a percentage of an
      // unknown denominator is a made-up number.
      label: 'Attendance',
      value: rosterReady && rate !== null ? `${rate}%` : '—',
      tone: 'text-gray-900',
    },
    { label: 'Hours', value: formatMinutes(summary.minutes), tone: 'text-gray-900' },
    {
      label: 'Late',
      value: String(board.totals.late),
      tone: board.totals.late ? 'text-amber-600' : 'text-gray-900',
    },
    {
      label: 'Absent',
      value: rosterReady ? String(board.totals.absent) : '—',
      tone: board.totals.absent ? 'text-red-600' : 'text-gray-900',
    },
  ];
```

and render it, above the toolbar:

```tsx
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {k.label}
            </span>
            <span className={`text-xl font-black tabular-nums ${k.tone}`}>
              {k.value}
            </span>
          </div>
        ))}
      </div>
```

- [ ] **Step 5: Add the view switcher and adapt the date nav**

Put the switcher first in the toolbar row:

```tsx
        <div className="flex items-center gap-0.5 rounded-xl border border-gray-200 bg-white p-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setParams({ view: v.key })}
              aria-pressed={view === v.key}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                view === v.key
                  ? 'bg-[#b20202] text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
```

and make the date nav step by the unit in view, so "previous" on the week view means the previous week:

```tsx
  const step = view === 'week' ? 7 : 1;
  const rangeLabel =
    view === 'week' ? weekRangeLabel(buildWeek(day)) : dayLabel(day);
```

Replace the two caret `onClick`s with `() => setParams({ date: addDays(day, -step) })` and `() => setParams({ date: addDays(day, step) })`, the label with `{rangeLabel}`, their `aria-label`s with `` `Previous ${view === 'week' ? 'week' : 'day'}` `` and the same for next, and the Today button with `() => setParams({ date: localToday(OFFSET) })`.

- [ ] **Step 6: Add the view switch where the table was**

```tsx
      {!rosterReady && (
        <p className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          The roster could not be loaded, so absences are not shown. The punches
          below are complete.
        </p>
      )}

      {view === 'log' && (
        <AttendanceLogTable
          records={items}
          loading={loading}
          dayLabel={dayLabel(day)}
          onCorrect={openCorrection}
          onDelete={(record) => void remove(record)}
        />
      )}

      {view !== 'log' && (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-400">
          Loading…
        </div>
      )}
```

The placeholder is replaced branch by branch in Tasks 7–10.

- [ ] **Step 7: Add the imports**

```tsx
import { useRouter, useSearchParams } from 'next/navigation';
import { shiftService, type Shift } from '@/services/shift.service';
import { timeOffService, type TimeOffRequest } from '@/services/timeOff.service';
import {
  buildAttendanceBoard,
  attendanceRate,
} from './attendance-board-utils';
```

and extend the `./shift-roster-utils` import with `buildWeek`, `startOfWeek`, `weekRangeLabel`.

- [ ] **Step 8: Add the Suspense boundary the route now needs**

`useSearchParams()` in Next 15 must sit under a `<Suspense>` boundary or the
**production build fails** — `npm run dev` renders it fine, so this does not
show up until `npm run build`. Follow the pattern already in
`src/app/(hydrogen)/purchases/page.tsx:12`.

Replace `src/app/(hydrogen)/employees/attendance/page.tsx` entirely with:

```tsx
'use client';

import { Suspense } from 'react';
import AttendanceLogPage from '@/app/shared/employees/attendance-log-page';

export default function AttendancePage() {
  return (
    <Suspense>
      <AttendanceLogPage />
    </Suspense>
  );
}
```

- [ ] **Step 9: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -vc "\.next/"`
Expected: `453`.

- [ ] **Step 10: Prove it compiles and server-renders**

Admin auth is middleware with an explicit PATH-LIST matcher (`src/middleware.ts`), so a route **outside** that list renders a gated component with no login — the only browser-free way to prove a page compiles and SSRs.

Create `src/app/smoke-x/page.tsx`:

```tsx
import AttendanceLogPage from '@/app/shared/employees/attendance-log-page';

export default function SmokeX() {
  return <AttendanceLogPage />;
}
```

Run in one terminal: `npm run dev`
Then: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/smoke-x`
Expected: `200`. A `500` means a render-time throw — read the dev server output for the stack.

- [ ] **Step 11: Delete the smoke route**

```bash
rm -rf src/app/smoke-x
```

It must not be committed: it is a gated component reachable with no login.

- [ ] **Step 12: Commit**

```bash
git add src/app/shared/employees/attendance-log-page.tsx src/app/\(hydrogen\)/employees/attendance/page.tsx
git commit -m "feat(attendance): fetch the roster alongside the punches and switch views"
```

---

## Task 7: The live board

**Files:**
- Create: `src/app/shared/employees/attendance-live-board.tsx`
- Modify: `src/app/shared/employees/attendance-log-page.tsx` (the `view !== 'log'` placeholder)

**Interfaces:**
- Consumes: `AttendanceBoard`, `BoardPerson`, `EntryState` (Task 1).
- Produces: `AttendanceLiveBoard` (default) with props `{ board, now, loading, onCorrect }`.

- [ ] **Step 1: Create the component**

Create `src/app/shared/employees/attendance-live-board.tsx`:

```tsx
'use client';

// "Who is in the building?" — the question a manager actually opens this screen
// with, answered as a wall of cards rather than a table to read down.
//
// The elapsed figure here is DISPLAY ONLY and is never written back into
// minutesWorked. The server reports 0 minutes for an open record deliberately:
// a running total would make the same record read differently on every refresh,
// and the day's totals would drift while nobody was looking.

import Link from 'next/link';
import { PiPencilSimple } from 'react-icons/pi';
import {
  LAGOS_OFFSET_MINUTES,
  formatMinutes,
  toLocalTimeLabel,
} from './shift-roster-utils';
import type {
  AttendanceBoard,
  BoardPerson,
  EntryState,
} from './attendance-board-utils';
import type { AttendanceRecord } from '@/services/attendance.service';
import { routes } from '@/config/routes';

const OFFSET = LAGOS_OFFSET_MINUTES;

/** Section order matches ENTRY_STATE_RANK: what needs attention comes first. */
const SECTIONS: { state: EntryState; title: string; empty: string }[] = [
  { state: 'in', title: 'On the clock', empty: 'Nobody is clocked in.' },
  { state: 'absent', title: 'Not clocked in', empty: 'Everybody turned up.' },
  { state: 'due', title: 'Due in', empty: 'Nobody else is expected.' },
  { state: 'unrostered', title: 'Unrostered', empty: 'No unrostered punches.' },
  { state: 'done', title: 'Done for the day', empty: 'Nobody has finished yet.' },
  { state: 'leave', title: 'On leave', empty: 'Nobody is on leave.' },
];

const TONES: Record<EntryState, { dot: string; ring: string; text: string }> = {
  in: { dot: 'bg-green-500', ring: 'ring-green-200', text: 'text-green-700' },
  absent: { dot: 'bg-red-500', ring: 'ring-red-200', text: 'text-red-700' },
  due: { dot: 'bg-sky-400', ring: 'ring-sky-200', text: 'text-sky-700' },
  unrostered: { dot: 'bg-amber-400', ring: 'ring-amber-200', text: 'text-amber-700' },
  done: { dot: 'bg-gray-300', ring: 'ring-gray-200', text: 'text-gray-500' },
  leave: { dot: 'bg-violet-400', ring: 'ring-violet-200', text: 'text-violet-700' },
};

interface Props {
  board: AttendanceBoard;
  /** Ticks each minute in the shell, so elapsed stays live. */
  now: number;
  loading: boolean;
  onCorrect: (record: AttendanceRecord) => void;
}

/** Initials for the avatar fallback — never blank, never 'undefined'. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function openRecord(person: BoardPerson): AttendanceRecord | null {
  for (const entry of person.entries) {
    for (const record of entry.records) {
      if (record.status === 'open') return record;
    }
  }
  return null;
}

/** The line under the name — what this person's state actually means. */
function detail(person: BoardPerson, now: number): string {
  const open = openRecord(person);
  if (open) {
    const elapsed = Math.max(
      0,
      Math.round((now - new Date(open.clockIn).getTime()) / 60_000)
    );
    return `In at ${toLocalTimeLabel(open.clockIn, OFFSET)} · ${formatMinutes(elapsed)} so far`;
  }

  const first = person.entries[0];
  if (person.state === 'due' && first?.shift) {
    return `Due ${toLocalTimeLabel(first.shift.start, OFFSET)}`;
  }
  if (person.state === 'absent' && first?.shift) {
    return `Rostered ${toLocalTimeLabel(first.shift.start, OFFSET)}–${toLocalTimeLabel(first.shift.end, OFFSET)} · no punch`;
  }
  if (person.state === 'leave') return 'Approved leave';
  if (person.minutesWorked) return `${formatMinutes(person.minutesWorked)} worked`;
  return '—';
}

export default function AttendanceLiveBoard({
  board,
  now,
  loading,
  onCorrect,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  const populated = SECTIONS.map((section) => ({
    ...section,
    people: board.people.filter((p) => p.state === section.state),
  })).filter((s) => s.people.length || s.state === 'in' || s.state === 'absent');

  return (
    <div className="space-y-6">
      {populated.map((section) => {
        const tone = TONES[section.state];
        return (
          <section key={section.state}>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
              {section.title}
              <span className="tabular-nums text-gray-400">
                {section.people.length}
              </span>
            </h2>

            {!section.people.length ? (
              <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                {section.empty}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {section.people.map((person) => {
                  const open = openRecord(person);
                  const role = person.entries.find((e) => e.shift?.roleName)
                    ?.shift?.roleName;
                  return (
                    <div
                      key={person.employeeId || person.name}
                      className={`rounded-2xl border border-gray-200 bg-white p-4 ring-1 ring-inset ${tone.ring}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                          {initials(person.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          {/* Through to their history and rating. Plain text
                              when the ref did not populate — there is no id
                              to route to. */}
                          {person.employeeId ? (
                            <Link
                              href={routes.employees.attendanceFor(
                                person.employeeId
                              )}
                              className="block truncate font-semibold text-gray-900 underline-offset-2 hover:text-[#b20202] hover:underline"
                            >
                              {person.name}
                            </Link>
                          ) : (
                            <span className="block truncate font-semibold text-gray-900">
                              {person.name}
                            </span>
                          )}
                          <p className={`mt-0.5 text-xs ${tone.text}`}>
                            {detail(person, now)}
                          </p>
                          {role && (
                            <p className="mt-1 text-[11px] text-gray-400">
                              {role}
                            </p>
                          )}
                        </div>
                        {open && (
                          <button
                            type="button"
                            onClick={() => onCorrect(open)}
                            aria-label={`Correct ${person.name}’s record`}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                          >
                            <PiPencilSimple className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

`On the clock` and `Not clocked in` render even when empty — "nobody is missing" is an answer worth showing, and a section that vanishes reads as a page that failed to load.

- [ ] **Step 2: Wire it into the shell**

In `attendance-log-page.tsx`, replace the `view !== 'log'` placeholder's `live` case:

```tsx
      {view === 'live' && (
        <AttendanceLiveBoard
          board={board}
          now={now}
          loading={loading}
          onCorrect={openCorrection}
        />
      )}
```

and narrow the placeholder to `{(view === 'timeline' || view === 'week' || view === 'exceptions') && (…)}`.

Add: `import AttendanceLiveBoard from './attendance-live-board';`

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -vc "\.next/"`
Expected: `453`.

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/employees/attendance-live-board.tsx src/app/shared/employees/attendance-log-page.tsx
git commit -m "feat(attendance): a live board answering who is in right now"
```

---

## Task 8: The day timeline

**Files:**
- Create: `src/app/shared/employees/attendance-day-timeline.tsx`
- Modify: `src/app/shared/employees/attendance-log-page.tsx`

**Interfaces:**
- Consumes: `timelineWindow`, `barGeometry`, `AttendanceBoard`, `BoardEntry` (Tasks 1, 4).
- Produces: `AttendanceDayTimeline` (default) with props `{ board, now, loading, onCorrect }`.

- [ ] **Step 1: Create the component**

Create `src/app/shared/employees/attendance-day-timeline.tsx`:

```tsx
'use client';

// The day as shape rather than numbers.
//
// The rostered shift is drawn pale, the punch solid on top of it. A late start
// is then a gap on the left and overtime is a tail on the right, both readable
// without comparing two timestamps in your head.
//
// An ABSENT lane draws an outlined bar, never an empty row: an empty row is
// indistinguishable from "no data", and the whole reason this view exists is
// that an absence has no record to show.

import Link from 'next/link';
import {
  LAGOS_OFFSET_MINUTES,
  formatMinutes,
  toLocalTimeLabel,
} from './shift-roster-utils';
import {
  barGeometry,
  timelineWindow,
  type AttendanceBoard,
  type BoardEntry,
} from './attendance-board-utils';
import type { AttendanceRecord } from '@/services/attendance.service';
import { routes } from '@/config/routes';

const OFFSET = LAGOS_OFFSET_MINUTES;

interface Props {
  board: AttendanceBoard;
  now: number;
  loading: boolean;
  onCorrect: (record: AttendanceRecord) => void;
}

/** The solid bar's colour, by what the entry came to. */
const PUNCH_TONE: Record<string, string> = {
  in: 'bg-green-500',
  done: 'bg-[#b20202]',
  unrostered: 'bg-amber-400',
};

function entryTitle(entry: BoardEntry): string {
  const shift = entry.shift
    ? `Rostered ${toLocalTimeLabel(entry.shift.start, OFFSET)}–${toLocalTimeLabel(entry.shift.end, OFFSET)}`
    : 'No shift';
  const punches = entry.records
    .map(
      (r) =>
        `${toLocalTimeLabel(r.clockIn, OFFSET)}–${
          r.clockOut ? toLocalTimeLabel(r.clockOut, OFFSET) : 'still in'
        }`
    )
    .join(', ');
  return punches ? `${shift} · punched ${punches}` : shift;
}

export default function AttendanceDayTimeline({
  board,
  now,
  loading,
  onCorrect,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  if (!board.people.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-12 text-center">
        <p className="text-sm font-medium text-gray-500">
          Nothing rostered and nobody punched.
        </p>
      </div>
    );
  }

  const win = timelineWindow(board.people, now, OFFSET);
  const nowBar = barGeometry(now, now, win);

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <div className="min-w-[760px]">
        {/* Hour ruler */}
        <div className="flex border-b border-gray-200 bg-gray-50/60">
          <div className="w-44 shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Employee
          </div>
          <div className="relative flex-1 py-2">
            {win.ticks.map((tick) => (
              <span
                key={tick.label}
                style={{ left: `${tick.leftPct}%` }}
                className="absolute -translate-x-1/2 text-[10px] font-semibold tabular-nums text-gray-400"
              >
                {tick.label}
              </span>
            ))}
          </div>
          <div className="w-20 shrink-0 px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Worked
          </div>
        </div>

        {/* Lanes */}
        {board.people.map((person) => (
          <div
            key={person.employeeId || person.name}
            className="flex border-b border-gray-100 last:border-0"
          >
            <div className="w-44 shrink-0 px-4 py-3">
              {person.employeeId ? (
                <Link
                  href={routes.employees.attendanceFor(person.employeeId)}
                  className="block truncate text-sm font-semibold text-gray-900 underline-offset-2 hover:text-[#b20202] hover:underline"
                >
                  {person.name}
                </Link>
              ) : (
                <span className="block truncate text-sm font-semibold text-gray-900">
                  {person.name}
                </span>
              )}
            </div>

            <div className="relative min-h-[44px] flex-1 border-l border-gray-100">
              {/* Hour gridlines, behind everything. */}
              {win.ticks.map((tick) => (
                <span
                  key={tick.label}
                  style={{ left: `${tick.leftPct}%` }}
                  className="absolute inset-y-0 w-px bg-gray-100"
                />
              ))}

              {/* Now. */}
              {nowBar.visible && (
                <span
                  style={{ left: `${nowBar.leftPct}%` }}
                  className="absolute inset-y-0 w-px bg-[#b20202]/40"
                />
              )}

              {person.entries.map((entry) => {
                const rostered = entry.shift
                  ? barGeometry(
                      new Date(entry.shift.start).getTime(),
                      new Date(entry.shift.end).getTime(),
                      win
                    )
                  : null;

                return (
                  <div key={entry.key} title={entryTitle(entry)}>
                    {/* The roster, pale and underneath. */}
                    {rostered?.visible && (
                      <span
                        style={{
                          left: `${rostered.leftPct}%`,
                          width: `${rostered.widthPct}%`,
                        }}
                        className={`absolute top-1/2 h-5 -translate-y-1/2 rounded-md ${
                          entry.state === 'absent'
                            ? 'border-2 border-dashed border-red-300 bg-red-50'
                            : entry.state === 'leave'
                              ? 'border border-violet-200 bg-violet-50'
                              : 'bg-gray-100'
                        }`}
                      />
                    )}

                    {/* The punches, solid and on top. An open record runs to
                        now with a soft edge, so it does not read as a
                        clock-out that happened. */}
                    {entry.records.map((record) => {
                      const from = new Date(record.clockIn).getTime();
                      const to = record.clockOut
                        ? new Date(record.clockOut).getTime()
                        : now;
                      const bar = barGeometry(from, to, win);
                      if (!bar.visible) return null;
                      return (
                        <button
                          key={record._id}
                          type="button"
                          onClick={() => onCorrect(record)}
                          aria-label={`Correct ${person.name}’s record`}
                          style={{
                            left: `${bar.leftPct}%`,
                            width: `${bar.widthPct}%`,
                          }}
                          className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-full ${
                            PUNCH_TONE[entry.state] ?? 'bg-gray-400'
                          } ${record.status === 'open' ? 'opacity-70' : ''} ${
                            bar.clippedEnd ? 'rounded-r-none' : ''
                          } ${bar.clippedStart ? 'rounded-l-none' : ''}`}
                        />
                      );
                    })}

                    {/* An absence has no bar to click, so it says so. */}
                    {entry.state === 'absent' && rostered?.visible && (
                      <span
                        style={{ left: `${rostered.leftPct}%` }}
                        className="absolute top-1/2 ml-2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-red-500"
                      >
                        No punch
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="w-20 shrink-0 px-3 py-3 text-right text-sm font-semibold tabular-nums text-gray-900">
              {person.minutesWorked ? formatMinutes(person.minutesWorked) : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the shell**

```tsx
      {view === 'timeline' && (
        <AttendanceDayTimeline
          board={board}
          now={now}
          loading={loading}
          onCorrect={openCorrection}
        />
      )}
```

Narrow the placeholder to `{(view === 'week' || view === 'exceptions') && (…)}`.

Add: `import AttendanceDayTimeline from './attendance-day-timeline';`

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -vc "\.next/"`
Expected: `453`.

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/employees/attendance-day-timeline.tsx src/app/shared/employees/attendance-log-page.tsx
git commit -m "feat(attendance): draw the day as lanes so lateness reads as shape"
```

---

## Task 9: The week timesheet

**Files:**
- Create: `src/app/shared/employees/attendance-week-timesheet.tsx`
- Modify: `src/app/shared/employees/attendance-log-page.tsx`

**Interfaces:**
- Consumes: `buildTimesheet` (Task 3), `buildWeek`/`DayColumn` from `./shift-roster-utils`.
- Produces: `AttendanceWeekTimesheet` (default) with props `{ board, days, loading }`.

- [ ] **Step 1: Create the component**

Create `src/app/shared/employees/attendance-week-timesheet.tsx`:

```tsx
'use client';

// The payroll framing: how many hours did each person do this week.
//
// A cell carrying a late arrival or an absence gets a corner marker, so the
// exceptions are not laundered into an hours figure. An hours total that hides
// three absences is worse than no total.

import Link from 'next/link';
import { formatMinutes, type DayColumn } from './shift-roster-utils';
import { buildTimesheet, type AttendanceBoard } from './attendance-board-utils';
import { routes } from '@/config/routes';

interface Props {
  board: AttendanceBoard;
  days: DayColumn[];
  loading: boolean;
}

export default function AttendanceWeekTimesheet({
  board,
  days,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  const sheet = buildTimesheet(board.people, days);

  if (!sheet.rows.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-12 text-center">
        <p className="text-sm font-medium text-gray-500">
          Nothing rostered and nobody punched this week.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/60 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <th className="px-4 py-3 text-left">Employee</th>
            {days.map((day) => (
              <th
                key={day.date}
                className={`px-3 py-3 text-center ${day.isWeekend ? 'text-gray-300' : ''}`}
              >
                {day.weekday} {day.dayNumber}
              </th>
            ))}
            <th className="px-4 py-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row) => (
            <tr key={row.employeeId || row.name} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-3">
                {row.employeeId ? (
                  <Link
                    href={routes.employees.attendanceFor(row.employeeId)}
                    className="font-semibold text-gray-900 underline-offset-2 hover:text-[#b20202] hover:underline"
                  >
                    {row.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-gray-900">{row.name}</span>
                )}
              </td>

              {days.map((day) => {
                const cell = row.cells[day.date];
                return (
                  <td
                    key={day.date}
                    className={`relative px-3 py-3 text-center tabular-nums ${
                      cell.minutes ? 'font-semibold text-gray-900' : 'text-gray-300'
                    } ${day.isWeekend ? 'bg-gray-50/40' : ''}`}
                  >
                    {cell.minutes ? formatMinutes(cell.minutes) : '·'}
                    {cell.open && (
                      <span
                        title="Still on the clock"
                        className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-green-500"
                      />
                    )}
                    {cell.late && (
                      <span
                        title="Late arrival"
                        className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500"
                      />
                    )}
                    {cell.absent && (
                      <span
                        title="Rostered, no punch"
                        className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-red-500"
                      />
                    )}
                  </td>
                );
              })}

              <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">
                {row.total ? formatMinutes(row.total) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200 bg-gray-50/60">
            <td className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Total
            </td>
            {days.map((day) => (
              <td
                key={day.date}
                className="px-3 py-3 text-center text-sm font-bold tabular-nums text-gray-900"
              >
                {sheet.dayTotals[day.date]
                  ? formatMinutes(sheet.dayTotals[day.date])
                  : '·'}
              </td>
            ))}
            <td className="px-4 py-3 text-right text-sm font-black tabular-nums text-[#b20202]">
              {formatMinutes(sheet.total)}
            </td>
          </tr>
        </tfoot>
      </table>

      <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
        <span className="mr-3">
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />
          late
        </span>
        <span className="mr-3">
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />
          rostered, no punch
        </span>
        <span>
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500 align-middle" />
          still on the clock
        </span>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the shell**

```tsx
      {view === 'week' && (
        <AttendanceWeekTimesheet
          board={board}
          days={buildWeek(day)}
          loading={loading}
        />
      )}
```

Narrow the placeholder to `{view === 'exceptions' && (…)}`.

Add: `import AttendanceWeekTimesheet from './attendance-week-timesheet';`

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -vc "\.next/"`
Expected: `453`.

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/employees/attendance-week-timesheet.tsx src/app/shared/employees/attendance-log-page.tsx
git commit -m "feat(attendance): a week timesheet the day view could never express"
```

---

## Task 10: The exceptions worklist, and full verification

**Files:**
- Create: `src/app/shared/employees/attendance-exceptions.tsx`
- Modify: `src/app/shared/employees/attendance-log-page.tsx`

**Interfaces:**
- Consumes: `buildExceptions`, `EXCEPTION_ORDER`, `ExceptionKind`, `ExceptionRow` (Task 2).
- Produces: `AttendanceExceptions` (default) with props `{ board, dayStart, loading, onCorrect }`.

- [ ] **Step 1: Create the component**

Create `src/app/shared/employees/attendance-exceptions.tsx`:

```tsx
'use client';

// Everything on this window that wants a manager, worst first.
//
// The action is ON the row, not behind a navigation: this is the view where the
// work actually gets done, and a worklist you have to leave to act on is a
// list, not a worklist.

import Link from 'next/link';
import { PiPencilSimple } from 'react-icons/pi';
import {
  LAGOS_OFFSET_MINUTES,
  formatMinutes,
  toLocalTimeLabel,
} from './shift-roster-utils';
import {
  EXCEPTION_ORDER,
  buildExceptions,
  type AttendanceBoard,
  type ExceptionKind,
  type ExceptionRow,
} from './attendance-board-utils';
import type { AttendanceRecord } from '@/services/attendance.service';
import { routes } from '@/config/routes';

const OFFSET = LAGOS_OFFSET_MINUTES;

const KIND_LABEL: Record<ExceptionKind, string> = {
  stale_open: 'Never clocked out',
  absent: 'Rostered, no punch',
  late: 'Late',
  left_early: 'Left early',
  unrostered: 'No shift',
};

const KIND_TONE: Record<ExceptionKind, string> = {
  stale_open: 'bg-red-50 text-red-700 border-red-200',
  absent: 'bg-red-50 text-red-700 border-red-200',
  late: 'bg-amber-50 text-amber-700 border-amber-200',
  left_early: 'bg-amber-50 text-amber-700 border-amber-200',
  unrostered: 'bg-gray-50 text-gray-600 border-gray-200',
};

/** Why this row is here, in words a manager can act on. */
function why(row: ExceptionRow): string {
  const shift = row.entry.shift;
  const window = shift
    ? `${toLocalTimeLabel(shift.start, OFFSET)}–${toLocalTimeLabel(shift.end, OFFSET)}`
    : '';

  switch (row.kind) {
    case 'stale_open':
      return row.record
        ? `In at ${toLocalTimeLabel(row.record.clockIn, OFFSET)} and never out — this record is counting 0 minutes.`
        : 'Never clocked out.';
    case 'absent':
      return `Rostered ${window} and nothing was punched.`;
    case 'late':
      return `${formatMinutes(row.minutes)} after the ${window} start.`;
    case 'left_early':
      return `Left ${formatMinutes(row.minutes)} before the ${window} end.`;
    default:
      return row.record
        ? `Punched ${toLocalTimeLabel(row.record.clockIn, OFFSET)} against no rostered shift.`
        : 'No rostered shift.';
  }
}

interface Props {
  board: AttendanceBoard;
  /** Start of the day in view, ms. An open record from before it is stale. */
  dayStart: number;
  loading: boolean;
  onCorrect: (record: AttendanceRecord) => void;
}

export default function AttendanceExceptions({
  board,
  dayStart,
  loading,
  onCorrect,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  const rows = buildExceptions(board.people, { dayStart });

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-12 text-center">
        <p className="text-sm font-semibold text-green-600">Nothing to chase.</p>
        <p className="mt-1 text-sm text-gray-500">
          Everybody rostered turned up, on time, and clocked out.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {EXCEPTION_ORDER.map((kind) => {
        const group = rows.filter((r) => r.kind === kind);
        if (!group.length) return null;

        return (
          <section key={kind}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              {KIND_LABEL[kind]}
              <span className="ml-2 tabular-nums text-gray-400">
                {group.length}
              </span>
            </h2>

            <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
              {group.map((row) => (
                <div
                  key={row.key}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${KIND_TONE[kind]}`}
                  >
                    {KIND_LABEL[kind]}
                  </span>

                  <div className="min-w-0 flex-1">
                    {row.employeeId ? (
                      <Link
                        href={routes.employees.attendanceFor(row.employeeId)}
                        className="font-semibold text-gray-900 underline-offset-2 hover:text-[#b20202] hover:underline"
                      >
                        {row.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-gray-900">
                        {row.name}
                      </span>
                    )}
                    <p className="text-xs text-gray-500">{why(row)}</p>
                  </div>

                  {/* An absence has no record to correct — the fix is a manual
                      entry from the header, or nothing at all if they were
                      genuinely away. */}
                  {row.record ? (
                    <button
                      type="button"
                      onClick={() => onCorrect(row.record as AttendanceRecord)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
                    >
                      <PiPencilSimple className="h-3.5 w-3.5" />
                      Correct
                    </button>
                  ) : (
                    <span className="text-[11px] text-gray-400">
                      No record to correct
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Wire it in and delete the placeholder**

Replace the remaining `{view === 'exceptions' && (…placeholder…)}` with:

```tsx
      {view === 'exceptions' && (
        <AttendanceExceptions
          board={board}
          dayStart={Date.parse(`${day}T00:00:00.000Z`) - OFFSET * 60_000}
          loading={loading}
          onCorrect={openCorrection}
        />
      )}
```

`dayStart` is the local day's start as an absolute instant — the same conversion the drawer's `toUtc` does. Using UTC midnight instead would call an 00:30 Lagos punch "yesterday's".

Add: `import AttendanceExceptions from './attendance-exceptions';`

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -vc "\.next/"`
Expected: `453`.

- [ ] **Step 4: Run the whole admin suite**

Run: `npx vitest run`
Expected: **751 passed** — the 713 baseline plus the 38 new. A lower total means a file stopped being collected, not that fewer tests failed; check the file count.

- [ ] **Step 5: Smoke every view**

Create `src/app/smoke-x/page.tsx` again:

```tsx
import AttendanceLogPage from '@/app/shared/employees/attendance-log-page';

export default function SmokeX() {
  return <AttendanceLogPage />;
}
```

Run `npm run dev`, then **serially** (parallel curl against this stack fakes 90s timeouts):

```bash
for v in live timeline log week exceptions; do
  printf '%s ' "$v"
  curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3000/smoke-x?view=$v"
done
```

Expected: `200` for all five. A `500` on one view is that pane throwing at render — the dev server output names the component and line.

- [ ] **Step 6: Delete the smoke route**

```bash
rm -rf src/app/smoke-x
```

Confirm it is gone before committing: `git status --short src/app/smoke-x` must print nothing.

- [ ] **Step 7: Production build — the only check that catches a missing Suspense boundary**

Run: `npm run build`
Expected: build completes. A failure reading `useSearchParams() should be
wrapped in a suspense boundary` means Task 6 Step 8 was skipped or reverted —
`npm run dev` and the smoke route both pass without it.

This build has OOM'd at 6GB before; the `build` script already sets
`--max-old-space-size=6144`. If it still runs out, that is a pre-existing
condition, not something this branch introduced — note it and move on.

- [ ] **Step 8: Format**

Run: `npx prettier --write "src/app/shared/employees/attendance-*.ts" "src/app/shared/employees/attendance-*.tsx"`

- [ ] **Step 9: Commit**

Stage **only** the attendance files. `kiosk-devices-page.tsx` and
`kiosk-device-utils.test.ts` are modified in this working tree by unrelated
earlier work — a broad `git add src/app/shared/employees/` would sweep them
into this commit.

```bash
git add src/app/shared/employees/attendance-exceptions.tsx \
        src/app/shared/employees/attendance-log-page.tsx \
        src/app/shared/employees/attendance-board-utils.ts \
        src/app/shared/employees/attendance-live-board.tsx \
        src/app/shared/employees/attendance-day-timeline.tsx \
        src/app/shared/employees/attendance-week-timesheet.tsx \
        src/app/shared/employees/attendance-log-table.tsx
git commit -m "feat(attendance): an exceptions worklist ordered by what needs a human"
```

---

## Done when

- `npx vitest run` → **751 passed** (713 baseline + 38 new)
- `./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep -vc "\.next/"` → **453**
- `npm run build` completes
- All five views return `200` from the smoke route, and the smoke route is deleted
- `git status --short` shows no `src/app/smoke-x`
- The kiosk, the badge, and `/employees/attendance/[employeeId]` are untouched
