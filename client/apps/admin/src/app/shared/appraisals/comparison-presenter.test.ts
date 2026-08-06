import { describe, expect, it } from 'vitest';
import { barPercent, peerCell, scoreCell } from './comparison-presenter';
import type { ComparisonRow } from '@/services/appraisal.service';

// buildComparison emits sectionTitle/label/scaleMax as EXPLICIT null (never
// undefined), and always sends askOf — so the fixture defaults match the wire
// rather than TypeScript's optionality.
const row = (over: Partial<ComparisonRow> = {}): ComparisonRow => ({
  sectionTitle: 'Delivery',
  questionId: 'q1',
  label: 'Meets deadlines',
  scaleMax: 5,
  askOf: ['self', 'manager', 'peer'],
  self: 4,
  manager: 3,
  peer: { mean: 4.5, n: 3, suppressed: false },
  peerBreakdown: null,
  ...over,
});

describe('peerCell', () => {
  it('n === 0 renders as "no peer responses", with no number', () => {
    const cell = peerCell(
      row({ peer: { mean: null, n: 0, suppressed: true } })
    );
    expect(cell).toEqual({ kind: 'none' });
  });

  it('n === 1 withholds the number and explains why', () => {
    const cell = peerCell(
      row({ peer: { mean: null, n: 1, suppressed: true } })
    );
    expect(cell).toEqual({ kind: 'single', n: 1 });
    // The point of the whole gate: with one respondent the "mean" IS that
    // person's score, so nothing numeric may reach the subject's screen.
    expect(JSON.stringify(cell)).not.toContain('mean');
  });

  it('n >= 2 renders the mean, the peer count and a bar', () => {
    const cell = peerCell(
      row({ peer: { mean: 4.5, n: 3, suppressed: false } })
    );
    expect(cell).toEqual({ kind: 'mean', mean: 4.5, n: 3, pct: 90 });
  });

  it('withholds on `suppressed` even if a mean somehow arrives with it', () => {
    // Defence in depth: the flag is the gate, not the absence of data. A
    // server bug that sent both must not surface a number to the subject.
    const cell = peerCell(row({ peer: { mean: 4.5, n: 1, suppressed: true } }));
    expect(cell).toEqual({ kind: 'single', n: 1 });
  });

  it('renders "not asked" when peers were never asked this question', () => {
    const cell = peerCell(
      row({
        askOf: ['self', 'manager'],
        peer: { mean: null, n: 0, suppressed: true },
      })
    );
    // Distinct from `none` on purpose — "nobody was asked" and "nobody
    // answered" are different claims to make about someone's review.
    expect(cell).toEqual({ kind: 'notAsked' });
  });
});

describe('scoreCell', () => {
  it('self === null renders a dash, not a zero bar', () => {
    expect(scoreCell(row({ self: null }), 'self')).toEqual({ kind: 'dash' });
  });

  it('a genuine rating of 0 is a real answer and still draws a bar', () => {
    expect(scoreCell(row({ self: 0 }), 'self')).toEqual({
      kind: 'bar',
      value: 0,
      pct: 0,
    });
  });

  it('scales against the question’s own scaleMax', () => {
    expect(scoreCell(row({ manager: 3, scaleMax: 10 }), 'manager')).toEqual({
      kind: 'bar',
      value: 3,
      pct: 30,
    });
  });

  it('renders the number but no bar when the question has no scale', () => {
    expect(scoreCell(row({ self: 4, scaleMax: null }), 'self')).toEqual({
      kind: 'bar',
      value: 4,
      pct: null,
    });
  });

  it('renders "not asked" for a kind absent from askOf', () => {
    expect(scoreCell(row({ askOf: ['peer'], self: null }), 'self')).toEqual({
      kind: 'notAsked',
    });
  });

  it('treats an empty askOf as "asked", so a data gap does not hide a score', () => {
    expect(scoreCell(row({ askOf: [], self: 4 }), 'self')).toEqual({
      kind: 'bar',
      value: 4,
      pct: 80,
    });
  });
});

describe('barPercent', () => {
  it('returns null rather than dividing by a missing or zero scale', () => {
    expect(barPercent(4, null)).toBeNull();
    expect(barPercent(4, 0)).toBeNull();
  });

  it('clamps a rating that exceeds its own scale', () => {
    expect(barPercent(7, 5)).toBe(100);
  });
});
