import { describe, expect, it } from 'vitest';
import { deadlineTone, formatDueLabel, isOverdue } from './my-appraisals-utils';

// ---------------------------------------------------------------------------
// deadlineTone — THE one definition
//
// These assertions moved here from cycle-detail-utils.test.ts. There used to be
// two `deadlineTone` functions with different rules: this one warned at 3 days
// and returned 'normal', cycle-detail-utils' warned at 7 days and returned
// 'ok'. The same deadline therefore rendered amber on the cycle detail page and
// grey on the team list — from the same date, in the same app, four clicks
// apart.
//
// Unified onto the 7-day window (see the function's own comment for why), and
// onto this module because five components already imported from here and only
// one imported the other. The 'ok'/'normal' name went the same way: 'normal' is
// what the five call sites already branch on.
// ---------------------------------------------------------------------------
describe('deadlineTone', () => {
  const now = Date.parse('2026-08-07T12:00:00Z');

  it('is overdue strictly in the past', () => {
    expect(deadlineTone('2026-08-06T12:00:00Z', now)).toBe('overdue');
  });

  it('warns for a week out, not three days', () => {
    // The contract CHANGED here on purpose. Under the old 3-day rule a
    // deadline five days away was plain grey, which is the same colour as one
    // three months away — no warning at all in the window where a reviewer can
    // still realistically act.
    expect(deadlineTone('2026-08-12T12:00:00Z', now)).toBe('soon');
    expect(deadlineTone('2026-08-20T12:00:00Z', now)).toBe('normal');
  });

  it('treats the 7-day boundary as soon, not normal', () => {
    expect(deadlineTone('2026-08-14T12:00:00Z', now)).toBe('soon');
  });

  it('treats a deadline moments away as soon rather than overdue', () => {
    expect(deadlineTone('2026-08-07T12:00:01Z', now)).toBe('soon');
  });

  it('never reports overdue for a missing or unparseable date', () => {
    // A red "overdue" driven by a parse failure is HR chasing people who owe
    // nothing.
    expect(deadlineTone(null, now)).toBe('none');
    expect(deadlineTone(undefined, now)).toBe('none');
    expect(deadlineTone('not a date', now)).toBe('none');
    expect(deadlineTone('', now)).toBe('none');
  });
});

describe('isOverdue', () => {
  const now = Date.parse('2026-08-07T12:00:00Z');

  it('is true only strictly before now', () => {
    expect(isOverdue('2026-08-07T11:59:59Z', now)).toBe(true);
    expect(isOverdue('2026-08-07T12:00:01Z', now)).toBe(false);
  });

  it('is false for a missing or unparseable date', () => {
    expect(isOverdue(null, now)).toBe(false);
    expect(isOverdue('not a date', now)).toBe(false);
  });
});

describe('formatDueLabel', () => {
  it('degrades to copy rather than "Invalid Date"', () => {
    expect(formatDueLabel(null)).toBe('No deadline set');
    expect(formatDueLabel('not a date')).toBe('No deadline set');
  });
});
