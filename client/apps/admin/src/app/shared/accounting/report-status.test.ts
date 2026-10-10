// app/shared/accounting/report-status.test.ts
import { describe, expect, it } from 'vitest';
import {
  asLocalDate,
  balanceSheetStatus,
  trialBalanceStatus,
  netMovementDirection,
} from './report-status';

describe('trialBalanceStatus', () => {
  it('says "no activity" for an empty period instead of "out of balance"', () => {
    // The banner used to read "Out of balance — total debits ₦0.00 vs credits
    // ₦0.00. Some entries may be missing; run the journal backfill" for a month
    // with nothing posted, and told the user to repair a ledger that was fine.
    const s = trialBalanceStatus({ isEmpty: true, balanced: false, totalDebits: 0, totalCredits: 0 });
    expect(s.tone).toBe('neutral');
    expect(s.label).toBe('No activity');
    expect(s.detail).not.toMatch(/backfill/i);
  });

  it('reports a genuine imbalance as out of balance', () => {
    const s = trialBalanceStatus({ isEmpty: false, balanced: false, totalDebits: 100, totalCredits: 90 });
    expect(s.tone).toBe('bad');
    expect(s.label).toBe('Out of balance');
    expect(s.detail).toMatch(/backfill/i);
  });

  it('reports a balanced period as balanced', () => {
    const s = trialBalanceStatus({ isEmpty: false, balanced: true, totalDebits: 100, totalCredits: 100 });
    expect(s.tone).toBe('good');
    expect(s.label).toBe('Balanced');
  });

  it('treats a missing isEmpty flag from an older payload as activity', () => {
    // Before the flag existed, an empty period arrived as balanced:false. The
    // report itself is authoritative on `balanced`, so trust it rather than
    // guessing "empty" from a missing field.
    const s = trialBalanceStatus({ balanced: false, totalDebits: 0, totalCredits: 0 });
    expect(s.tone).toBe('bad');
  });
});

describe('netMovementDirection', () => {
  it('reads a debit increase as growth for an asset or expense account', () => {
    expect(netMovementDirection({ debits: 100, credits: 0 }, 'asset')).toEqual({
      delta: 100,
      rising: true,
    });
  });

  it('reads the same posting as a fall for a liability, equity or income account', () => {
    // Paying down Output VAT debits 2100. The balance fell by ₦100; the old
    // widget showed a green up-arrow and "₦100 net movement", which is the
    // opposite of what happened to half the chart of accounts.
    for (const type of ['liability', 'equity', 'income']) {
      expect(netMovementDirection({ debits: 100, credits: 0 }, type)).toEqual({
        delta: -100,
        rising: false,
      });
    }
  });

  it('reads a credit as growth for a credit-nature account', () => {
    expect(netMovementDirection({ debits: 0, credits: 250 }, 'income')).toEqual({
      delta: 250,
      rising: true,
    });
  });

  it('round-trips at two decimals', () => {
    expect(netMovementDirection({ debits: 0.1, credits: 0.2 }, 'asset').delta).toBe(-0.1);
  });

  it('treats an unknown account type as debit-nature rather than guessing', () => {
    expect(netMovementDirection({ debits: 10, credits: 0 }, undefined).rising).toBe(true);
    expect(netMovementDirection({ debits: 0, credits: 10 }, undefined).rising).toBe(false);
  });
});

describe('balanceSheetStatus', () => {
  it('does not cry "close the gap" when the gap is zero', () => {
    // The server's `balanced` also requires assets >= 0, so a tenant whose
    // assets are a net credit got balanced:false with a ₦0.00 gap and was told
    // to "post opening balances to close the gap" — there was no gap.
    const s = balanceSheetStatus({ balanced: false, assets: 0, liabilities: 0, equity: 0 });
    expect(s.gap).toBe(0);
    expect(s.tone).not.toBe('bad');
  });

  it('reports a real gap as out of balance', () => {
    const s = balanceSheetStatus({ balanced: false, assets: 900, liabilities: 100, equity: 700 });
    expect(s.gap).toBe(100);
    expect(s.tone).toBe('bad');
    expect(s.label).toBe('Out of balance');
  });

  it('accepts a kobo rounding difference', () => {
    expect(
      balanceSheetStatus({ balanced: true, assets: 100, liabilities: 0, equity: 99.99 }).tone
    ).toBe('good');
  });

  it('calls an empty sheet balanced rather than asking for a backfill', () => {
    const s = balanceSheetStatus({ balanced: true, assets: 0, liabilities: 0, equity: 0 });
    expect(s.tone).toBe('good');
    expect(s.label).toBe('Balanced');
  });
});

describe('asLocalDate', () => {
  it('reads a bare YYYY-MM-DD as the calendar day, not a UTC instant', () => {
    // `new Date('2026-08-01')` is midnight UTC. Rendering that in local time
    // shows 31 Jul for every timezone west of Greenwich, so a filter of
    // "1 Aug – 1 Aug" was captioned "31 Jul – 1 Aug".
    const d = asLocalDate('2026-08-01');
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 8, 1]);
    expect(asLocalDate('2026-01-01').getDate()).toBe(1);
    expect(asLocalDate('2026-12-31').getMonth() + 1).toBe(12);
  });

  it('leaves a real timestamp alone', () => {
    // An instant must stay an instant; shifting it would move it a day.
    const d = asLocalDate('2026-08-01T23:30:00Z');
    expect(d.getTime()).toBe(Date.parse('2026-08-01T23:30:00Z'));
  });

  it('returns null for nothing usable', () => {
    expect(asLocalDate(undefined)).toBeNull();
    expect(asLocalDate('')).toBeNull();
  });
});
