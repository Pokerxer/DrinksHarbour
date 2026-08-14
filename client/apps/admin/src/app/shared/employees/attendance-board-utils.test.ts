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
