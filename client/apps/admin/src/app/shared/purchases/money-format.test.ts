import { describe, it, expect } from 'vitest';
import { fmtAmount, CURRENCY_SYMBOLS } from './types';

describe('fmtAmount', () => {
  it('groups thousands with commas and keeps two decimals', () => {
    expect(fmtAmount(1234567.891)).toBe('1,234,567.89');
    expect(fmtAmount(12500)).toBe('12,500.00');
    expect(fmtAmount(999.999)).toBe('1,000.00'); // rounds, then groups
  });

  it('handles small and zero values', () => {
    expect(fmtAmount(0)).toBe('0.00');
    expect(fmtAmount(0.5)).toBe('0.50');
    expect(fmtAmount(42)).toBe('42.00');
  });

  it('groups large round sums a buyer actually prints', () => {
    expect(fmtAmount(4800000)).toBe('4,800,000.00');
    expect(fmtAmount(150000)).toBe('150,000.00');
  });

  it('keeps negatives signed', () => {
    expect(fmtAmount(-2500)).toBe('-2,500.00');
  });

  it('falls back to zero for null, undefined and NaN', () => {
    expect(fmtAmount(null)).toBe('0.00');
    expect(fmtAmount(undefined)).toBe('0.00');
    expect(fmtAmount(NaN)).toBe('0.00');
  });
});

describe('CURRENCY_SYMBOLS', () => {
  it('covers every currency the purchase module renders', () => {
    expect(CURRENCY_SYMBOLS.NGN).toBe('₦');
    expect(CURRENCY_SYMBOLS.USD).toBe('$');
  });
});
