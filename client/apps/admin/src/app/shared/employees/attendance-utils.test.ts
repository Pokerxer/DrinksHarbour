import { describe, it, expect } from 'vitest';
import {
  PIN_MIN_LENGTH,
  PIN_MAX_LENGTH,
  pressDigit,
  pressBackspace,
  pinSlots,
  isPinReady,
  punctualityLabel,
  punctualityTone,
  recordDuration,
  recordTimes,
  sourceLabel,
  editedByName,
  canDeleteRecord,
  groupAttendance,
  recordDateKey,
  describeClock,
} from './attendance-utils';
import type { AttendanceRecord } from '@/services/attendance.service';

const ALICE = { _id: 'e1', firstName: 'Alice', lastName: 'Okoro' };
const BEN = { _id: 'e2', firstName: 'Ben', lastName: 'Adeyemi' };

function record(over: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    _id: 'a1',
    employee: ALICE,
    shift: null,
    clockIn: '2026-08-10T08:00:00.000Z',
    clockOut: '2026-08-10T16:00:00.000Z',
    source: 'kiosk',
    minutesWorked: 480,
    status: 'closed',
    createdAt: '2026-08-10T08:00:00.000Z',
    updatedAt: '2026-08-10T16:00:00.000Z',
    ...over,
  };
}

describe('the PIN pad', () => {
  it('appends digits up to the maximum and ignores the rest', () => {
    expect(pressDigit('', '4')).toBe('4');
    expect(pressDigit('12', '3')).toBe('123');
    expect(pressDigit('123456', '7')).toBe('123456');
  });

  it('ignores anything that is not a digit rather than erroring', () => {
    // A wall-mounted pad must not need clearing after a stray key press.
    expect(pressDigit('12', 'a')).toBe('12');
    expect(pressDigit('12', '')).toBe('12');
    expect(pressDigit('12', '12')).toBe('12');
  });

  it('backspaces, and an empty entry stays empty', () => {
    expect(pressBackspace('123')).toBe('12');
    expect(pressBackspace('')).toBe('');
  });

  it('shows the minimum number of slots, growing with a longer PIN', () => {
    expect(pinSlots('')).toEqual([false, false, false, false]);
    expect(pinSlots('12')).toEqual([true, true, false, false]);
    expect(pinSlots('1234')).toEqual([true, true, true, true]);
    // 4–6 digit PINs: six empty boxes would imply a four-digit PIN is short.
    expect(pinSlots('12345')).toHaveLength(5);
    expect(pinSlots('123456')).toHaveLength(PIN_MAX_LENGTH);
  });

  it('is only ready at the minimum length', () => {
    expect(isPinReady('123')).toBe(false);
    expect(isPinReady('1234')).toBe(true);
    expect(isPinReady('123456')).toBe(true);
    expect(PIN_MIN_LENGTH).toBe(4);
  });
});

describe('punctuality', () => {
  it('never reports "no shift" as being on time', () => {
    expect(punctualityLabel({ code: 'no_shift', minutes: 0 })).toBe('No shift');
    expect(punctualityLabel(undefined)).toBe('No shift');
    expect(punctualityLabel({ code: 'on_time', minutes: 3 })).toBe('On time');
  });

  it('reads the direction off the code, since minutes is never negative', () => {
    expect(punctualityLabel({ code: 'late', minutes: 25 })).toBe('25m late');
    expect(punctualityLabel({ code: 'early', minutes: 90 })).toBe(
      '1h 30m early'
    );
  });

  it('gives no_shift its own tone and falls back for an unknown code', () => {
    expect(punctualityTone('late')).not.toBe(punctualityTone('on_time'));
    expect(punctualityTone(undefined)).toBe(punctualityTone('no_shift'));
  });
});

describe('a record', () => {
  it('shows a dash for an open record rather than time so far', () => {
    expect(recordDuration({ status: 'open', minutesWorked: 0 })).toBe('—');
    expect(recordDuration({ status: 'closed', minutesWorked: 480 })).toBe('8h');
    expect(recordDuration({ status: 'closed', minutesWorked: 45 })).toBe('45m');
  });

  it('renders both ends in the tenant zone, dashing an open clock-out', () => {
    // 08:00Z is 09:00 in Lagos.
    expect(recordTimes(record())).toEqual({ in: '09:00', out: '17:00' });
    expect(recordTimes(record({ clockOut: null })).out).toBe('—');
  });

  it('distinguishes a punch from a claim', () => {
    expect(sourceLabel('kiosk')).toBe('Kiosk');
    expect(sourceLabel('admin')).toBe('Added by hand');
  });

  it('names the corrector, and says nothing when there was none', () => {
    expect(editedByName(record())).toBe('');
    // A bare id cannot be rendered as a name — it would print an ObjectId.
    expect(editedByName(record({ editedBy: 'u9' }))).toBe('');
    expect(editedByName(record({ editedBy: BEN }))).toBe('Ben Adeyemi');
  });

  it('only lets an admin row be deleted', () => {
    expect(canDeleteRecord({ source: 'admin' })).toBe(true);
    expect(canDeleteRecord({ source: 'kiosk' })).toBe(false);
  });

  it('files a punch under the local day it started', () => {
    // 23:30Z on the 10th is 00:30 on the 11th in Lagos.
    expect(recordDateKey({ clockIn: '2026-08-10T23:30:00.000Z' })).toBe(
      '2026-08-11'
    );
    expect(recordDateKey({ clockIn: '2026-08-10T08:00:00.000Z' })).toBe(
      '2026-08-10'
    );
  });
});

describe('grouping the log', () => {
  it('puts one row per person with their punches earliest first', () => {
    const groups = groupAttendance([
      record({
        _id: 'a2',
        clockIn: '2026-08-10T13:00:00.000Z',
        minutesWorked: 120,
      }),
      record({
        _id: 'a1',
        clockIn: '2026-08-10T08:00:00.000Z',
        minutesWorked: 240,
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].records.map((r) => r._id)).toEqual(['a1', 'a2']);
    expect(groups[0].minutes).toBe(360);
  });

  it('counts only closed minutes, because an open record has none yet', () => {
    const groups = groupAttendance([
      record({ _id: 'a1', minutesWorked: 240 }),
      record({ _id: 'a2', status: 'open', clockOut: null, minutesWorked: 0 }),
    ]);
    expect(groups[0].minutes).toBe(240);
    expect(groups[0].isIn).toBe(true);
  });

  it('sorts people still clocked in above everyone else, then by name', () => {
    const groups = groupAttendance([
      record({ _id: 'a1', employee: ALICE }),
      record({
        _id: 'a2',
        employee: BEN,
        status: 'open',
        clockOut: null,
        minutesWorked: 0,
      }),
    ]);
    expect(groups.map((g) => g.name)).toEqual(['Ben Adeyemi', 'Alice Okoro']);
  });

  it('counts late punches per person', () => {
    const groups = groupAttendance([
      record({ _id: 'a1', punctuality: { code: 'late', minutes: 12 } }),
      record({ _id: 'a2', punctuality: { code: 'on_time', minutes: 0 } }),
      record({ _id: 'a3', punctuality: { code: 'late', minutes: 4 } }),
    ]);
    expect(groups[0].lateCount).toBe(2);
  });

  it('keeps an unpopulated employee ref as its own row rather than merging', () => {
    // Two bare ids would otherwise collapse into one "Unknown employee" row and
    // silently add somebody else's hours to it.
    const groups = groupAttendance([
      record({ _id: 'a1', employee: 'e1' }),
      record({ _id: 'a2', employee: 'e2' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.name === 'Unknown employee')).toBe(true);
  });
});

describe('the kiosk confirmation', () => {
  it('welcomes on the way in and names the shift it matched', () => {
    const out = describeClock({
      action: 'in',
      employee: ALICE,
      item: record({
        status: 'open',
        clockOut: null,
        minutesWorked: 0,
        clockIn: '2026-08-10T08:05:00.000Z',
        shift: {
          _id: 's1',
          start: '2026-08-10T08:00:00.000Z',
          end: '2026-08-10T16:00:00.000Z',
          status: 'published',
        },
      }),
      punctuality: { code: 'on_time', minutes: 5 },
    });
    expect(out.headline).toBe('Welcome, Alice Okoro');
    expect(out.detail).toContain('09:05');
    expect(out.detail).toContain('09:00–17:00');
    expect(out.detail).toContain('On time');
    expect(out.tone).toBe('in');
  });

  it('says nothing about a shift when the punch matched none', () => {
    const out = describeClock({
      action: 'in',
      employee: ALICE,
      item: record({
        status: 'open',
        clockOut: null,
        minutesWorked: 0,
        shift: null,
      }),
      punctuality: { code: 'no_shift', minutes: 0 },
    });
    expect(out.detail).toBe('Clocked in at 09:00');
    expect(out.detail).not.toContain('No shift');
  });

  it('reports the hours worked on the way out', () => {
    const out = describeClock({
      action: 'out',
      employee: ALICE,
      item: record(),
    });
    expect(out.headline).toBe('Goodbye, Alice Okoro');
    expect(out.detail).toContain('17:00');
    expect(out.detail).toContain('8h');
    expect(out.tone).toBe('out');
  });
});
