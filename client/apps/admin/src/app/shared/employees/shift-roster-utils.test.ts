import { describe, it, expect } from 'vitest';
import {
  LAGOS_OFFSET_MINUTES as LAGOS,
  addDays,
  toLocalDateKey,
  toLocalTimeLabel,
  toUtcIso,
  localWindowToUtc,
  startOfWeek,
  buildWeek,
  weekRangeLabel,
  shiftMinutes,
  publishOutcomeMessage,
  formatMinutes,
  employeeName,
  buildRosterLanes,
  conflictLabel,
  mergeAvailability,
  summariseAssignmentResult,
  assignedLabel,
  toggleTicked,
  summariseSkips,
  templateDaysLabel,
  templateTimeLabel,
  isCycleWorkDay,
  cyclePreview,
  cycleSummaryLabel,
  templateRepeatLabel,
  cycleOffsets,
  toggleCycleDay,
  clampCycleDays,
  weekdayShort,
} from './shift-roster-utils';
import type { Shift } from '@/services/shift.service';
import { ShiftConflictError } from '@/services/shift.service';

const ROLE = { _id: 'r1', name: 'Bartender', color: '#b20202' };

const shift = (over: Partial<Shift> = {}): Shift =>
  ({
    _id: Math.random().toString(36).slice(2),
    employee: null,
    role: ROLE,
    start: '2026-08-10T08:00:00.000Z',
    end: '2026-08-10T16:00:00.000Z',
    breakMinutes: 0,
    status: 'draft',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  }) as Shift;

describe('date arithmetic', () => {
  it('adds days across a month boundary', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('reads a UTC instant into the tenant local day, not the browser one', () => {
    // 23:30 UTC is already the next day in Lagos (+1).
    expect(toLocalDateKey('2026-08-10T23:30:00.000Z', LAGOS)).toBe(
      '2026-08-11'
    );
    expect(toLocalDateKey('2026-08-10T23:30:00.000Z', 0)).toBe('2026-08-10');
  });

  it('formats a local wall clock time', () => {
    expect(toLocalTimeLabel('2026-08-10T08:00:00.000Z', LAGOS)).toBe('09:00');
    expect(toLocalTimeLabel('not a date', LAGOS)).toBe('');
  });

  it('round-trips a wall clock time through UTC without drifting', () => {
    const iso = toUtcIso('2026-08-10', '09:00', LAGOS);
    expect(iso).toBe('2026-08-10T08:00:00.000Z');
    // Saving an unchanged form must not move the shift by the offset.
    expect(toLocalTimeLabel(iso, LAGOS)).toBe('09:00');
    expect(toLocalDateKey(iso, LAGOS)).toBe('2026-08-10');
  });

  it('rolls an overnight window into the next day', () => {
    const { start, end } = localWindowToUtc(
      '2026-08-10',
      '22:00',
      '06:00',
      LAGOS
    );
    expect(start).toBe('2026-08-10T21:00:00.000Z');
    expect(end).toBe('2026-08-11T05:00:00.000Z');
  });

  it('treats equal times as a 24-hour cover, not a zero-length shift', () => {
    const { start, end } = localWindowToUtc(
      '2026-08-10',
      '09:00',
      '09:00',
      LAGOS
    );
    expect(Date.parse(end) - Date.parse(start)).toBe(24 * 60 * 60 * 1000);
  });
});

describe('buildWeek', () => {
  it('starts on Monday by default whatever day is anchored', () => {
    // 2026-08-13 is a Thursday.
    const days = buildWeek('2026-08-13');
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe('2026-08-10');
    expect(days[0].weekday).toBe('Mon');
    expect(days[6].date).toBe('2026-08-16');
    expect(days[6].weekday).toBe('Sun');
  });

  it('can start on Sunday', () => {
    expect(startOfWeek('2026-08-13', 0)).toBe('2026-08-09');
  });

  it('carries the Sunday-based dow a template matches on', () => {
    const days = buildWeek('2026-08-10');
    // Monday's column must report 1, matching daysOfWeek on a ShiftTemplate.
    expect(days[0].dow).toBe(1);
    expect(days[6].dow).toBe(0);
    expect(days[5].isWeekend).toBe(true);
    expect(days[0].isWeekend).toBe(false);
  });

  it('collapses a shared month and year in the range label', () => {
    expect(weekRangeLabel(buildWeek('2026-08-13'))).toBe('10 – 16 Aug 2026');
    expect(weekRangeLabel(buildWeek('2026-08-31'))).toBe('31 Aug – 6 Sep 2026');
    expect(weekRangeLabel(buildWeek('2026-12-31'))).toBe(
      '28 Dec 2026 – 3 Jan 2027'
    );
  });
});

describe('shiftMinutes', () => {
  it('subtracts the unpaid break', () => {
    expect(
      shiftMinutes({
        start: '2026-08-10T08:00:00.000Z',
        end: '2026-08-10T16:00:00.000Z',
        breakMinutes: 30,
      })
    ).toBe(450);
  });

  it('never returns negative time for a break longer than the shift', () => {
    expect(
      shiftMinutes({
        start: '2026-08-10T08:00:00.000Z',
        end: '2026-08-10T09:00:00.000Z',
        breakMinutes: 120,
      })
    ).toBe(0);
  });

  it('formats hours and minutes', () => {
    expect(formatMinutes(450)).toBe('7h 30m');
    expect(formatMinutes(480)).toBe('8h');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(-10)).toBe('0m');
  });
});

describe('employeeName', () => {
  it('falls back through email to a placeholder, never blank', () => {
    expect(employeeName({ _id: '1', firstName: 'Ada', lastName: 'Obi' })).toBe(
      'Ada Obi'
    );
    expect(employeeName({ _id: '1', email: 'a@b.c' })).toBe('a@b.c');
    expect(employeeName({ _id: '1' })).toBe('Unnamed employee');
    expect(employeeName(null)).toBe('Unassigned');
  });
});

describe('buildRosterLanes', () => {
  const days = buildWeek('2026-08-10');
  const employees = [
    { _id: 'e1', firstName: 'Ada', lastName: 'Obi' },
    { _id: 'e2', firstName: 'Bode', lastName: 'Ali' },
  ];

  it('gives every listed employee a lane even with no shifts', () => {
    const { rows } = buildRosterLanes({
      shifts: [],
      days,
      employees,
      offsetMinutes: LAGOS,
    });
    expect(rows.map((r) => r.name)).toEqual(['Ada Obi', 'Bode Ali']);
    // An empty row is how an admin sees who is free.
    expect(Object.keys(rows[0].cells)).toHaveLength(7);
    expect(rows[0].count).toBe(0);
  });

  it('puts an unassigned shift in the open lane, not an employee row', () => {
    const { open, rows } = buildRosterLanes({
      shifts: [shift({ employee: null })],
      days,
      employees,
      offsetMinutes: LAGOS,
    });
    expect(open.count).toBe(1);
    expect(open.cells['2026-08-10']).toHaveLength(1);
    expect(rows.every((r) => r.count === 0)).toBe(true);
  });

  it('buckets a shift on the local day it starts', () => {
    // 23:30 UTC on the 10th is 00:30 on the 11th in Lagos.
    const { open } = buildRosterLanes({
      shifts: [
        shift({
          start: '2026-08-10T23:30:00.000Z',
          end: '2026-08-11T06:00:00.000Z',
        }),
      ],
      days,
      employees,
      offsetMinutes: LAGOS,
    });
    expect(open.cells['2026-08-11']).toHaveLength(1);
    expect(open.cells['2026-08-10']).toHaveLength(0);
  });

  it('shows an overnight shift once, on the evening it begins', () => {
    const { open } = buildRosterLanes({
      shifts: [
        shift({
          start: '2026-08-10T21:00:00.000Z',
          end: '2026-08-11T05:00:00.000Z',
        }),
      ],
      days,
      employees,
      offsetMinutes: LAGOS,
    });
    expect(open.cells['2026-08-10']).toHaveLength(1);
    expect(open.cells['2026-08-11']).toHaveLength(0);
    expect(open.minutes).toBe(480);
  });

  it('drops cancelled shifts from the grid and from the hours', () => {
    const { rows } = buildRosterLanes({
      shifts: [
        shift({ employee: 'e1', status: 'cancelled' }),
        shift({ employee: 'e1', status: 'published' }),
      ],
      days,
      employees,
      offsetMinutes: LAGOS,
    });
    const ada = rows.find((r) => r.employeeId === 'e1');
    expect(ada?.count).toBe(1);
    expect(ada?.minutes).toBe(480);
  });

  it('keeps a lane for an employee who is no longer in the active list', () => {
    // Deactivated mid-week: their shift must not silently disappear from the
    // roster while still sitting in the database.
    const { rows } = buildRosterLanes({
      shifts: [
        shift({ employee: { _id: 'e9', firstName: 'Chidi', lastName: 'Eze' } }),
      ],
      days,
      employees,
      offsetMinutes: LAGOS,
    });
    expect(rows.map((r) => r.name)).toContain('Chidi Eze');
  });

  it('sorts each day cell by start time', () => {
    const late = shift({
      employee: 'e1',
      start: '2026-08-10T14:00:00.000Z',
      end: '2026-08-10T18:00:00.000Z',
    });
    const early = shift({
      employee: 'e1',
      start: '2026-08-10T06:00:00.000Z',
      end: '2026-08-10T10:00:00.000Z',
    });
    const { rows } = buildRosterLanes({
      shifts: [late, early],
      days,
      employees,
      offsetMinutes: LAGOS,
    });
    const cell =
      rows.find((r) => r.employeeId === 'e1')?.cells['2026-08-10'] ?? [];
    expect(cell.map((s) => s._id)).toEqual([early._id, late._id]);
  });

  it('ignores a shift outside the displayed week', () => {
    const { open } = buildRosterLanes({
      shifts: [
        shift({
          start: '2026-09-01T08:00:00.000Z',
          end: '2026-09-01T16:00:00.000Z',
        }),
      ],
      days,
      employees,
      offsetMinutes: LAGOS,
    });
    expect(open.count).toBe(0);
  });
});

describe('conflicts', () => {
  it('names each refusal code', () => {
    expect(conflictLabel('overlap')).toMatch(/already scheduled/i);
    expect(conflictLabel('role_mismatch')).toMatch(/not marked/i);
    expect(conflictLabel('time_off')).toMatch(/time off/i);
    expect(conflictLabel('something_new')).toBe('Could not be scheduled');
  });

});

describe('summariseSkips', () => {
  it('groups by reason, most common first, listing the templates', () => {
    const out = summariseSkips([
      { template: 'Morning', reason: 'A shift already exists for this slot' },
      { template: 'Evening', reason: 'A shift already exists for this slot' },
      { template: 'Morning', reason: 'A shift already exists for this slot' },
      { template: 'Night', reason: 'Template has no days of the week set' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].count).toBe(3);
    expect(out[0].templates).toEqual(['Morning', 'Evening']);
    expect(out[1].reason).toMatch(/no days/);
  });

  it('handles nothing skipped', () => {
    expect(summariseSkips([])).toEqual([]);
  });
});

describe('template display', () => {
  it('collapses a contiguous run of three or more', () => {
    expect(templateDaysLabel([1, 2, 3, 4, 5])).toBe('Mon–Fri');
    expect(templateDaysLabel([0, 6])).toBe('Sun, Sat');
    expect(templateDaysLabel([1, 3, 5])).toBe('Mon, Wed, Fri');
    expect(templateDaysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(templateDaysLabel([])).toBe('No days set');
    expect(templateDaysLabel(undefined)).toBe('No days set');
  });

  it('marks an overnight template', () => {
    expect(templateTimeLabel('09:00', '17:00')).toBe('09:00–17:00');
    expect(templateTimeLabel('22:00', '06:00')).toBe('22:00–06:00 +1');
  });

  it('uses explicit endDayOffset when provided', () => {
    // 08:40→09:00 with offset 1 = 24h 20m, displayed as +1
    expect(templateTimeLabel('08:40', '09:00', 1)).toBe('08:40–09:00 +1');
    // End after start but on a later day
    expect(templateTimeLabel('09:00', '17:00', 1)).toBe('09:00–17:00 +1');
    expect(templateTimeLabel('09:00', '17:00', 2)).toBe('09:00–17:00 +2');
    // Offset 0 falls back to the legacy heuristic
    expect(templateTimeLabel('09:00', '17:00', 0)).toBe('09:00–17:00');
    expect(templateTimeLabel('22:00', '06:00', 0)).toBe('22:00–06:00 +1');
  });
});

describe('cycle recurrence', () => {
  // 2026-08-10 is a Monday. One day on, one day off, anchored to it.
  const ONE_ON_ONE_OFF = {
    cycleLength: 2,
    cycleDays: [0],
    anchorDate: '2026-08-10',
  };

  it('works the anchor day and then every other day', () => {
    expect(isCycleWorkDay('2026-08-10', ONE_ON_ONE_OFF)).toBe(true);
    expect(isCycleWorkDay('2026-08-11', ONE_ON_ONE_OFF)).toBe(false);
    expect(isCycleWorkDay('2026-08-12', ONE_ON_ONE_OFF)).toBe(true);
  });

  it('resolves dates before the anchor', () => {
    // The preview opens on today, which is often earlier than the anchor an
    // admin just typed. A plain % would go negative and match nothing.
    expect(isCycleWorkDay('2026-08-09', ONE_ON_ONE_OFF)).toBe(false);
    expect(isCycleWorkDay('2026-08-08', ONE_ON_ONE_OFF)).toBe(true);
  });

  it('agrees with the server that an empty cycle generates nothing', () => {
    expect(
      isCycleWorkDay('2026-08-10', { ...ONE_ON_ONE_OFF, cycleDays: [] })
    ).toBe(false);
  });

  it('is false rather than throwing on a half-filled cycle', () => {
    expect(isCycleWorkDay('2026-08-10', { ...ONE_ON_ONE_OFF, anchorDate: '' })).toBe(false);
    expect(isCycleWorkDay('2026-08-10', { ...ONE_ON_ONE_OFF, cycleLength: 0 })).toBe(false);
    expect(isCycleWorkDay('nonsense', ONE_ON_ONE_OFF)).toBe(false);
  });

  it('previews consecutive days from a start date, marked on or off', () => {
    const days = cyclePreview(ONE_ON_ONE_OFF, '2026-08-10', 4);
    expect(days).toEqual([
      { date: '2026-08-10', worked: true },
      { date: '2026-08-11', worked: false },
      { date: '2026-08-12', worked: true },
      { date: '2026-08-13', worked: false },
    ]);
  });

  it('previews a 4-on/4-off rotation drifting across the week', () => {
    const cycle = {
      cycleLength: 8,
      cycleDays: [0, 1, 2, 3],
      anchorDate: '2026-08-10',
    };
    const worked = cyclePreview(cycle, '2026-08-10', 14)
      .filter((d) => d.worked)
      .map((d) => d.date);
    expect(worked).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
    ]);
  });

  it('previews nothing when the cycle cannot be resolved', () => {
    expect(cyclePreview({ ...ONE_ON_ONE_OFF, anchorDate: '' }, '2026-08-10', 5)).toEqual([]);
    expect(cyclePreview(ONE_ON_ONE_OFF, 'nonsense', 5)).toEqual([]);
  });

  it('describes a run starting at day 0 as N on / M off', () => {
    expect(cycleSummaryLabel(2, [0])).toBe('1 on / 1 off');
    expect(cycleSummaryLabel(8, [0, 1, 2, 3])).toBe('4 on / 4 off');
    expect(cycleSummaryLabel(5, [0, 1, 2, 3, 4])).toBe('Every day');
  });

  it('describes a scattered cycle by how many days of how many', () => {
    expect(cycleSummaryLabel(5, [0, 2])).toBe('2 days in every 5');
    expect(cycleSummaryLabel(2, [])).toBe('No cycle days set');
  });

  it('labels a template by whichever recurrence it actually uses', () => {
    expect(
      templateRepeatLabel({ recurrence: 'weekly', daysOfWeek: [1, 2, 3, 4, 5] })
    ).toBe('Mon–Fri');
    // A template stored before cycles existed has no recurrence at all.
    expect(templateRepeatLabel({ daysOfWeek: [1, 3, 5] })).toBe('Mon, Wed, Fri');
    expect(
      templateRepeatLabel({ recurrence: 'cycle', ...ONE_ON_ONE_OFF })
    ).toBe('1 on / 1 off');
  });
});

describe('cycle form helpers', () => {
  it('lists one offset per day of the cycle, capped and never negative', () => {
    expect(cycleOffsets(3)).toEqual([0, 1, 2]);
    expect(cycleOffsets(0)).toEqual([]);
    expect(cycleOffsets(-2)).toEqual([]);
    expect(cycleOffsets(undefined)).toEqual([]);
    // A rotation longer than a month is a typo, not a pattern anyone works.
    expect(cycleOffsets(400)).toHaveLength(31);
  });

  it('toggles a worked offset, keeping the list sorted and unique', () => {
    expect(toggleCycleDay([0, 2], 1)).toEqual([0, 1, 2]);
    expect(toggleCycleDay([0, 1, 2], 1)).toEqual([0, 2]);
    expect(toggleCycleDay(undefined, 3)).toEqual([3]);
  });

  it('drops worked offsets that a shortened cycle no longer has', () => {
    // Left in place they would be rejected by the server as outside the cycle.
    expect(clampCycleDays([0, 2, 4], 3)).toEqual([0, 2]);
    expect(clampCycleDays([0, 1], 5)).toEqual([0, 1]);
    expect(clampCycleDays([0, 1], 0)).toEqual([]);
  });
});

describe('weekdayShort', () => {
  it('names the weekday of a local date key', () => {
    // 2026-08-10 is a Monday. The preview leans on this to show the weekday
    // drift that is the whole reason a cycle is not a weekday list.
    expect(weekdayShort('2026-08-10')).toBe('Mon');
    expect(weekdayShort('2026-08-16')).toBe('Sun');
  });

  it('is empty rather than wrong for an unparseable date', () => {
    expect(weekdayShort('nonsense')).toBe('');
    expect(weekdayShort('')).toBe('');
  });
});

describe('what a publish tells the manager', () => {
  it('reports a clean publish', () => {
    expect(publishOutcomeMessage({ published: 4, heldBack: 0 })).toBe(
      '4 shifts published'
    );
  });

  it('counts one shift in the singular', () => {
    expect(publishOutcomeMessage({ published: 1, heldBack: 0 })).toBe(
      '1 shift published'
    );
  });

  it('says nothing was outstanding when there was nothing to do', () => {
    expect(publishOutcomeMessage({ published: 0, heldBack: 0 })).toBe(
      'Nothing left to publish'
    );
  });

  it('explains the shifts it would not publish', () => {
    // The whole reason this function exists. The server refuses to publish into
    // the past, because a published shift with no punch against it counts as an
    // absence — so publishing last week marks staff absent for shifts they were
    // never shown. Reporting only the 4 that went through would read as a
    // partial failure, and the manager would press it again.
    const msg = publishOutcomeMessage({ published: 4, heldBack: 3 });
    expect(msg).toContain('4 shifts published');
    expect(msg).toContain('3');
    expect(msg).toMatch(/past/i);
  });

  it('explains a publish that did nothing BUT held things back', () => {
    // Selecting a week that has already gone. "Nothing left to publish" here
    // would be a lie: there is plenty, and it is deliberately not being done.
    const msg = publishOutcomeMessage({ published: 0, heldBack: 6 });
    expect(msg).not.toBe('Nothing left to publish');
    expect(msg).toMatch(/past/i);
    expect(msg).toContain('6');
  });

  it('treats a missing heldBack as none', () => {
    // The server did not always return this field; an older response must not
    // render "undefined shifts are in the past".
    expect(publishOutcomeMessage({ published: 2 })).toBe('2 shifts published');
  });
});

// ── Multi-select picker ──────────────────────────────────────────────────────

const EMP_A = { _id: 'a', firstName: 'Ada', lastName: 'Obi' };
const EMP_B = { _id: 'b', firstName: 'Chidi', lastName: 'Nwosu' };
const EMP_C = { _id: 'c', firstName: 'Ngozi', lastName: 'Eze' };

describe('mergeAvailability', () => {
  it('attaches each verdict to its employee by id', () => {
    const rows = mergeAvailability(
      [EMP_A, EMP_B],
      [
        { employee: EMP_A, ok: true, code: null, message: null, forceable: false },
        {
          employee: EMP_B,
          ok: false,
          code: 'time_off',
          message: 'This employee has approved time off covering that period',
          forceable: false,
        },
      ]
    );
    expect(rows.map((r) => [r.id, r.ok, r.code])).toEqual([
      ['a', true, null],
      ['b', false, 'time_off'],
    ]);
    expect(rows[1].reason).toBe('On approved time off');
    expect(rows[1].forceable).toBe(false);
  });

  it('leaves an employee with no verdict unbadged rather than hiding them', () => {
    const rows = mergeAvailability([EMP_A, EMP_C], [
      { employee: EMP_A, ok: true, code: null, message: null, forceable: false },
    ]);
    expect(rows).toHaveLength(2);
    const ngozi = rows.find((r) => r.id === 'c');
    expect(ngozi?.ok).toBe(true);
    expect(ngozi?.reason).toBeNull();
  });

  it('renders no badges at all before the verdicts arrive', () => {
    const rows = mergeAvailability([EMP_A, EMP_B], []);
    expect(rows.every((r) => r.ok && r.reason === null)).toBe(true);
  });

  it('names each row the same way the roster lanes do', () => {
    expect(mergeAvailability([EMP_A], [])[0].name).toBe('Ada Obi');
  });

  it('sorts rows by name, independent of input order', () => {
    // `bindEditedAssignment` binds the FIRST ticked id to the row already being
    // edited, so who inherits that row must track what is on screen (name
    // order), not the API's own createdAt: -1 ordering.
    const rows = mergeAvailability([EMP_C, EMP_A, EMP_B], []);
    expect(rows.map((r) => r.name)).toEqual([
      'Ada Obi',
      'Chidi Nwosu',
      'Ngozi Eze',
    ]);
  });

  it('includes an extra person not in the active employee list', () => {
    // The shift's current holder, suspended or terminated since the shift was
    // made — the page loads employees with { status: 'active' }, so they would
    // otherwise be missing from the picker entirely, with nothing on screen
    // explaining why "1 selected" shows no ticked row.
    const inactiveHolder = { _id: 'z', firstName: 'Zainab', lastName: 'Musa' };
    const rows = mergeAvailability([EMP_A], [], [inactiveHolder]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'z']);
    expect(rows.find((r) => r.id === 'z')?.name).toBe('Zainab Musa');
  });

  it('does not duplicate an extra person who is already in the active list', () => {
    const rows = mergeAvailability([EMP_A], [], [EMP_A]);
    expect(rows).toHaveLength(1);
  });
});

describe('summariseAssignmentResult', () => {
  const conflictErr = (
    blocked: { employee: typeof EMP_A | null; code: string; message: string; forceable: boolean }[],
    allowedCount: number
  ) =>
    new ShiftConflictError(
      'x',
      'assignment_conflicts',
      [],
      blocked.map((b) => ({ ...b, conflicts: [] })),
      Array.from({ length: allowedCount }, () => ({ employee: EMP_A, warnings: [] }))
    );

  it('offers "assign anyway" only when every block is forceable', () => {
    const all = summariseAssignmentResult(
      conflictErr(
        [{ employee: EMP_B, code: 'role_mismatch', message: 'm', forceable: true }],
        2
      )
    );
    expect(all.canForceAll).toBe(true);

    const mixed = summariseAssignmentResult(
      conflictErr(
        [
          { employee: EMP_B, code: 'role_mismatch', message: 'm', forceable: true },
          { employee: EMP_C, code: 'overlap', message: 'm', forceable: false },
        ],
        2
      )
    );
    expect(mixed.canForceAll).toBe(false);
  });

  it('offers "skip these" only when somebody would still be scheduled', () => {
    const some = summariseAssignmentResult(
      conflictErr([{ employee: EMP_B, code: 'overlap', message: 'm', forceable: false }], 3)
    );
    expect(some.canSkip).toBe(true);
    expect(some.heading).toBe('1 of 4 people cannot be scheduled');

    const none = summariseAssignmentResult(
      conflictErr([{ employee: EMP_B, code: 'overlap', message: 'm', forceable: false }], 0)
    );
    expect(none.canSkip).toBe(false);
    expect(none.heading).toBe('Nobody selected can be scheduled');
  });

  it('names every blocked person and why', () => {
    const out = summariseAssignmentResult(
      conflictErr(
        [
          { employee: EMP_B, code: 'overlap', message: 'm', forceable: false },
          { employee: EMP_C, code: 'time_off', message: 'm', forceable: false },
        ],
        1
      )
    );
    expect(out.lines).toEqual([
      { id: 'b', name: 'Chidi Nwosu', reason: 'Already scheduled at that time' },
      { id: 'c', name: 'Ngozi Eze', reason: 'On approved time off' },
    ]);
  });

  it('gives a blocked no_employee entry a stable, non-colliding id', () => {
    // `employee` can legitimately be null for a `no_employee` verdict, so the
    // id cannot come from `employee._id` — the li key would collide with any
    // other such line instead of just falling back to undefined.
    const out = summariseAssignmentResult(
      conflictErr(
        [
          { employee: null, code: 'no_employee', message: 'm', forceable: false },
          { employee: null, code: 'no_employee', message: 'm', forceable: false },
        ],
        0
      )
    );
    expect(out.lines[0].id).toBeTruthy();
    expect(out.lines[1].id).toBeTruthy();
    expect(out.lines[0].id).not.toBe(out.lines[1].id);
  });

  it('refuses to offer "skip these" when the kept person is themselves blocked (pinned)', () => {
    // Editing a shift: untick the current holder, tick Ada (who overlaps) and
    // Ben (clear). Ada becomes the `keep` because she is first in display
    // order, so her refusal is PINNED to the row and cannot be skipped —
    // skipping never touches the row being edited, that IS the edit that was
    // asked for. Offering the button anyway would just be refused again.
    const out = summariseAssignmentResult(
      new ShiftConflictError(
        'x',
        'assignment_conflicts',
        [],
        [
          {
            employee: EMP_A,
            code: 'overlap',
            message: 'm',
            forceable: false,
            conflicts: [],
            pinned: true,
          },
        ],
        [{ employee: EMP_B, warnings: [] }]
      )
    );
    expect(out.canSkip).toBe(false);
  });

  it('still offers "skip these" when the only block is unpinned', () => {
    const out = summariseAssignmentResult(
      new ShiftConflictError(
        'x',
        'assignment_conflicts',
        [],
        [
          {
            employee: EMP_B,
            code: 'overlap',
            message: 'm',
            forceable: false,
            conflicts: [],
            pinned: false,
          },
        ],
        [{ employee: EMP_A, warnings: [] }]
      )
    );
    expect(out.canSkip).toBe(true);
  });

  it('falls back to the single-employee 409 shape', () => {
    const out = summariseAssignmentResult(
      new ShiftConflictError('Already scheduled', 'overlap', [])
    );
    expect(out.lines).toEqual([
      { id: 'single', name: 'This employee', reason: 'Already scheduled at that time' },
    ]);
    expect(out.canForceAll).toBe(false);
    expect(out.canSkip).toBe(false);
  });
});

describe('toggleTicked', () => {
  // The picker's own display order — independent of click order, and of the
  // filter term, which only ever narrows what is RENDERED from this list.
  const ROWS = [
    { id: 'a', name: 'Ada Obi', ok: true, code: null, reason: null, forceable: false },
    { id: 'b', name: 'Chidi Nwosu', ok: true, code: null, reason: null, forceable: false },
    { id: 'c', name: 'Ngozi Eze', ok: true, code: null, reason: null, forceable: false },
  ];

  it('rebuilds in display order, not click order', () => {
    // Click the third row, then the first — the server binds the FIRST id in
    // the array to the row being edited, so the outcome must track what is
    // on screen, not which button the admin happened to hit first.
    let ticked = toggleTicked(ROWS, [], 'c', true);
    ticked = toggleTicked(ROWS, ticked, 'a', true);
    expect(ticked).toEqual(['a', 'c']);
  });

  it('unticking removes only that id and leaves the rest in order', () => {
    const ticked = toggleTicked(ROWS, ['a', 'b', 'c'], 'b', false);
    expect(ticked).toEqual(['a', 'c']);
  });

  it('keeps a ticked id that the filter is currently hiding', () => {
    // 'b' is ticked but not in visibleRows right now (filtered out) — it must
    // still be passed in `ticked`, and must survive ticking someone else.
    const ticked = toggleTicked(ROWS, ['b'], 'a', true);
    expect(ticked).toEqual(['a', 'b']);
  });

  it('does not duplicate an id that is already ticked', () => {
    const ticked = toggleTicked(ROWS, ['a'], 'a', true);
    expect(ticked).toEqual(['a']);
  });

  it('unticking the last one yields an empty, open-shift list', () => {
    const ticked = toggleTicked(ROWS, ['a'], 'a', false);
    expect(ticked).toEqual([]);
  });

  it('keeps an id absent from pickerRows when ticking someone else', () => {
    // The shift's current holder can be ticked (openExisting seeds
    // draft.employees from the shift regardless of employee status) without
    // appearing in pickerRows (built from the active-only employee list).
    // Rebuilding purely from pickerRows would silently drop them — and on
    // save, `bindEditedAssignment` would then reassign the row to whoever was
    // left, with nothing on screen having said so.
    const ticked = toggleTicked(ROWS, ['unknown-holder'], 'a', true);
    expect(ticked).toContain('unknown-holder');
    expect(ticked).toContain('a');
  });

  it('sorts an id unknown to pickerRows ahead of known ids, so it stays the keep', () => {
    // `bindEditedAssignment` binds the FIRST id in the array to the row being
    // edited. The unrecognised id IS the incumbent, so it must stay first —
    // demoting it behind a freshly ticked colleague would reassign the row.
    const ticked = toggleTicked(ROWS, ['unknown-holder'], 'a', true);
    expect(ticked).toEqual(['unknown-holder', 'a']);
  });
});

describe('assignedLabel', () => {
  it('says an empty pick is an open shift', () => {
    expect(assignedLabel(0)).toBe('Open shift — nobody yet');
  });

  it('counts the pick', () => {
    expect(assignedLabel(1)).toBe('1 selected');
    expect(assignedLabel(3)).toBe('3 selected');
  });
});
