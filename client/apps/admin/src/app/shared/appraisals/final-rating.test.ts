import { describe, expect, it } from 'vitest';
import { parseFinalRating } from './appraisal-manager-view';

describe('parseFinalRating', () => {
  it('treats blank as "no rating", not as zero', () => {
    for (const raw of ['', '   ']) {
      const r = parseFinalRating(raw);
      expect(r.ok).toBe(true);
      expect(r.ok && r.value).toBeUndefined();
    }
  });

  it('accepts values across the whole inclusive range', () => {
    for (const [raw, value] of [
      ['0', 0],
      ['7', 7],
      ['10', 10],
      ['  8.5  ', 8.5],
    ] as const) {
      const r = parseFinalRating(raw);
      expect(r.ok).toBe(true);
      expect(r.ok && r.value).toBe(value);
    }
  });

  /**
   * The bug: `Number('abc')` is NaN and NaN serialises to `null`, so a typo
   * used to be sent as "released without a score" rather than reported.
   */
  it('rejects a non-numeric entry instead of sending NaN', () => {
    for (const raw of ['abc', '--', '1.2.3']) {
      const r = parseFinalRating(raw);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toMatch(/must be a number/);
    }
  });

  it('rejects values outside the bounds the input advertises', () => {
    for (const raw of ['-1', '11', '100']) {
      const r = parseFinalRating(raw);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toMatch(/between 0 and 10/);
    }
  });

  it('rejects infinities', () => {
    expect(parseFinalRating('Infinity').ok).toBe(false);
    expect(parseFinalRating('-Infinity').ok).toBe(false);
  });
});
