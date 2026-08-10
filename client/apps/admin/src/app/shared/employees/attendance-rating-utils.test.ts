import { describe, it, expect } from 'vitest';
import {
  bandLabel,
  bandTone,
  ratePercent,
  componentRows,
  departureLabel,
  departureTone,
  overtimeLabel,
  excusedNote,
} from './attendance-rating-utils';
import type { AttendanceRating } from '@/services/attendance.service';

const rating = (over: Partial<AttendanceRating> = {}): AttendanceRating => ({
  score: 87,
  band: 'good',
  components: {
    attendance: { rate: 0.96, of: 23, count: 22 },
    punctuality: { rate: 0.86, of: 22, count: 19 },
    completeness: { rate: 0.95, of: 22, count: 21 },
    duration: { rate: 1, of: 21, count: 21 },
  },
  counts: {
    rostered: 24,
    expected: 23,
    excused: 1,
    attended: 22,
    absent: 1,
    onTime: 19,
    late: 3,
    closed: 21,
    open: 1,
    earlyLeave: 0,
    overtimeMinutes: 0,
    unrostered: 0,
    minutesWorked: 10_560,
  },
  ...over,
});

describe('the rating band', () => {
  it('names each band in words a manager would use', () => {
    expect(bandLabel('excellent')).toBe('Excellent');
    expect(bandLabel('good')).toBe('Good');
    expect(bandLabel('fair')).toBe('Fair');
    expect(bandLabel('needs_attention')).toBe('Needs attention');
  });

  it('says "not rated" rather than implying a bad score', () => {
    // An employee with no roster in the window has not scored badly.
    expect(bandLabel('unrated')).toBe('Not rated');
  });

  it('gives an unrated employee a neutral tone, never a red one', () => {
    expect(bandTone('unrated')).toBe('neutral');
    expect(bandTone('excellent')).toBe('good');
    expect(bandTone('needs_attention')).toBe('bad');
  });
});

describe('formatting a rate', () => {
  it('renders a rate as a whole percentage', () => {
    expect(ratePercent(0.96)).toBe('96%');
    expect(ratePercent(1)).toBe('100%');
    expect(ratePercent(0)).toBe('0%');
  });

  it('renders an absent rate as a dash, not 0%', () => {
    // 0% is a verdict. There was nothing to measure.
    expect(ratePercent(null)).toBe('—');
  });
});

describe('the component breakdown', () => {
  it('shows every component with its own denominator', () => {
    const rows = componentRows(rating());
    expect(rows).toHaveLength(4);
    expect(rows[0].label).toBe('Showed up');
    expect(rows[0].detail).toBe('22/23 shifts');
    expect(rows[0].value).toBe('96%');
  });

  it('keeps a component that could not be measured, marked as such', () => {
    // Dropping the row would hide WHY the score renormalised.
    const rows = componentRows(
      rating({
        components: {
          ...rating().components,
          duration: { rate: null, of: 0, count: 0 },
        },
      })
    );
    const duration = rows.find((r) => r.key === 'duration');
    expect(duration?.value).toBe('—');
    expect(duration?.measured).toBe(false);
  });
});

describe('how a shift ended', () => {
  it('reports leaving early and staying on differently', () => {
    expect(departureLabel({ code: 'early', minutes: 45 })).toBe(
      'Left 45m early'
    );
    expect(departureLabel({ code: 'overtime', minutes: 90 })).toBe(
      'Stayed 1h 30m over'
    );
    expect(departureLabel({ code: 'on_time', minutes: 2 })).toBe(
      'Left on time'
    );
  });

  it('says a record was never closed rather than calling it early', () => {
    expect(departureLabel({ code: 'open', minutes: 0 })).toBe(
      'Never clocked out'
    );
  });

  it('treats overtime as neutral, never as a fault', () => {
    // Staying late is not a fault, so it must not render like one.
    expect(departureTone({ code: 'overtime', minutes: 90 })).toBe('neutral');
    expect(departureTone({ code: 'early', minutes: 45 })).toBe('bad');
    expect(departureTone({ code: 'open', minutes: 0 })).toBe('bad');
    expect(departureTone({ code: 'on_time', minutes: 0 })).toBe('good');
  });
});

describe('the footnotes', () => {
  it('reports overtime as hours worked beyond the roster', () => {
    expect(overtimeLabel(150)).toBe('2h 30m overtime');
    expect(overtimeLabel(0)).toBe('');
  });

  it('explains an excused absence so it does not look like a gap', () => {
    expect(excusedNote(1)).toBe('1 absence excused (approved leave)');
    expect(excusedNote(3)).toBe('3 absences excused (approved leave)');
    expect(excusedNote(0)).toBe('');
  });
});
