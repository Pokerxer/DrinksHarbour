import { describe, it, expect } from 'vitest';
import { fmtAmount, packsLabel, linePackSize, packNounOf, refIdOf, CURRENCY_SYMBOLS } from './types';

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

describe('refIdOf', () => {
  it('extracts _id from populated refs (getPurchaseOrder populates subProductId)', () => {
    expect(refIdOf({ _id: 'abc123', name: 'Hennessy VS' })).toBe('abc123');
    expect(refIdOf({ _id: 'size-9', size: '70cl' })).toBe('size-9');
  });

  it('passes plain ids and empties through', () => {
    expect(refIdOf('plain-id')).toBe('plain-id');
    expect(refIdOf(undefined)).toBe('');
    expect(refIdOf(null)).toBe('');
  });
});

describe('linePackSize', () => {
  it('prefers packagingQty (what the server persists)', () => {
    expect(linePackSize({ packagingQty: 6, packSize: 12 })).toBe(6);
    expect(linePackSize({ packagingQty: 6 })).toBe(6);
  });

  it('falls back to packSize then 1', () => {
    expect(linePackSize({ packSize: 24 })).toBe(24);
    expect(linePackSize({})).toBe(1);
    expect(linePackSize({ packagingQty: 0 })).toBe(1);
  });
});

describe('packNounOf', () => {
  it('maps packaging types onto a countable noun', () => {
    expect(packNounOf('bottle')).toBe('bottle');
    expect(packNounOf('glass_bottle')).toBe('bottle');
    expect(packNounOf('plastic_bottle')).toBe('bottle');
    expect(packNounOf('keg')).toBe('keg');
    expect(packNounOf(undefined)).toBe('bottle');
  });
});

describe('packsLabel', () => {
  it('shows whole packs when the quantity divides evenly', () => {
    expect(packsLabel(480, 12)).toBe('40 packs');
    expect(packsLabel(12, 12)).toBe('1 pack');
  });

  it('combines packs and loose units like a buyer speaks', () => {
    expect(packsLabel(37, 6)).toBe('6 packs & 1 bottle');
    expect(packsLabel(31, 6)).toBe('5 packs & 1 bottle');
  });

  it('shows loose units alone below one pack', () => {
    expect(packsLabel(5, 6)).toBe('5 bottles');
    expect(packsLabel(1, 6)).toBe('1 bottle');
  });

  it('degrades to plain units when there is no real pack size', () => {
    expect(packsLabel(5, 1)).toBe('5 bottles');
    expect(packsLabel(7)).toBe('7 bottles');
    expect(packsLabel(0, 6)).toBe('0 bottles');
  });

  it('uses the line packaging noun when given', () => {
    expect(packsLabel(10, 4, 'can')).toBe('2 packs & 2 cans');
    expect(packsLabel(3, 4, 'keg')).toBe('3 kegs');
  });
});
