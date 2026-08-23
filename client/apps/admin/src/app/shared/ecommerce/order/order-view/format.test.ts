import { describe, it, expect } from 'vitest';
import {
  parseDate,
  shortDate,
  longDate,
  formatCurrency,
  humanize,
} from './format';

describe('parseDate', () => {
  it('returns null for null, undefined and empty strings', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate('')).toBeNull();
  });

  it('returns null for garbage instead of an Invalid Date', () => {
    expect(parseDate('not-a-date')).toBeNull();
  });

  it('parses a valid ISO string', () => {
    const d = parseDate('2026-01-15T10:30:00.000Z');
    expect(d).toBeInstanceOf(Date);
    expect(d?.getTime()).not.toBeNaN();
  });
});

describe('shortDate / longDate', () => {
  it('return null when the input is missing or invalid', () => {
    expect(shortDate(undefined)).toBeNull();
    expect(shortDate('garbage')).toBeNull();
    expect(longDate(null)).toBeNull();
  });

  it('render the expected en-NG shapes', () => {
    // Fixed timestamp → deterministic formatting in any TZ that observes it
    const iso = '2026-03-02T09:05:00.000Z';
    expect(shortDate(iso)).toMatch(/2 Mar · \d{1,2}:\d{2}/);
    expect(longDate(iso)).toMatch(/^1? March|March/);
    expect(longDate(iso)).toContain('2026');
  });
});

describe('formatCurrency', () => {
  it('falls back to ₦0 for NaN, undefined and non-finite values', () => {
    expect(formatCurrency(undefined)).toBe(formatCurrency(0));
    expect(formatCurrency(NaN)).toBe(formatCurrency(0));
    expect(formatCurrency(Infinity)).toBe(formatCurrency(0));
  });

  it('formats whole Naira with no decimals', () => {
    expect(formatCurrency(12500)).toMatch(/12,500/);
  });

  it('degrades to NGN when passed an empty currency', () => {
    expect(formatCurrency(5, '')).toMatch(/₦/);
  });
});

describe('humanize', () => {
  it('converts snake_case to Title Case and tolerates undefined', () => {
    expect(humanize('cash_on_delivery')).toBe('Cash On Delivery');
    expect(humanize(undefined)).toBe('');
  });
});
