// app/shared/accounting/accounting-helpers.test.ts
import { describe, expect, it } from 'vitest';
import {
  csvCell,
  dateWindowLabel,
  entryTotals,
  entryTypeLabel,
  fmtAxisMoney,
  fmtMoney,
  groupAccountsByType,
  linesBalanced,
  pageWindowLabel,
  periodLabel,
  postedByLabel,
  refDocLabel,
} from './accounting-helpers';
import type { Account } from '@/services/accounting.service';

describe('accounting-helpers', () => {
  it('formats naira money', () => {
    expect(fmtMoney(112.5)).toBe('₦ 112.50');
    expect(fmtMoney(NaN)).toBe('₦ 0.00');
  });

  it('compacts naira for chart axes', () => {
    expect(fmtAxisMoney(1_250_000)).toBe('₦1.3m');
    expect(fmtAxisMoney(450_000)).toBe('₦450k');
    expect(fmtAxisMoney(-250)).toBe('₦-250');
    expect(fmtAxisMoney(NaN)).toBe('₦0');
  });

  it('labels entry types and ref docs with fallbacks', () => {
    expect(entryTypeLabel('sales_revenue')).toBe('Sales Revenue');
    expect(entryTypeLabel('mystery')).toBe('mystery');
    expect(refDocLabel('VendorBill')).toBe('Vendor Bill');
    expect(refDocLabel('Other')).toBe('Other');
  });

  it('checks the live balance of form lines within ±0.01', () => {
    expect(linesBalanced([{ debit: '100', credit: '0' }, { debit: '0', credit: '100' }])).toEqual({
      balanced: true,
      debit: 100,
      credit: 100,
    });
    expect(linesBalanced([{ debit: '100', credit: '0' }, { debit: '0', credit: '99' }]).balanced).toBe(false);
    expect(linesBalanced([{ debit: '0', credit: '0' }]).balanced).toBe(false);
  });

  it('groups accounts by canonical type order and drops empty groups', () => {
    const accounts = [
      { code: '4000', name: 'Sales Revenue', type: 'income' },
      { code: '1000', name: 'Cash', type: 'asset' },
      { code: '2000', name: 'Payables', type: 'liability' },
      { code: '6000', name: 'OpEx', type: 'expense' },
    ] as Account[];
    const groups = groupAccountsByType(accounts);
    expect(groups.map((g) => g.type)).toEqual(['asset', 'liability', 'income', 'expense']);
  });

  it('guards CSV cells against formula injection', () => {
    expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"');
    expect(csvCell('plain')).toBe('"plain"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('falls back to a dash when nobody is attributed', () => {
    expect(postedByLabel({} as never)).toBe('—');
  });

  it('sums entry line totals kobo-safe', () => {
    const entry = {
      lines: [
        { debit: 100.1, credit: 0 },
        { debit: 0, credit: 100.1 },
      ],
    } as never;
    expect(entryTotals(entry)).toEqual({ debit: 100.1, credit: 100.1 });
    expect(entryTotals({ lines: [] } as never)).toEqual({ debit: 0, credit: 0 });
  });

  it('builds the pagination window label', () => {
    expect(pageWindowLabel(1, 25, 132)).toBe('1–25 of 132');
    expect(pageWindowLabel(6, 25, 132)).toBe('126–132 of 132');
    expect(pageWindowLabel(1, 25, 0)).toBe('');
  });

  it('labels date windows and periods', () => {
    expect(dateWindowLabel('', '')).toBe('All time');
    // Locale-tolerant: en-US prints "Aug 1", en-GB prints "1 Aug".
    expect(dateWindowLabel('2026-08-01T00:00:00Z')).toMatch(/Aug.* – Today$/);
    expect(dateWindowLabel('', '2026-08-26T00:00:00Z')).toMatch(/^Start – .*Aug.*2026$/);
    expect(periodLabel('2026-08')).toMatch(/August 2026/);
    expect(periodLabel('bad')).toBe('bad');
  });
});
