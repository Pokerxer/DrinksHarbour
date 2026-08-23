// app/shared/purchases/exchange-rates-helpers.test.ts
//
// Pure logic for the exchange-rates screen and the shared useExchangeRates
// hook. The rate resolver mirrors the server's direct→inverse lookup and adds
// one extra fallback the server lacks: triangulation through the base
// currency, so a missing EUR→USD row still converts when both EUR→NGN and
// USD→NGN legs exist (consumers previously fell through to "treat as base").
import { describe, expect, it } from 'vitest';
import {
  resolveRate,
  parsePositiveNumber,
  formatRateDate,
  localDateKey,
  isBackDated,
  fmtRate,
  fmtMoney,
} from './exchange-rates-helpers';

type Row = { fromCurrency: string; toCurrency: string; rate: number };

const ROWS: Row[] = [
  { fromCurrency: 'USD', toCurrency: 'NGN', rate: 1550 },
  { fromCurrency: 'EUR', toCurrency: 'NGN', rate: 1700 },
];

describe('resolveRate', () => {
  it('returns 1 for identical currencies', () => {
    expect(resolveRate(ROWS, 'NGN', 'NGN', 'NGN')).toBe(1);
  });

  it('finds a direct pair', () => {
    expect(resolveRate(ROWS, 'USD', 'NGN', 'NGN')).toBe(1550);
  });

  it('falls back to the inverse pair', () => {
    expect(resolveRate(ROWS, 'NGN', 'USD', 'NGN')).toBeCloseTo(1 / 1550, 12);
  });

  it('triangulates through the base when neither direction exists', () => {
    // EUR→USD = (EUR→NGN) / (USD→NGN)
    expect(resolveRate(ROWS, 'EUR', 'USD', 'NGN')).toBeCloseTo(
      1700 / 1550,
      12
    );
    expect(resolveRate(ROWS, 'USD', 'EUR', 'NGN')).toBeCloseTo(
      1550 / 1700,
      12
    );
  });

  it('returns null for an unreachable pair instead of guessing', () => {
    expect(resolveRate(ROWS, 'GBP', 'JPY', 'NGN')).toBeNull();
  });

  it('never divides by a zero or negative inverse/triangulation leg', () => {
    const broken: Row[] = [{ fromCurrency: 'USD', toCurrency: 'NGN', rate: 0 }];
    expect(resolveRate(broken, 'NGN', 'USD', 'NGN')).toBeNull();
    // Triangulation with a zero leg must not produce Infinity.
    expect(resolveRate([{ ...broken[0] }, { fromCurrency: 'EUR', toCurrency: 'NGN', rate: 5 }], 'EUR', 'USD', 'NGN')).toBeNull();
  });
});

describe('parsePositiveNumber', () => {
  it('accepts positive finite numbers', () => {
    expect(parsePositiveNumber('1550')).toBe(1550);
    expect(parsePositiveNumber('12.5')).toBe(12.5);
  });

  it('rejects empty, non-numeric, zero and negative input', () => {
    expect(parsePositiveNumber('')).toBeNull();
    expect(parsePositiveNumber('abc')).toBeNull();
    expect(parsePositiveNumber('0')).toBeNull();
    expect(parsePositiveNumber('-3')).toBeNull();
    expect(parsePositiveNumber('Infinity')).toBeNull();
    expect(parsePositiveNumber('NaN')).toBeNull();
  });
});

describe('formatRateDate', () => {
  it('formats a bare ISO date without shifting timezones', () => {
    expect(formatRateDate('2026-08-23')).toBe('Aug 23, 2026');
  });

  it('ignores any time component', () => {
    expect(formatRateDate('2026-01-05T10:30:00.000Z')).toBe('Jan 5, 2026');
  });

  it('passes through values it cannot parse', () => {
    expect(formatRateDate('not-a-date')).toBe('not-a-date');
    expect(formatRateDate('')).toBe('');
  });
});

describe('localDateKey', () => {
  it('builds YYYY-MM-DD from local calendar parts', () => {
    expect(localDateKey(new Date(2026, 7, 23, 0, 30))).toBe('2026-08-23');
    expect(localDateKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('isBackDated', () => {
  const ledger = [
    {
      fromCurrency: 'USD',
      toCurrency: 'NGN',
      rate: 1600,
      effectiveDate: '2026-09-01',
      isActive: true,
    },
    {
      fromCurrency: 'EUR',
      toCurrency: 'NGN',
      rate: 1700,
      effectiveDate: '2026-01-01',
      isActive: false,
    },
  ];

  it('flags a save that would be shadowed by a newer active rate', () => {
    expect(isBackDated(ledger, 'USD', 'NGN', '2026-08-23')).toBe(true);
  });

  it('allows same-day and future-dated saves', () => {
    expect(isBackDated(ledger, 'USD', 'NGN', '2026-09-01')).toBe(false);
    expect(isBackDated(ledger, 'USD', 'NGN', '2026-12-01')).toBe(false);
  });

  it('ignores inactive rates and other pairs', () => {
    expect(isBackDated(ledger, 'EUR', 'NGN', '2025-01-01')).toBe(false);
    expect(isBackDated(ledger, 'GBP', 'NGN', '2020-01-01')).toBe(false);
  });
});

describe('fmtRate / fmtMoney', () => {
  it('renders rates with up to 4 decimals and no forced minimums', () => {
    expect(fmtRate(1 / 1550)).toBe('0.0006');
    expect(fmtRate(1550)).toBe('1,550');
  });

  it('renders money with exactly two decimals', () => {
    expect(fmtMoney(1234567.891)).toBe('1,234,567.89');
    expect(fmtMoney(0)).toBe('0.00');
  });
});
